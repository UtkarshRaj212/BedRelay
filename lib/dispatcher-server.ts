import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, hospitals, bedCategories } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { calculateDistanceKm } from "@/lib/geo";
import crypto from "crypto";

export const DISPATCHER_COOKIE_NAME = "bedrelay_dispatcher_session_id";
export const ACTIVE_STATUSES = ["PENDING", "SENT", "ACCEPTED"] as const;
export const TERMINAL_STATUSES = ["REJECTED", "COMPLETED", "CANCELLED"] as const;

export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export interface ServerDispatcherIdentity {
  sessionId: string;
  isNew: boolean;
  applyCookie: (res: NextResponse) => void;
}

/**
 * Resolves the server-side dispatcher session ID strictly from secure cookie.
 * NEVER trusts any client-supplied dispatcherSessionId in request payload or params.
 */
export function resolveServerDispatcherSession(req: NextRequest): ServerDispatcherIdentity {
  const existingCookie = req.cookies.get(DISPATCHER_COOKIE_NAME)?.value?.trim();
  
  if (existingCookie && existingCookie.length > 5) {
    return {
      sessionId: existingCookie,
      isNew: false,
      applyCookie: (res: NextResponse) => {
        // Refresh cookie maxAge
        res.cookies.set(DISPATCHER_COOKIE_NAME, existingCookie, {
          path: "/",
          maxAge: 31536000, // 1 year
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: false, // needed so client telemetry can read session id for read-only history if needed
        });
      },
    };
  }

  // Generate new cryptographically secure session ID
  const randomHex = crypto.randomBytes(8).toString("hex");
  const newSessionId = `disp_sess_${Date.now()}_${randomHex}`;

  return {
    sessionId: newSessionId,
    isNew: true,
    applyCookie: (res: NextResponse) => {
      res.cookies.set(DISPATCHER_COOKIE_NAME, newSessionId, {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
      });
    },
  };
}

/**
 * Retrieves the currently active dispatch request for a dispatcher session, if one exists.
 */
export async function getActiveDispatchForSession(sessionId: string) {
  if (!sessionId) return null;

  const [activeRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(
      and(
        eq(dispatchRequests.dispatcherSessionId, sessionId),
        inArray(dispatchRequests.status, [...ACTIVE_STATUSES])
      )
    )
    .orderBy(desc(dispatchRequests.createdAt))
    .limit(1);

  if (!activeRecord) return null;

  // Enrich with hospital details
  const [hospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, activeRecord.hospitalId))
    .limit(1);

  let distanceKm: number | null = null;
  if (
    activeRecord.ambulanceLat !== null &&
    activeRecord.ambulanceLng !== null &&
    hospital?.latitude &&
    hospital?.longitude
  ) {
    distanceKm = calculateDistanceKm(
      activeRecord.ambulanceLat,
      activeRecord.ambulanceLng,
      hospital.latitude,
      hospital.longitude
    );
  }

  return {
    ...activeRecord,
    ambulanceId: activeRecord.ambulanceId || activeRecord.ambulanceUnit,
    patientReference: activeRecord.patientReference || activeRecord.patientRef,
    hospitalName: hospital?.name || "Unknown Hospital",
    hospitalAddress: hospital?.address || "",
    hospitalCity: hospital?.city || "",
    hospitalState: hospital?.state || "",
    hospitalPhone: hospital?.phone || "",
    hospitalLat: hospital?.latitude || null,
    hospitalLng: hospital?.longitude || null,
    distanceKm,
  };
}

/**
 * Atomically switches receiving hospital for the active dispatch.
 * Cancels old request (releasing reserved beds if ACCEPTED) and creates new request.
 */
export async function switchReceivingHospitalTx({
  sessionId,
  targetHospitalId,
  ambulanceUnit,
  ambulanceId,
  ambulanceLat,
  ambulanceLng,
  patientRef,
  patientReference,
  bedCategoryCode,
  requestedBeds,
  etaMinutes,
  patientCondition,
}: {
  sessionId: string;
  targetHospitalId: string;
  ambulanceUnit?: string;
  ambulanceId?: string;
  ambulanceLat?: number | null;
  ambulanceLng?: number | null;
  patientRef?: string;
  patientReference?: string;
  bedCategoryCode?: string;
  requestedBeds?: number;
  etaMinutes?: number;
  patientCondition?: string;
}) {
  const now = new Date();

  return await db.transaction(async (tx) => {
    // 1. Locate current active request for this session
    const [currentActive] = await tx
      .select()
      .from(dispatchRequests)
      .where(
        and(
          eq(dispatchRequests.dispatcherSessionId, sessionId),
          inArray(dispatchRequests.status, [...ACTIVE_STATUSES])
        )
      )
      .orderBy(desc(dispatchRequests.createdAt))
      .limit(1);

    if (!currentActive) {
      throw new Error("No active dispatch request found to switch.");
    }

    // 2. If current active request was ACCEPTED, release reserved beds
    if (currentActive.status.toUpperCase() === "ACCEPTED") {
      const [oldCategory] = await tx
        .select()
        .from(bedCategories)
        .where(
          and(
            eq(bedCategories.hospitalId, currentActive.hospitalId),
            eq(bedCategories.categoryCode, currentActive.bedCategoryCode.toUpperCase())
          )
        )
        .for("update")
        .limit(1);

      if (oldCategory) {
        await tx
          .update(bedCategories)
          .set({
            availableBeds: Math.min(
              oldCategory.totalBeds,
              oldCategory.availableBeds + currentActive.requestedBeds
            ),
            occupiedBeds: Math.max(
              0,
              oldCategory.occupiedBeds - currentActive.requestedBeds
            ),
            lastUpdated: now,
            updatedAt: now,
          })
          .where(eq(bedCategories.id, oldCategory.id));
      }
    }

    // 3. Mark current active request as CANCELLED
    await tx
      .update(dispatchRequests)
      .set({
        status: "CANCELLED",
        updatedAt: now,
      })
      .where(eq(dispatchRequests.id, currentActive.id));

    // 4. Validate target hospital
    const [targetHospital] = await tx
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, targetHospitalId))
      .limit(1);

    if (!targetHospital) {
      throw new Error("Target receiving hospital facility not found.");
    }
    if (targetHospital.status !== "ACTIVE") {
      throw new Error("Target hospital facility is currently inactive.");
    }

    const finalCategoryCode = (bedCategoryCode || currentActive.bedCategoryCode).toUpperCase();
    const finalRequestedBeds = Math.max(1, requestedBeds || currentActive.requestedBeds);
    const finalEta = Math.max(1, etaMinutes || currentActive.etaMinutes);
    const finalAmbulanceUnit = (ambulanceUnit || ambulanceId || currentActive.ambulanceUnit).trim();
    const finalAmbulanceId = (ambulanceId || ambulanceUnit || currentActive.ambulanceId || currentActive.ambulanceUnit).trim();
    const finalPatientRef = (patientRef || patientReference || currentActive.patientRef || "").trim();
    const finalPatientReference = (patientReference || patientRef || currentActive.patientReference || currentActive.patientRef || "").trim();
    const finalCondition = (patientCondition || currentActive.patientCondition).trim();

    // Verify bed availability in target hospital
    const [targetCat] = await tx
      .select()
      .from(bedCategories)
      .where(
        and(
          eq(bedCategories.hospitalId, targetHospitalId),
          eq(bedCategories.categoryCode, finalCategoryCode)
        )
      )
      .limit(1);

    if (!targetCat || targetCat.availableBeds < finalRequestedBeds) {
      throw new Error(
        `Insufficient beds at ${targetHospital.name} for ${finalCategoryCode}. Available: ${
          targetCat ? targetCat.availableBeds : 0
        }, Requested: ${finalRequestedBeds}`
      );
    }

    const finalLat = ambulanceLat !== undefined ? ambulanceLat : currentActive.ambulanceLat;
    const finalLng = ambulanceLng !== undefined ? ambulanceLng : currentActive.ambulanceLng;

    let distanceKm: number | null = null;
    if (finalLat !== null && finalLng !== null && targetHospital.latitude && targetHospital.longitude) {
      distanceKm = calculateDistanceKm(
        finalLat,
        finalLng,
        targetHospital.latitude,
        targetHospital.longitude
      );
    }

    const newDispatchId = `disp_${Date.now()}`;

    // 5. Create new dispatch request
    const [newDispatch] = await tx
      .insert(dispatchRequests)
      .values({
        id: newDispatchId,
        hospitalId: targetHospitalId,
        dispatcherSessionId: sessionId,
        ambulanceUnit: finalAmbulanceUnit,
        ambulanceId: finalAmbulanceId,
        ambulanceLat: finalLat,
        ambulanceLng: finalLng,
        patientRef: finalPatientRef || `PAT-${Math.floor(1000 + Math.random() * 9000)}`,
        patientReference: finalPatientReference || finalPatientRef || `PAT-${Math.floor(1000 + Math.random() * 9000)}`,
        bedCategoryCode: finalCategoryCode,
        requestedBeds: finalRequestedBeds,
        etaMinutes: finalEta,
        patientCondition: finalCondition,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      cancelledDispatchId: currentActive.id,
      newDispatch: {
        ...newDispatch,
        distanceKm,
        hospitalName: targetHospital.name,
        hospitalAddress: targetHospital.address,
        hospitalCity: targetHospital.city,
        hospitalState: targetHospital.state,
        hospitalPhone: targetHospital.phone,
        hospitalLat: targetHospital.latitude,
        hospitalLng: targetHospital.longitude,
      },
    };
  });
}

/**
 * Securely cancels the active dispatch belonging to the dispatcher session.
 */
export async function cancelActiveDispatchTx(sessionId: string) {
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [activeRecord] = await tx
      .select()
      .from(dispatchRequests)
      .where(
        and(
          eq(dispatchRequests.dispatcherSessionId, sessionId),
          inArray(dispatchRequests.status, [...ACTIVE_STATUSES])
        )
      )
      .orderBy(desc(dispatchRequests.createdAt))
      .limit(1);

    if (!activeRecord) {
      throw new Error("No active dispatch request found to cancel.");
    }

    // If ACCEPTED, release reserved beds
    if (activeRecord.status.toUpperCase() === "ACCEPTED") {
      const [category] = await tx
        .select()
        .from(bedCategories)
        .where(
          and(
            eq(bedCategories.hospitalId, activeRecord.hospitalId),
            eq(bedCategories.categoryCode, activeRecord.bedCategoryCode.toUpperCase())
          )
        )
        .for("update")
        .limit(1);

      if (category) {
        await tx
          .update(bedCategories)
          .set({
            availableBeds: Math.min(
              category.totalBeds,
              category.availableBeds + activeRecord.requestedBeds
            ),
            occupiedBeds: Math.max(
              0,
              category.occupiedBeds - activeRecord.requestedBeds
            ),
            lastUpdated: now,
            updatedAt: now,
          })
          .where(eq(bedCategories.id, category.id));
      }
    }

    const [cancelled] = await tx
      .update(dispatchRequests)
      .set({
        status: "CANCELLED",
        updatedAt: now,
      })
      .where(eq(dispatchRequests.id, activeRecord.id))
      .returning();

    return cancelled;
  });
}

/**
 * Retrieves the most recent rejected dispatch request for this session, if any.
 * Used for the persistent rejection alert banner.
 */
export async function getLastRejectedDispatchForSession(sessionId: string) {
  if (!sessionId) return null;

  const [rejectedRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(
      and(
        eq(dispatchRequests.dispatcherSessionId, sessionId),
        eq(dispatchRequests.status, "REJECTED")
      )
    )
    .orderBy(desc(dispatchRequests.updatedAt))
    .limit(1);

  if (!rejectedRecord) return null;

  // Enrich with hospital details
  const [hospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, rejectedRecord.hospitalId))
    .limit(1);

  return {
    id: rejectedRecord.id,
    hospitalId: rejectedRecord.hospitalId,
    hospitalName: hospital?.name || "Target Hospital",
    rejectionReason: rejectedRecord.rejectionReason || "ICU capacity unavailable.",
    rejectedAt: rejectedRecord.updatedAt,
  };
}


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, hospitals, bedCategories } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { calculateDistanceKm } from "@/lib/geo";
import { logDispatchActivity } from "@/lib/activity-logger";
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
 * Automatically completes active dispatch requests whose elapsed time has reached
 * completion threshold = ETA × 3.
 * Only completes requests in ACTIVE_STATUSES (PENDING, SENT, ACCEPTED).
 * Does NOT complete REJECTED, CANCELLED, or already COMPLETED requests.
 * Records an audit entry in dispatchActivities.
 */
export async function checkAndAutoCompleteExpiredDispatches(): Promise<string[]> {
  const now = new Date();

  // Find all candidate active requests
  const activeList = await db
    .select()
    .from(dispatchRequests)
    .where(inArray(dispatchRequests.status, [...ACTIVE_STATUSES]));

  const completedIds: string[] = [];

  for (const record of activeList) {
    const eta = Math.max(1, record.etaMinutes || 15);
    const buffer = Math.max(20, Math.round(eta / 3));
    const thresholdMinutes = eta + buffer;
    const createdAtMs = new Date(record.createdAt).getTime();
    const elapsedMinutes = (now.getTime() - createdAtMs) / (60 * 1000);

    if (elapsedMinutes >= thresholdMinutes) {
      await db.transaction(async (tx) => {
        await tx
          .update(dispatchRequests)
          .set({
            status: "COMPLETED",
            updatedAt: now,
          })
          .where(eq(dispatchRequests.id, record.id));

        await logDispatchActivity(
          {
            dispatchId: record.id,
            actorType: "SYSTEM",
            actorName: "System Automation",
            action: "SYSTEM_AUTO_COMPLETION",
            details: `Dispatch request automatically completed based on elapsed ETA (${eta}m + max(20m, ${Math.round(eta / 3)}m buffer) = ${thresholdMinutes}m threshold reached).`,
            oldValue: record.status,
            newValue: "COMPLETED",
            note: `ETA ${eta}m threshold (${thresholdMinutes}m) reached`,
          },
          tx
        );
      });

      completedIds.push(record.id);
    }
  }

  return completedIds;
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

  // First run server-side auto completion check
  await checkAndAutoCompleteExpiredDispatches();

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

  // Enrich with hospital details and bed capacity
  const [hospital, hospitalBeds] = await Promise.all([
    db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, activeRecord.hospitalId))
      .limit(1)
      .then((rows) => rows[0] || null),
    db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.hospitalId, activeRecord.hospitalId)),
  ]);

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
    hospitalBeds: hospitalBeds.map((b) => ({
      categoryCode: b.categoryCode,
      name: b.name,
      availableBeds: b.availableBeds,
      totalBeds: b.totalBeds,
      occupiedBeds: b.occupiedBeds,
    })),
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

    // 2. If current active request was ACCEPTED, release allocated beds
    if (currentActive.status.toUpperCase() === "ACCEPTED" && (currentActive.approvedBeds || 0) > 0) {
      const bedsToRelease = currentActive.approvedBeds;
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
              oldCategory.availableBeds + bedsToRelease
            ),
            occupiedBeds: Math.max(
              0,
              oldCategory.occupiedBeds - bedsToRelease
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
    const finalRequestedBeds = Math.max(
      1,
      requestedBeds !== undefined && requestedBeds !== null && !isNaN(Number(requestedBeds))
        ? Number(requestedBeds)
        : currentActive.requestedBeds
    );
    const finalEta = Math.max(
      1,
      etaMinutes !== undefined && etaMinutes !== null && !isNaN(Number(etaMinutes))
        ? Number(etaMinutes)
        : currentActive.etaMinutes
    );
    const finalCondition = (
      patientCondition && typeof patientCondition === "string" && patientCondition.trim() !== ""
        ? patientCondition
        : currentActive.patientCondition
    ).trim();
    const finalAmbulanceUnit = (ambulanceUnit || ambulanceId || currentActive.ambulanceUnit).trim();
    const finalAmbulanceId = (ambulanceId || ambulanceUnit || currentActive.ambulanceId || currentActive.ambulanceUnit).trim();
    const finalPatientRef = (patientRef || patientReference || currentActive.patientRef || "").trim();
    const finalPatientReference = (patientReference || patientRef || currentActive.patientReference || currentActive.patientRef || "").trim();

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
        approvedBeds: 0,
        etaMinutes: finalEta,
        patientCondition: finalCondition,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Log audit entries
    await logDispatchActivity(
      {
        dispatchId: currentActive.id,
        actorType: "DISPATCHER",
        action: "HOSPITAL_SWITCHED",
        details: `Receiving hospital switched to ${targetHospital.name}. Previous request cancelled.`,
        oldValue: currentActive.hospitalId,
        newValue: targetHospitalId,
      },
      tx
    );

    await logDispatchActivity(
      {
        dispatchId: newDispatchId,
        actorType: "DISPATCHER",
        action: "REQUEST_CREATED",
        details: `Pre-arrival alert transmitted to ${targetHospital.name}. Required: ${finalRequestedBeds} ${finalCategoryCode} bed(s). ETA: ${finalEta}m. (Switched from ${currentActive.id})`,
        newValue: `Hospital: ${targetHospital.name} | Category: ${finalCategoryCode} | Beds: ${finalRequestedBeds} | ETA: ${finalEta}m`,
      },
      tx
    );

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

    await logDispatchActivity(
      {
        dispatchId: activeRecord.id,
        actorType: "DISPATCHER",
        actorName: "Ambulance Dispatcher",
        action: "REQUEST_CANCELLED",
        details: "Active dispatch alert cancelled by dispatcher.",
        oldValue: activeRecord.status,
        newValue: "CANCELLED",
      },
      tx
    );

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


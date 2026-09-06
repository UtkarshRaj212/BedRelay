import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, bedCategories, hospitals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateDistanceKm, isValidCoordinates } from "@/lib/geo";
import {
  resolveServerDispatcherSession,
  getActiveDispatchForSession,
} from "@/lib/dispatcher-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, applyCookie } = resolveServerDispatcherSession(req);

    // Enforce ONE ACTIVE REQUEST rule
    const existingActive = await getActiveDispatchForSession(sessionId);
    if (existingActive) {
      const conflictRes = NextResponse.json(
        {
          error: "An active dispatch request is already in progress. Dispatchers can only have one active request at a time. Cancel or switch receiving hospital.",
          activeDispatch: existingActive,
        },
        { status: 409 }
      );
      applyCookie(conflictRes);
      return conflictRes;
    }

    const body = await req.json();
    const {
      hospitalId,
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
    } = body;

    const finalAmbulanceUnit = (ambulanceUnit || ambulanceId || "").trim();
    const finalAmbulanceId = (ambulanceId || ambulanceUnit || "").trim();
    const finalPatientRef = (patientRef || patientReference || "").trim();
    const finalPatientReference = (patientReference || patientRef || "").trim();

    if (!hospitalId || !finalAmbulanceUnit || !bedCategoryCode) {
      return NextResponse.json(
        { error: "Missing required fields: hospitalId, ambulanceUnit/ambulanceId, bedCategoryCode" },
        { status: 400 }
      );
    }

    const numRequested = Math.max(1, Number(requestedBeds) || 1);
    const eta = Math.max(1, Number(etaMinutes) || 15);

    // Verify hospital exists and is active
    const [targetHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (!targetHospital) {
      return NextResponse.json(
        { error: "Selected hospital facility not found" },
        { status: 404 }
      );
    }

    if (targetHospital.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Selected hospital facility is currently inactive or deactivated." },
        { status: 400 }
      );
    }

    // Verify bed availability
    const [targetCategory] = await db
      .select()
      .from(bedCategories)
      .where(
        and(
          eq(bedCategories.hospitalId, hospitalId),
          eq(bedCategories.categoryCode, bedCategoryCode.toUpperCase())
        )
      )
      .limit(1);

    if (!targetCategory || targetCategory.availableBeds < numRequested) {
      return NextResponse.json(
        {
          error: `Insufficient available beds in ${bedCategoryCode}. Requested: ${numRequested}, Available: ${
            targetCategory ? targetCategory.availableBeds : 0
          }`,
        },
        { status: 400 }
      );
    }

    let validLat: number | null = null;
    let validLng: number | null = null;

    if (ambulanceLat !== undefined && ambulanceLat !== null && ambulanceLng !== undefined && ambulanceLng !== null) {
      const numLat = Number(ambulanceLat);
      const numLng = Number(ambulanceLng);
      if (isValidCoordinates(numLat, numLng)) {
        validLat = numLat;
        validLng = numLng;
      }
    }

    let distanceKm: number | null = null;
    if (validLat !== null && validLng !== null && targetHospital.latitude && targetHospital.longitude) {
      distanceKm = calculateDistanceKm(validLat, validLng, targetHospital.latitude, targetHospital.longitude);
    }

    const now = new Date();
    const newDispatchId = `disp_${Date.now()}`;
    const finalPatRef = finalPatientRef || `PAT-${Math.floor(1000 + Math.random() * 9000)}`;

    const [createdDispatch] = await db
      .insert(dispatchRequests)
      .values({
        id: newDispatchId,
        hospitalId,
        dispatcherSessionId: sessionId, // strictly server-side verified
        ambulanceUnit: finalAmbulanceUnit,
        ambulanceId: finalAmbulanceId || finalAmbulanceUnit,
        ambulanceLat: validLat,
        ambulanceLng: validLng,
        patientRef: finalPatRef,
        patientReference: finalPatientReference || finalPatRef,
        bedCategoryCode: bedCategoryCode.toUpperCase(),
        requestedBeds: numRequested,
        etaMinutes: eta,
        patientCondition: patientCondition || "Emergency pre-hospital alert",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const { logDispatchActivity } = await import("@/lib/activity-logger");
    await logDispatchActivity({
      dispatchId: createdDispatch.id,
      actorType: "DISPATCHER",
      action: "REQUEST_CREATED",
      details: `Pre-arrival alert transmitted to ${targetHospital.name}. Required: ${numRequested} ${bedCategoryCode.toUpperCase()} bed(s). ETA: ${eta}m.`,
      newValue: "PENDING",
    });

    const response = NextResponse.json(
      {
        success: true,
        distanceKm,
        dispatch: {
          ...createdDispatch,
          distanceKm,
          hospitalName: targetHospital.name,
          hospitalAddress: targetHospital.address,
          hospitalCity: targetHospital.city,
          hospitalState: targetHospital.state,
          hospitalPhone: targetHospital.phone,
          hospitalLat: targetHospital.latitude,
          hospitalLng: targetHospital.longitude,
        },
        sessionId,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );

    applyCookie(response);
    return response;
  } catch (error: any) {
    console.error("Failed to create dispatch request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

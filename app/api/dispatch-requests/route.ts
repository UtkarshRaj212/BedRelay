import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, bedCategories, hospitals } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateDistanceKm, isValidCoordinates } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || req.cookies.get("bedrelay_dispatcher_session_id")?.value;
    const ambulanceFilter = searchParams.get("ambulanceUnit");
    const statusFilter = searchParams.get("status");
    const categoryFilter = searchParams.get("category");
    const showAll = searchParams.get("all") === "true";

    // Base query conditions
    const conditions = [];

    // Filter by session ID unless explicitly requesting all or no session exists
    if (sessionId && !showAll) {
      conditions.push(eq(dispatchRequests.dispatcherSessionId, sessionId));
    }

    if (ambulanceFilter && ambulanceFilter.trim()) {
      conditions.push(eq(dispatchRequests.ambulanceUnit, ambulanceFilter.trim()));
    }

    if (statusFilter && statusFilter !== "ALL") {
      conditions.push(eq(dispatchRequests.status, statusFilter.toUpperCase()));
    }

    if (categoryFilter && categoryFilter !== "ALL") {
      conditions.push(eq(dispatchRequests.bedCategoryCode, categoryFilter.toUpperCase()));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rawDispatches = await db
      .select()
      .from(dispatchRequests)
      .where(whereClause)
      .orderBy(desc(dispatchRequests.createdAt))
      .limit(100);

    // Fetch all hospitals to enrich dispatch records
    const allHospitals = await db.select().from(hospitals);
    const hospitalMap = new Map(allHospitals.map((h) => [h.id, h]));

    const enrichedDispatches = rawDispatches.map((disp) => {
      const hosp = hospitalMap.get(disp.hospitalId);

      let distanceKm: number | null = null;
      if (
        disp.ambulanceLat !== null &&
        disp.ambulanceLng !== null &&
        hosp?.latitude &&
        hosp?.longitude
      ) {
        distanceKm = calculateDistanceKm(
          disp.ambulanceLat,
          disp.ambulanceLng,
          hosp.latitude,
          hosp.longitude
        );
      }

      return {
        ...disp,
        hospitalName: hosp?.name || "Unknown Hospital",
        hospitalAddress: hosp?.address || "",
        hospitalCity: hosp?.city || "",
        hospitalState: hosp?.state || "",
        hospitalPhone: hosp?.phone || "",
        distanceKm,
      };
    });

    return NextResponse.json(
      {
        success: true,
        dispatches: enrichedDispatches,
        count: enrichedDispatches.length,
        sessionId: sessionId || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to fetch dispatch requests:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      hospitalId,
      ambulanceUnit,
      ambulanceLat,
      ambulanceLng,
      patientRef,
      bedCategoryCode,
      requestedBeds,
      etaMinutes,
      patientCondition,
      dispatcherSessionId: incomingSessionId,
    } = body;

    if (!hospitalId || !ambulanceUnit || !bedCategoryCode) {
      return NextResponse.json(
        { error: "Missing required fields: hospitalId, ambulanceUnit, bedCategoryCode" },
        { status: 400 }
      );
    }

    // Resolve persistent dispatcher session ID
    let finalSessionId =
      incomingSessionId ||
      req.cookies.get("bedrelay_dispatcher_session_id")?.value;

    if (!finalSessionId) {
      const randomHex = Math.random().toString(36).substring(2, 10);
      finalSessionId = `disp_sess_${Date.now()}_${randomHex}`;
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
        { error: "Selected hospital facility is currently inactive or deactivated by EMS administration." },
        { status: 400 }
      );
    }

    // Verify bed availability in real database
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
          error: `Insufficient available beds in ${bedCategoryCode}. Requested: ${numRequested}, Currently Available: ${
            targetCategory ? targetCategory.availableBeds : 0
          }`,
        },
        { status: 400 }
      );
    }

    let validAmbulanceLat: number | null = null;
    let validAmbulanceLng: number | null = null;

    if (ambulanceLat !== undefined && ambulanceLat !== null && ambulanceLng !== undefined && ambulanceLng !== null) {
      const numLat = Number(ambulanceLat);
      const numLng = Number(ambulanceLng);
      if (isValidCoordinates(numLat, numLng)) {
        validAmbulanceLat = numLat;
        validAmbulanceLng = numLng;
      }
    }

    let distanceKm: number | null = null;
    if (validAmbulanceLat !== null && validAmbulanceLng !== null && targetHospital.latitude && targetHospital.longitude) {
      distanceKm = calculateDistanceKm(validAmbulanceLat, validAmbulanceLng, targetHospital.latitude, targetHospital.longitude);
    }

    const now = new Date();
    const newDispatchId = `disp_${Date.now()}`;

    const [createdDispatch] = await db
      .insert(dispatchRequests)
      .values({
        id: newDispatchId,
        hospitalId,
        dispatcherSessionId: finalSessionId,
        ambulanceUnit: ambulanceUnit.trim(),
        ambulanceLat: validAmbulanceLat,
        ambulanceLng: validAmbulanceLng,
        patientRef: patientRef ? patientRef.trim() : `PAT-${Math.floor(1000 + Math.random() * 9000)}`,
        bedCategoryCode: bedCategoryCode.toUpperCase(),
        requestedBeds: numRequested,
        etaMinutes: eta,
        patientCondition: patientCondition || "Emergency pre-hospital alert",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

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
          hospitalPhone: targetHospital.phone,
          hospitalLat: targetHospital.latitude,
          hospitalLng: targetHospital.longitude,
        },
        sessionId: finalSessionId,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );

    // Set persistent session cookie
    response.cookies.set("bedrelay_dispatcher_session_id", finalSessionId, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Failed to create dispatch request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, bedCategories, hospitals } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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
    } = body;

    if (!hospitalId || !ambulanceUnit || !bedCategoryCode) {
      return NextResponse.json(
        { error: "Missing required fields: hospitalId, ambulanceUnit, bedCategoryCode" },
        { status: 400 }
      );
    }

    const numRequested = Math.max(1, Number(requestedBeds) || 1);
    const eta = Math.max(1, Number(etaMinutes) || 15);

    // Verify hospital exists
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

    const now = new Date();
    const newDispatchId = `disp_${Date.now()}`;

    const [createdDispatch] = await db
      .insert(dispatchRequests)
      .values({
        id: newDispatchId,
        hospitalId,
        ambulanceUnit: ambulanceUnit.trim(),
        ambulanceLat: ambulanceLat ? Number(ambulanceLat) : null,
        ambulanceLng: ambulanceLng ? Number(ambulanceLng) : null,
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

    return NextResponse.json({
      success: true,
      dispatch: createdDispatch,
    });
  } catch (error: any) {
    console.error("Failed to create dispatch request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

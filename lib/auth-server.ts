import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getAuthenticatedHospital(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 }),
      hospital: null,
      session: null,
    };
  }

  const userId = session.user.id;

  let [hospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.userId, userId))
    .limit(1);

  if (!hospital) {
    const newHospitalId = `hosp_${Date.now()}`;
    const now = new Date();

    const [createdHospital] = await db
      .insert(hospitals)
      .values({
        id: newHospitalId,
        userId: userId,
        name: "City General Hospital & Emergency Centre",
        address: "Sector 14, Dwarka",
        city: "New Delhi",
        state: "Delhi",
        phone: "+91 11 2671 0000",
        latitude: 28.5921,
        longitude: 77.0460,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    hospital = createdHospital;

    // Seed default bed categories for new hospital
    const initialCategories = [
      {
        id: `cat_icu_${Date.now()}`,
        hospitalId: hospital.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit (ICU)",
        totalBeds: 24,
        availableBeds: 6,
        occupiedBeds: 18,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `cat_gen_${Date.now() + 1}`,
        hospitalId: hospital.id,
        categoryCode: "GENERAL",
        name: "General Ward",
        totalBeds: 120,
        availableBeds: 34,
        occupiedBeds: 86,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `cat_vent_${Date.now() + 2}`,
        hospitalId: hospital.id,
        categoryCode: "VENTILATOR",
        name: "Ventilator & Critical Care",
        totalBeds: 16,
        availableBeds: 4,
        occupiedBeds: 12,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await db.insert(bedCategories).values(initialCategories);

    // Seed initial sample dispatch request
    await db.insert(dispatchRequests).values({
      id: `disp_${Date.now()}`,
      hospitalId: hospital.id,
      ambulanceUnit: "108 EMS Unit-301",
      ambulanceLat: 28.6139,
      ambulanceLng: 77.2090,
      patientRef: `PAT-${Math.floor(1000 + Math.random() * 9000)}`,
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 12,
      patientCondition: "Acute Respiratory Distress — Pre-Arrival Alert",
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
  }

  return { errorResponse: null, hospital, session };
}

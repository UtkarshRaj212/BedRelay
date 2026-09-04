import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hospitals, hospitalMemberships, bedCategories } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user already has an active hospital membership
    const [existingMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(and(eq(hospitalMemberships.userId, userId), eq(hospitalMemberships.status, "ACTIVE")))
      .limit(1);

    if (existingMembership) {
      return NextResponse.json(
        { error: "Conflict: You are already affiliated with a hospital facility." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const { name, address, city, state, phone, latitude, longitude } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Hospital name is required" }, { status: 400 });
    }

    if (!city || !city.trim()) {
      return NextResponse.json({ error: "City is required" }, { status: 400 });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { error: "Valid numerical latitude and longitude coordinates are required" },
        { status: 400 }
      );
    }

    // Validate coordinates within Indian territory bounds (approx Lat: 6.5 to 37.5, Lng: 68.0 to 97.5)
    if (latNum < 6.5 || latNum > 37.5 || lngNum < 68.0 || lngNum > 97.5) {
      return NextResponse.json(
        {
          error:
            "Coordinates out of bounds. Hospital must be located within India (Latitude 6.5°N - 37.5°N, Longitude 68.0°E - 97.5°E).",
        },
        { status: 400 }
      );
    }

    // Strictly server-generated hospitalId
    const now = new Date();
    const hospitalId = `hosp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [createdHospital] = await db
      .insert(hospitals)
      .values({
        id: hospitalId,
        userId: userId,
        name: name.trim(),
        address: address ? address.trim() : "",
        city: city.trim(),
        state: state ? state.trim() : "India",
        phone: phone ? phone.trim() : "+91 11 2000 0000",
        latitude: latNum,
        longitude: lngNum,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Securely associate authenticated user as HOSPITAL_ADMIN
    const membershipId = `memb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const [createdMembership] = await db
      .insert(hospitalMemberships)
      .values({
        id: membershipId,
        hospitalId: createdHospital.id,
        userId: userId,
        role: "HOSPITAL_ADMIN",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Seed default starter bed categories for the new hospital
    const defaultCategories = [
      {
        id: `cat_icu_${Date.now()}_1`,
        hospitalId: createdHospital.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit (ICU)",
        totalBeds: 20,
        availableBeds: 5,
        occupiedBeds: 15,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `cat_gen_${Date.now()}_2`,
        hospitalId: createdHospital.id,
        categoryCode: "GENERAL",
        name: "General Medical Ward",
        totalBeds: 100,
        availableBeds: 25,
        occupiedBeds: 75,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `cat_vent_${Date.now()}_3`,
        hospitalId: createdHospital.id,
        categoryCode: "VENTILATOR",
        name: "Ventilator & Critical Care",
        totalBeds: 12,
        availableBeds: 3,
        occupiedBeds: 9,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `cat_ped_${Date.now()}_4`,
        hospitalId: createdHospital.id,
        categoryCode: "PEDIATRIC",
        name: "Pediatric Intensive Care (PICU)",
        totalBeds: 15,
        availableBeds: 4,
        occupiedBeds: 11,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await db.insert(bedCategories).values(defaultCategories);

    return NextResponse.json({
      success: true,
      hospital: createdHospital,
      membership: createdMembership,
    });
  } catch (error: any) {
    console.error("Failed to setup new hospital:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

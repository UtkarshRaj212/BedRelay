import { NextRequest, NextResponse } from "next/server";
import { assertSuperAdmin, recordAuditLog } from "@/lib/auth-server";
import { db } from "@/db";
import { hospitals, bedCategories, hospitalMemberships, dispatchRequests, user } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const allHospitals = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        address: hospitals.address,
        city: hospitals.city,
        state: hospitals.state,
        phone: hospitals.phone,
        latitude: hospitals.latitude,
        longitude: hospitals.longitude,
        status: hospitals.status,
        createdAt: hospitals.createdAt,
        updatedAt: hospitals.updatedAt,
        creatorName: user.name,
        creatorEmail: user.email,
      })
      .from(hospitals)
      .leftJoin(user, eq(hospitals.userId, user.id))
      .orderBy(desc(hospitals.createdAt));

    const allBeds = await db.select().from(bedCategories);
    const allMemberships = await db.select().from(hospitalMemberships);

    const enriched = allHospitals.map((hosp) => {
      const hospBeds = allBeds.filter((b) => b.hospitalId === hosp.id);
      const totalBeds = hospBeds.reduce((acc, b) => acc + b.totalBeds, 0);
      const availableBeds = hospBeds.reduce((acc, b) => acc + b.availableBeds, 0);
      const occupiedBeds = hospBeds.reduce((acc, b) => acc + b.occupiedBeds, 0);

      const hospStaff = allMemberships.filter((m) => m.hospitalId === hosp.id);

      return {
        ...hosp,
        beds: hospBeds,
        totalBeds,
        availableBeds,
        occupiedBeds,
        staffCount: hospStaff.length,
      };
    });

    return NextResponse.json({
      success: true,
      hospitals: enriched,
    });
  } catch (error: any) {
    console.error("SuperAdmin hospitals GET failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

import { isValidCoordinates } from "@/lib/geo";

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, user: superAdmin } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { name, address, city, state, phone, latitude, longitude, status } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Hospital name is required" }, { status: 400 });
    }

    if (!city || !state) {
      return NextResponse.json({ error: "City and State are required" }, { status: 400 });
    }

    let latNum = 20.5937;
    let lngNum = 78.9629;
    if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
      const parsedLat = Number(latitude);
      const parsedLng = Number(longitude);
      if (!isValidCoordinates(parsedLat, parsedLng)) {
        return NextResponse.json(
          { error: "Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180." },
          { status: 400 }
        );
      }
      latNum = parsedLat;
      lngNum = parsedLng;
    }
    const hospitalStatus = status === "DEACTIVATED" || status === "INACTIVE" ? status : "ACTIVE";

    const now = new Date();
    const hospitalId = `hosp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [createdHospital] = await db
      .insert(hospitals)
      .values({
        id: hospitalId,
        userId: superAdmin!.id,
        name: name.trim(),
        address: address ? String(address).trim() : null,
        city: String(city).trim(),
        state: String(state).trim(),
        phone: phone ? String(phone).trim() : null,
        latitude: latNum,
        longitude: lngNum,
        status: hospitalStatus,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Initialize baseline bed categories
    const initialCategories = [
      {
        id: `bed_${Date.now()}_icu_${Math.random().toString(36).substring(2, 6)}`,
        hospitalId,
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
        id: `bed_${Date.now()}_gen_${Math.random().toString(36).substring(2, 6)}`,
        hospitalId,
        categoryCode: "GENERAL",
        name: "General Ward",
        totalBeds: 100,
        availableBeds: 25,
        occupiedBeds: 75,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `bed_${Date.now()}_vent_${Math.random().toString(36).substring(2, 6)}`,
        hospitalId,
        categoryCode: "VENTILATOR",
        name: "Ventilator & Critical Care",
        totalBeds: 10,
        availableBeds: 3,
        occupiedBeds: 7,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await db.insert(bedCategories).values(initialCategories);

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "CREATE_HOSPITAL",
      resourceType: "HOSPITAL",
      resourceId: hospitalId,
      details: {
        name: createdHospital.name,
        city: createdHospital.city,
        state: createdHospital.state,
        status: createdHospital.status,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      hospital: createdHospital,
    });
  } catch (error: any) {
    console.error("SuperAdmin hospitals POST failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { errorResponse, user: superAdmin } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { hospitalId, name, address, city, state, phone, latitude, longitude, status } = body;

    if (!hospitalId) {
      return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
    }

    const [existingHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (!existingHospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    }

    const updateFields: Partial<typeof hospitals.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateFields.name = String(name).trim();
    if (address !== undefined) updateFields.address = String(address).trim();
    if (city !== undefined) updateFields.city = String(city).trim();
    if (state !== undefined) updateFields.state = String(state).trim();
    if (latitude !== undefined || longitude !== undefined) {
      const latToCheck = latitude !== undefined ? Number(latitude) : existingHospital.latitude;
      const lngToCheck = longitude !== undefined ? Number(longitude) : existingHospital.longitude;
      if (latToCheck !== null && lngToCheck !== null && !isValidCoordinates(latToCheck, lngToCheck)) {
        return NextResponse.json({ error: "Invalid coordinates provided. Latitude must be between -90 and 90, and longitude between -180 and 180." }, { status: 400 });
      }
      if (latitude !== undefined) updateFields.latitude = Number(latitude);
      if (longitude !== undefined) updateFields.longitude = Number(longitude);
    }
    if (status !== undefined) {
      if (status !== "ACTIVE" && status !== "DEACTIVATED" && status !== "INACTIVE") {
        return NextResponse.json({ error: "Invalid hospital status" }, { status: 400 });
      }
      updateFields.status = status;
    }

    const [updatedHospital] = await db
      .update(hospitals)
      .set(updateFields)
      .where(eq(hospitals.id, hospitalId))
      .returning();

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: status && status !== existingHospital.status ? `HOSPITAL_STATUS_${status}` : "UPDATE_HOSPITAL_IDENTITY",
      resourceType: "HOSPITAL",
      resourceId: hospitalId,
      details: {
        previous: {
          name: existingHospital.name,
          city: existingHospital.city,
          state: existingHospital.state,
          status: existingHospital.status,
        },
        updated: updateFields,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      hospital: updatedHospital,
    });
  } catch (error: any) {
    console.error("SuperAdmin hospitals PATCH failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { errorResponse, user: superAdmin } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const hospitalId = body.hospitalId || searchParams.get("hospitalId");

    if (!hospitalId) {
      return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
    }

    const [existingHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (!existingHospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    }

    // Safety relation check: ensure no active emergency dispatches are en-route or pending
    const activeDispatches = await db
      .select({ id: dispatchRequests.id, status: dispatchRequests.status, ambulanceUnit: dispatchRequests.ambulanceUnit })
      .from(dispatchRequests)
      .where(
        and(
          eq(dispatchRequests.hospitalId, hospitalId),
          inArray(dispatchRequests.status, ["PENDING", "ACCEPTED", "EN_ROUTE", "DISPATCHED"])
        )
      );

    if (activeDispatches.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete hospital '${existingHospital.name}'. There are ${activeDispatches.length} active emergency dispatch request(s) (${activeDispatches.map((d) => `${d.ambulanceUnit}: ${d.status}`).join(", ")}) associated with this facility. Please resolve, redirect, or cancel them first.`,
        },
        { status: 400 }
      );
    }

    // Delete hospital (foreign keys cascade-delete bed_categories, dispatch_requests, hospital_memberships, hospital_invitations)
    await db.delete(hospitals).where(eq(hospitals.id, hospitalId));

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "DELETE_HOSPITAL",
      resourceType: "HOSPITAL",
      resourceId: hospitalId,
      details: {
        deletedHospital: {
          id: existingHospital.id,
          name: existingHospital.name,
          city: existingHospital.city,
          state: existingHospital.state,
        },
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Hospital '${existingHospital.name}' and all associated telemetry removed successfully.`,
    });
  } catch (error: any) {
    console.error("SuperAdmin hospitals DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}


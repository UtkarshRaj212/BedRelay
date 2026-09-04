import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, hospitals, bedCategories, hospitalMemberships, user } from "@/db/schema";
import { calculateDistanceKm } from "@/lib/geo";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [dispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, id))
      .limit(1);

    if (!dispatch) {
      return NextResponse.json(
        { error: "Dispatch request not found" },
        { status: 404 }
      );
    }

    const [hospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, dispatch.hospitalId))
      .limit(1);

    const beds = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.hospitalId, dispatch.hospitalId));

    let distanceKm: number | null = null;
    if (
      dispatch.ambulanceLat !== null &&
      dispatch.ambulanceLng !== null &&
      hospital?.latitude &&
      hospital?.longitude
    ) {
      distanceKm = calculateDistanceKm(
        dispatch.ambulanceLat,
        dispatch.ambulanceLng,
        hospital.latitude,
        hospital.longitude
      );
    }

    return NextResponse.json({
      dispatch,
      hospital,
      beds,
      distanceKm,
    });
  } catch (error: any) {
    console.error("Failed to fetch dispatch request details:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized: Active staff or SuperAdmin session required to modify dispatch state." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const [existingDispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, id))
      .limit(1);

    if (!existingDispatch) {
      return NextResponse.json(
        { error: "Dispatch request not found" },
        { status: 404 }
      );
    }

    // Check authorization: SUPER_ADMIN or staff member of existingDispatch.hospitalId
    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    const isSuperAdmin = dbUser?.role === "SUPER_ADMIN";

    if (!isSuperAdmin) {
      const [membership] = await db
        .select()
        .from(hospitalMemberships)
        .where(
          and(
            eq(hospitalMemberships.userId, session.user.id),
            eq(hospitalMemberships.hospitalId, existingDispatch.hospitalId),
            eq(hospitalMemberships.status, "ACTIVE")
          )
        )
        .limit(1);

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to manage dispatches for this hospital." },
          { status: 403 }
        );
      }
    }

    const now = new Date();
    const [updatedDispatch] = await db
      .update(dispatchRequests)
      .set({
        status: status.toUpperCase(),
        updatedAt: now,
      })
      .where(eq(dispatchRequests.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      dispatch: updatedDispatch,
    });
  } catch (error: any) {
    console.error("Failed to update dispatch request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, hospitals, bedCategories, hospitalMemberships, user } from "@/db/schema";
import { calculateDistanceKm } from "@/lib/geo";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Dispatch request ID is required" }, { status: 400 });
    }

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

    // Role-based security check:
    // 1. If user is authenticated, check if SUPER_ADMIN or member of this hospital
    // 2. If unauthenticated (dispatcher), verify dispatcherSessionId matches
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user) {
      const [dbUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (dbUser?.role !== "SUPER_ADMIN") {
        const [membership] = await db
          .select()
          .from(hospitalMemberships)
          .where(
            and(
              eq(hospitalMemberships.userId, session.user.id),
              eq(hospitalMemberships.hospitalId, dispatch.hospitalId),
              eq(hospitalMemberships.status, "ACTIVE")
            )
          )
          .limit(1);

        if (!membership) {
          return NextResponse.json(
            { error: "Forbidden: You are not authorized to view dispatches for another hospital." },
            { status: 403 }
          );
        }
      }
    } else {
      // Dispatcher without login session
      const { searchParams } = new URL(req.url);
      const sessionId =
        searchParams.get("sessionId") ||
        req.cookies.get("bedrelay_dispatcher_session_id")?.value;

      if (dispatch.dispatcherSessionId && sessionId && dispatch.dispatcherSessionId !== sessionId) {
        return NextResponse.json(
          { error: "Forbidden: Access denied to this dispatch request." },
          { status: 403 }
        );
      }
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

    return NextResponse.json(
      {
        dispatch,
        hospital,
        beds,
        distanceKm,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
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
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Dispatch request ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const { status, dispatcherSessionId: bodySessionId } = body;

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"];
    const nextStatus = status.trim().toUpperCase();
    if (!validStatuses.includes(nextStatus)) {
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

    // Role-based authorization:
    // Case A: Dispatcher cancelling their own request
    const cookieSessionId = req.cookies.get("bedrelay_dispatcher_session_id")?.value;
    const clientSessionId = bodySessionId || cookieSessionId;
    const isDispatcherOwner =
      clientSessionId &&
      existingDispatch.dispatcherSessionId &&
      clientSessionId === existingDispatch.dispatcherSessionId;

    const session = await auth.api.getSession({ headers: req.headers });

    if (!session || !session.user) {
      if (nextStatus === "CANCELLED" && isDispatcherOwner) {
        // Permitted: Dispatcher cancelling their own pending dispatch
      } else {
        return NextResponse.json(
          { error: "Unauthorized: Active staff or SuperAdmin session required to modify dispatch state." },
          { status: 401 }
        );
      }
    } else {
      // Case B: Authenticated User (SUPER_ADMIN or Hospital Staff/Admin of target hospital)
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
    }

    const prevStatus = existingDispatch.status.toUpperCase();
    const now = new Date();

    // Atomic transaction with row-level locking for concurrency safety
    const updatedDispatch = await db.transaction(async (tx) => {
      // If transitioning from non-ACCEPTED to ACCEPTED, atomically allocate beds with row lock
      if (nextStatus === "ACCEPTED" && prevStatus !== "ACCEPTED") {
        const [cat] = await tx
          .select()
          .from(bedCategories)
          .where(
            and(
              eq(bedCategories.hospitalId, existingDispatch.hospitalId),
              eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase())
            )
          )
          .for("update")
          .limit(1);

        if (!cat || cat.availableBeds < existingDispatch.requestedBeds) {
          throw new Error(
            `Insufficient available beds in ${existingDispatch.bedCategoryCode}. Requested: ${existingDispatch.requestedBeds}, Available: ${
              cat ? cat.availableBeds : 0
            }. Cannot accept dispatch.`
          );
        }

        await tx
          .update(bedCategories)
          .set({
            availableBeds: cat.availableBeds - existingDispatch.requestedBeds,
            occupiedBeds: Math.min(cat.totalBeds, cat.occupiedBeds + existingDispatch.requestedBeds),
            lastUpdated: now,
            updatedAt: now,
          })
          .where(eq(bedCategories.id, cat.id));

        await tx
          .update(hospitals)
          .set({ updatedAt: now })
          .where(eq(hospitals.id, existingDispatch.hospitalId));
      } else if (
        (nextStatus === "REJECTED" || nextStatus === "CANCELLED") &&
        prevStatus === "ACCEPTED"
      ) {
        // Release allocated beds back to available pool
        const [cat] = await tx
          .select()
          .from(bedCategories)
          .where(
            and(
              eq(bedCategories.hospitalId, existingDispatch.hospitalId),
              eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase())
            )
          )
          .for("update")
          .limit(1);

        if (cat) {
          await tx
            .update(bedCategories)
            .set({
              availableBeds: Math.min(cat.totalBeds, cat.availableBeds + existingDispatch.requestedBeds),
              occupiedBeds: Math.max(0, cat.occupiedBeds - existingDispatch.requestedBeds),
              lastUpdated: now,
              updatedAt: now,
            })
            .where(eq(bedCategories.id, cat.id));

          await tx
            .update(hospitals)
            .set({ updatedAt: now })
            .where(eq(hospitals.id, existingDispatch.hospitalId));
        }
      }

      const [updated] = await tx
        .update(dispatchRequests)
        .set({
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(dispatchRequests.id, id))
        .returning();

      return updated;
    });

    return NextResponse.json(
      {
        success: true,
        dispatch: updatedDispatch,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to update dispatch request:", error);
    const isBadInput = error.message?.includes("Insufficient available beds");
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: isBadInput ? 400 : 500 }
    );
  }
}

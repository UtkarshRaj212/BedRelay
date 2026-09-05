import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital } from "@/lib/auth-server";
import { db } from "@/db";
import { dispatchRequests, bedCategories, hospitals } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (!hospital) return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });

    // Fetch dispatch requests scoped ONLY to the authenticated hospital
    const dispatches = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.hospitalId, hospital.id))
      .orderBy(desc(dispatchRequests.createdAt));

    return NextResponse.json(
      { hospital, dispatches },
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

export async function PATCH(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (!hospital) return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });

    const body = await req.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: requestId, status" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"];
    const nextStatus = status.toUpperCase();
    if (!validStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Authorization check: Verify that the dispatch request belongs to the authenticated hospital
    const [existingDispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, requestId))
      .limit(1);

    if (!existingDispatch) {
      return NextResponse.json(
        { error: "Dispatch request not found" },
        { status: 404 }
      );
    }

    if (existingDispatch.hospitalId !== hospital.id) {
      return NextResponse.json(
        { error: "Forbidden: Access denied. Dispatch request does not belong to your hospital." },
        { status: 403 }
      );
    }

    const prevStatus = existingDispatch.status.toUpperCase();
    const now = new Date();

    // If transitioning from non-ACCEPTED to ACCEPTED, atomically allocate beds
    if (nextStatus === "ACCEPTED" && prevStatus !== "ACCEPTED") {
      const [updatedCategory] = await db
        .update(bedCategories)
        .set({
          availableBeds: sql`${bedCategories.availableBeds} - ${existingDispatch.requestedBeds}`,
          occupiedBeds: sql`LEAST(${bedCategories.totalBeds}, ${bedCategories.occupiedBeds} + ${existingDispatch.requestedBeds})`,
          lastUpdated: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(bedCategories.hospitalId, hospital.id),
            eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase()),
            sql`${bedCategories.availableBeds} >= ${existingDispatch.requestedBeds}`
          )
        )
        .returning();

      if (!updatedCategory) {
        const [cat] = await db
          .select()
          .from(bedCategories)
          .where(
            and(
              eq(bedCategories.hospitalId, hospital.id),
              eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase())
            )
          )
          .limit(1);

        return NextResponse.json(
          {
            error: `Insufficient available beds in ${existingDispatch.bedCategoryCode}. Requested: ${existingDispatch.requestedBeds}, Available: ${
              cat ? cat.availableBeds : 0
            }. Cannot accept dispatch.`,
          },
          { status: 400 }
        );
      }

      await db
        .update(hospitals)
        .set({ updatedAt: now })
        .where(eq(hospitals.id, hospital.id));
    } else if ((nextStatus === "REJECTED" || nextStatus === "CANCELLED") && prevStatus === "ACCEPTED") {
      // Release allocated beds back to available pool
      await db
        .update(bedCategories)
        .set({
          availableBeds: sql`LEAST(${bedCategories.totalBeds}, ${bedCategories.availableBeds} + ${existingDispatch.requestedBeds})`,
          occupiedBeds: sql`GREATEST(0, ${bedCategories.occupiedBeds} - ${existingDispatch.requestedBeds})`,
          lastUpdated: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(bedCategories.hospitalId, hospital.id),
            eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase())
          )
        );

      await db
        .update(hospitals)
        .set({ updatedAt: now })
        .where(eq(hospitals.id, hospital.id));
    }

    const [updatedDispatch] = await db
      .update(dispatchRequests)
      .set({
        status: nextStatus,
        updatedAt: now,
      })
      .where(and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.hospitalId, hospital.id)))
      .returning();

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
    console.error("Failed to update dispatch request status:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

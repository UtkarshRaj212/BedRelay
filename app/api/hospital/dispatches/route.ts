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
    const { requestId, status, action, note, rejectionReason } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing required field: requestId" },
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

    if (hospital.status === "DEACTIVATED") {
      return NextResponse.json(
        { error: "Action Forbidden: This hospital facility has been deactivated by National SuperAdmin." },
        { status: 403 }
      );
    }

    const prevStatus = existingDispatch.status.toUpperCase();
    const now = new Date();

    // CASE 1: Hospital confirms Review Update
    if (action === "REVIEW_UPDATE") {
      const updated = await db.transaction(async (tx) => {
        let finalApproved = existingDispatch.approvedBeds;

        // If requested beds exceeds currently approved beds, allocate the difference
        if (existingDispatch.requestedBeds > existingDispatch.approvedBeds) {
          const additional = existingDispatch.requestedBeds - existingDispatch.approvedBeds;
          const [cat] = await tx
            .select()
            .from(bedCategories)
            .where(
              and(
                eq(bedCategories.hospitalId, hospital.id),
                eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase())
              )
            )
            .for("update")
            .limit(1);

          if (!cat || cat.availableBeds < additional) {
            throw new Error(
              `Insufficient available beds in ${existingDispatch.bedCategoryCode}. Needed: ${additional}, Available: ${
                cat ? cat.availableBeds : 0
              }. Cannot approve additional beds.`
            );
          }

          await tx
            .update(bedCategories)
            .set({
              availableBeds: cat.availableBeds - additional,
              occupiedBeds: Math.min(cat.totalBeds, cat.occupiedBeds + additional),
              lastUpdated: now,
              updatedAt: now,
            })
            .where(eq(bedCategories.id, cat.id));

          finalApproved = existingDispatch.requestedBeds;
        }

        const [disp] = await tx
          .update(dispatchRequests)
          .set({
            approvedBeds: finalApproved,
            reviewRequired: false,
            reviewReason: null,
            updatedAt: now,
          })
          .where(eq(dispatchRequests.id, requestId))
          .returning();

        const { logDispatchActivity } = await import("@/lib/activity-logger");
        await logDispatchActivity(
          {
            dispatchId: requestId,
            actorType: "HOSPITAL",
            actorName: hospital.name,
            action: "HOSPITAL_REVIEWED",
            details: `Hospital reviewed update. Approved beds: ${finalApproved}.`,
            note: note ? String(note).trim() : "Review confirmed by hospital clinical team.",
          },
          tx
        );

        return disp;
      });

      return NextResponse.json(
        { success: true, dispatch: updated, message: "Review confirmed successfully." },
        { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
      );
    }

    // CASE 2: Standard Status Transitions (ACCEPTED, REJECTED, etc.)
    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status or action" },
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

    // Atomic transaction with row-level locking for concurrency safety
    const updatedDispatch = await db.transaction(async (tx) => {
      let finalApprovedBeds = existingDispatch.approvedBeds;
      const finalRejectionReason = nextStatus === "REJECTED"
        ? (rejectionReason ? String(rejectionReason).trim() : "ICU capacity unavailable.")
        : existingDispatch.rejectionReason;

      // If transitioning from non-ACCEPTED to ACCEPTED, atomically allocate beds with row lock
      if (nextStatus === "ACCEPTED" && prevStatus !== "ACCEPTED") {
        const [cat] = await tx
          .select()
          .from(bedCategories)
          .where(
            and(
              eq(bedCategories.hospitalId, hospital.id),
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
          .where(eq(hospitals.id, hospital.id));

        finalApprovedBeds = existingDispatch.requestedBeds;
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
              eq(bedCategories.hospitalId, hospital.id),
              eq(bedCategories.categoryCode, existingDispatch.bedCategoryCode.toUpperCase())
            )
          )
          .for("update")
          .limit(1);

        if (cat) {
          const bedsToRelease = existingDispatch.approvedBeds || existingDispatch.requestedBeds;
          await tx
            .update(bedCategories)
            .set({
              availableBeds: Math.min(cat.totalBeds, cat.availableBeds + bedsToRelease),
              occupiedBeds: Math.max(0, cat.occupiedBeds - bedsToRelease),
              lastUpdated: now,
              updatedAt: now,
            })
            .where(eq(bedCategories.id, cat.id));

          await tx
            .update(hospitals)
            .set({ updatedAt: now })
            .where(eq(hospitals.id, hospital.id));
        }

        finalApprovedBeds = 0;
      }

      const [updated] = await tx
        .update(dispatchRequests)
        .set({
          status: nextStatus,
          approvedBeds: finalApprovedBeds,
          rejectionReason: finalRejectionReason,
          updatedAt: now,
        })
        .where(and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.hospitalId, hospital.id)))
        .returning();

      const { logDispatchActivity } = await import("@/lib/activity-logger");
      if (nextStatus === "ACCEPTED") {
        await logDispatchActivity(
          {
            dispatchId: requestId,
            actorType: "HOSPITAL",
            actorName: hospital.name,
            action: "ACCEPTED",
            details: `Hospital accepted pre-arrival alert. ${finalApprovedBeds} bed(s) approved.`,
            note: note ? String(note).trim() : undefined,
          },
          tx
        );
      } else if (nextStatus === "REJECTED") {
        await logDispatchActivity(
          {
            dispatchId: requestId,
            actorType: "HOSPITAL",
            actorName: hospital.name,
            action: "REJECTED",
            details: `Hospital rejected dispatch request.`,
            note: finalRejectionReason || undefined,
          },
          tx
        );
      }

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
    console.error("Failed to update dispatch request status:", error);
    const isBadInput = error.message?.includes("Insufficient available beds");
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: isBadInput ? 400 : 500 }
    );
  }
}

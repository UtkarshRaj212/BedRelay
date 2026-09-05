import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital } from "@/lib/auth-server";
import { db } from "@/db";
import { bedCategories, dispatchRequests, hospitals } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, hospital, membership, needsOnboarding } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;

    if (needsOnboarding || !hospital) {
      return NextResponse.json({
        needsOnboarding: true,
        hospital: null,
        membership: null,
        beds: [],
        dispatches: [],
      });
    }

    // Fetch bed categories scoped to authenticated hospital
    const beds = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.hospitalId, hospital.id));

    // Fetch recent dispatch requests scoped to authenticated hospital
    const dispatches = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.hospitalId, hospital.id))
      .orderBy(desc(dispatchRequests.createdAt))
      .limit(5);

    return NextResponse.json(
      {
        hospital,
        membership,
        beds,
        dispatches,
        needsOnboarding: false,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to fetch hospital telemetry:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, hospital, needsOnboarding } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (needsOnboarding || !hospital) {
      return NextResponse.json({ error: "Onboarding required before updating beds" }, { status: 403 });
    }

    if (hospital.status === "DEACTIVATED") {
      return NextResponse.json(
        { error: "Action Forbidden: This hospital facility has been deactivated by National SuperAdmin." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { categoryId, availableBeds, totalBeds } = body;

    if (!categoryId || availableBeds === undefined || totalBeds === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: categoryId, availableBeds, totalBeds" },
        { status: 400 }
      );
    }

    const availNum = Number(availableBeds);
    const totalNum = Number(totalBeds);

    if (isNaN(availNum) || isNaN(totalNum)) {
      return NextResponse.json(
        { error: "Invalid bed count values provided" },
        { status: 400 }
      );
    }

    if (availNum < 0) {
      return NextResponse.json(
        { error: "Available beds cannot be negative" },
        { status: 400 }
      );
    }

    if (totalNum < 0) {
      return NextResponse.json(
        { error: "Total capacity cannot be negative" },
        { status: 400 }
      );
    }

    if (availNum > totalNum) {
      return NextResponse.json(
        { error: "Available beds cannot exceed total capacity" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Concurrency-safe atomic transaction
    const updatedCategory = await db.transaction(async (tx) => {
      const [existingCategory] = await tx
        .select()
        .from(bedCategories)
        .where(eq(bedCategories.id, categoryId))
        .for("update")
        .limit(1);

      if (!existingCategory) {
        throw new Error("Bed category not found");
      }

      if (existingCategory.hospitalId !== hospital.id) {
        throw new Error("Forbidden: Access denied. Resource does not belong to your hospital.");
      }

      const occupiedBeds = Math.max(0, totalNum - availNum);

      const [updated] = await tx
        .update(bedCategories)
        .set({
          availableBeds: availNum,
          totalBeds: totalNum,
          occupiedBeds,
          lastUpdated: now,
          updatedAt: now,
        })
        .where(and(eq(bedCategories.id, categoryId), eq(bedCategories.hospitalId, hospital.id)))
        .returning();

      // Touch hospital record updatedAt
      await tx
        .update(hospitals)
        .set({ updatedAt: now })
        .where(eq(hospitals.id, hospital.id));

      return updated;
    });

    return NextResponse.json(
      {
        success: true,
        category: updatedCategory,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to update bed capacity:", error);
    const isForbidden = error.message?.includes("Forbidden");
    const isNotFound = error.message?.includes("not found");
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: isForbidden ? 403 : isNotFound ? 404 : 500 }
    );
  }
}

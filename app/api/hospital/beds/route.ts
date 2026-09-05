import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital } from "@/lib/auth-server";
import { db } from "@/db";
import { bedCategories, hospitals } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (!hospital) return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });

    // Fetch beds scoped ONLY to the authenticated hospital
    const beds = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.hospitalId, hospital.id));

    return NextResponse.json(
      { hospital, beds },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to fetch hospital beds:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (!hospital) return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });

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

    // Validation checks: available >= 0, total >= 0, available <= total
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

    // Concurrency-safe atomic transaction with row locking
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

      // Touch hospital record updatedAt so listeners and search queries detect freshness
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

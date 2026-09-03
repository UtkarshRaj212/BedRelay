import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital } from "@/lib/auth-server";
import { db } from "@/db";
import { bedCategories, dispatchRequests } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse || !hospital) return errorResponse!;

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

    return NextResponse.json({
      hospital,
      beds,
      dispatches,
    });
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
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse || !hospital) return errorResponse!;

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

    // Verify ownership of the categoryId
    const [existingCategory] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, categoryId))
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (existingCategory.hospitalId !== hospital.id) {
      return NextResponse.json(
        { error: "Forbidden: Access denied. Resource does not belong to your hospital." },
        { status: 403 }
      );
    }

    const now = new Date();
    const occupiedBeds = Math.max(0, totalNum - availNum);

    const [updatedCategory] = await db
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

    return NextResponse.json({
      success: true,
      category: updatedCategory,
    });
  } catch (error: any) {
    console.error("Failed to update bed capacity:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

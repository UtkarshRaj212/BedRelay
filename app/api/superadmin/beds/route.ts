import { NextRequest, NextResponse } from "next/server";
import { assertSuperAdmin, recordAuditLog } from "@/lib/auth-server";
import { db } from "@/db";
import { bedCategories, hospitals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const hospitalId = searchParams.get("hospitalId");

    let query = db
      .select({
        id: bedCategories.id,
        hospitalId: bedCategories.hospitalId,
        hospitalName: hospitals.name,
        hospitalCity: hospitals.city,
        categoryCode: bedCategories.categoryCode,
        name: bedCategories.name,
        totalBeds: bedCategories.totalBeds,
        availableBeds: bedCategories.availableBeds,
        occupiedBeds: bedCategories.occupiedBeds,
        lastUpdated: bedCategories.lastUpdated,
        createdAt: bedCategories.createdAt,
      })
      .from(bedCategories)
      .innerJoin(hospitals, eq(bedCategories.hospitalId, hospitals.id))
      .orderBy(desc(bedCategories.lastUpdated));

    const beds = hospitalId
      ? (await query).filter((b) => b.hospitalId === hospitalId)
      : await query;

    return NextResponse.json({
      success: true,
      beds,
    });
  } catch (error: any) {
    console.error("SuperAdmin beds GET failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, user: superAdmin } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { hospitalId, categoryCode, name, totalBeds, availableBeds } = body;

    if (!hospitalId || !categoryCode || !name) {
      return NextResponse.json(
        { error: "hospitalId, categoryCode, and name are required" },
        { status: 400 }
      );
    }

    const [targetHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (!targetHospital) {
      return NextResponse.json({ error: "Target hospital not found" }, { status: 404 });
    }

    const total = Math.max(0, Number(totalBeds) || 0);
    const available = Math.max(0, Number(availableBeds) || 0);

    if (available > total) {
      return NextResponse.json(
        { error: "Available beds cannot exceed total capacity" },
        { status: 400 }
      );
    }

    const occupied = Math.max(0, total - available);
    const now = new Date();
    const cleanCode = categoryCode.trim().toUpperCase();
    const bedId = `bed_${Date.now()}_${cleanCode.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;

    const [created] = await db
      .insert(bedCategories)
      .values({
        id: bedId,
        hospitalId,
        categoryCode: cleanCode,
        name: name.trim(),
        totalBeds: total,
        availableBeds: available,
        occupiedBeds: occupied,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "CREATE_BED_CATEGORY",
      resourceType: "BED_CATEGORY",
      resourceId: bedId,
      details: {
        hospitalId,
        hospitalName: targetHospital.name,
        categoryCode: cleanCode,
        totalBeds: total,
        availableBeds: available,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      category: created,
    });
  } catch (error: any) {
    console.error("SuperAdmin beds POST failed:", error);
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
    const { categoryId, totalBeds, availableBeds, name } = body;

    if (!categoryId) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Bed category record not found" }, { status: 404 });
    }

    const total = totalBeds !== undefined ? Number(totalBeds) : existing.totalBeds;
    const available = availableBeds !== undefined ? Number(availableBeds) : existing.availableBeds;

    if (isNaN(total) || isNaN(available) || total < 0 || available < 0) {
      return NextResponse.json({ error: "Invalid numeric bed values" }, { status: 400 });
    }

    if (available > total) {
      return NextResponse.json(
        { error: "Available beds cannot exceed total capacity" },
        { status: 400 }
      );
    }

    const occupied = Math.max(0, total - available);
    const now = new Date();

    const [updated] = await db
      .update(bedCategories)
      .set({
        name: name ? String(name).trim() : existing.name,
        totalBeds: total,
        availableBeds: available,
        occupiedBeds: occupied,
        lastUpdated: now,
        updatedAt: now,
      })
      .where(eq(bedCategories.id, categoryId))
      .returning();

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "UPDATE_BED_CAPACITY",
      resourceType: "BED_CATEGORY",
      resourceId: categoryId,
      details: {
        hospitalId: existing.hospitalId,
        categoryCode: existing.categoryCode,
        previous: { total: existing.totalBeds, available: existing.availableBeds },
        updated: { total, available, occupied },
      },
      req,
    });

    return NextResponse.json({
      success: true,
      category: updated,
    });
  } catch (error: any) {
    console.error("SuperAdmin beds PATCH failed:", error);
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
    const categoryId = body.categoryId || searchParams.get("categoryId");

    if (!categoryId) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Bed category record not found" }, { status: 404 });
    }

    await db.delete(bedCategories).where(eq(bedCategories.id, categoryId));

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "DELETE_BED_CATEGORY",
      resourceType: "BED_CATEGORY",
      resourceId: categoryId,
      details: {
        hospitalId: existing.hospitalId,
        categoryCode: existing.categoryCode,
        name: existing.name,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Bed category '${existing.name}' deleted successfully`,
    });
  } catch (error: any) {
    console.error("SuperAdmin beds DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

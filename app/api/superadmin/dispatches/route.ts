import { NextRequest, NextResponse } from "next/server";
import { assertSuperAdmin, recordAuditLog } from "@/lib/auth-server";
import { db } from "@/db";
import { dispatchRequests, hospitals } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const hospitalId = searchParams.get("hospitalId");
    const status = searchParams.get("status");

    const allDispatches = await db
      .select({
        id: dispatchRequests.id,
        hospitalId: dispatchRequests.hospitalId,
        hospitalName: hospitals.name,
        hospitalCity: hospitals.city,
        hospitalState: hospitals.state,
        ambulanceUnit: dispatchRequests.ambulanceUnit,
        ambulanceLat: dispatchRequests.ambulanceLat,
        ambulanceLng: dispatchRequests.ambulanceLng,
        patientRef: dispatchRequests.patientRef,
        bedCategoryCode: dispatchRequests.bedCategoryCode,
        requestedBeds: dispatchRequests.requestedBeds,
        etaMinutes: dispatchRequests.etaMinutes,
        patientCondition: dispatchRequests.patientCondition,
        status: dispatchRequests.status,
        createdAt: dispatchRequests.createdAt,
        updatedAt: dispatchRequests.updatedAt,
      })
      .from(dispatchRequests)
      .innerJoin(hospitals, eq(dispatchRequests.hospitalId, hospitals.id))
      .orderBy(desc(dispatchRequests.createdAt));

    let filtered = allDispatches;
    if (hospitalId) {
      filtered = filtered.filter((d) => d.hospitalId === hospitalId);
    }
    if (status && status !== "ALL") {
      filtered = filtered.filter((d) => d.status.toUpperCase() === status.toUpperCase());
    }

    return NextResponse.json({
      success: true,
      dispatches: filtered,
    });
  } catch (error: any) {
    console.error("SuperAdmin dispatches GET failed:", error);
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
    const { dispatchId, status } = body;

    if (!dispatchId || !status) {
      return NextResponse.json(
        { error: "dispatchId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, dispatchId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Dispatch request not found" }, { status: 404 });
    }

    const now = new Date();
    const [updated] = await db
      .update(dispatchRequests)
      .set({
        status: status.toUpperCase(),
        updatedAt: now,
      })
      .where(eq(dispatchRequests.id, dispatchId))
      .returning();

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "SUPERADMIN_UPDATE_DISPATCH_STATUS",
      resourceType: "DISPATCH_REQUEST",
      resourceId: dispatchId,
      details: {
        hospitalId: existing.hospitalId,
        ambulanceUnit: existing.ambulanceUnit,
        previousStatus: existing.status,
        newStatus: status.toUpperCase(),
      },
      req,
    });

    return NextResponse.json({
      success: true,
      dispatch: updated,
    });
  } catch (error: any) {
    console.error("SuperAdmin dispatches PATCH failed:", error);
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
    const dispatchId = body.dispatchId || searchParams.get("dispatchId");

    if (!dispatchId) {
      return NextResponse.json({ error: "dispatchId is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, dispatchId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Dispatch request not found" }, { status: 404 });
    }

    await db.delete(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "DELETE_DISPATCH_REQUEST",
      resourceType: "DISPATCH_REQUEST",
      resourceId: dispatchId,
      details: {
        hospitalId: existing.hospitalId,
        ambulanceUnit: existing.ambulanceUnit,
        patientRef: existing.patientRef,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Dispatch request '${dispatchId}' deleted successfully.`,
    });
  } catch (error: any) {
    console.error("SuperAdmin dispatches DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { assertSuperAdmin, recordAuditLog } from "@/lib/auth-server";
import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests, hospitalMemberships, auditLogs, user } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, user: superAdmin } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    // 1. Hospital counts
    const allHospitals = await db.select({
      id: hospitals.id,
      status: hospitals.status,
    }).from(hospitals);

    const totalHospitals = allHospitals.length;
    const activeHospitals = allHospitals.filter((h) => h.status === "ACTIVE").length;
    const deactivatedHospitals = allHospitals.filter((h) => h.status !== "ACTIVE").length;

    // 2. Bed Telemetry across all hospitals
    const allBeds = await db.select().from(bedCategories);
    let totalBeds = 0;
    let availableBeds = 0;
    let occupiedBeds = 0;
    const categoryBreakdown: Record<string, { total: number; available: number; occupied: number }> = {};

    for (const b of allBeds) {
      totalBeds += b.totalBeds;
      availableBeds += b.availableBeds;
      occupiedBeds += b.occupiedBeds;

      if (!categoryBreakdown[b.categoryCode]) {
        categoryBreakdown[b.categoryCode] = { total: 0, available: 0, occupied: 0 };
      }
      categoryBreakdown[b.categoryCode].total += b.totalBeds;
      categoryBreakdown[b.categoryCode].available += b.availableBeds;
      categoryBreakdown[b.categoryCode].occupied += b.occupiedBeds;
    }

    // 3. Dispatch Requests across all hospitals
    const allDispatches = await db.select({
      id: dispatchRequests.id,
      status: dispatchRequests.status,
    }).from(dispatchRequests);

    const totalDispatches = allDispatches.length;
    const pendingDispatches = allDispatches.filter((d) => d.status === "PENDING").length;
    const acceptedDispatches = allDispatches.filter((d) => d.status === "ACCEPTED").length;
    const completedDispatches = allDispatches.filter((d) => d.status === "COMPLETED").length;

    // 4. Staff counts across all hospitals
    const allMemberships = await db.select({
      id: hospitalMemberships.id,
      role: hospitalMemberships.role,
      status: hospitalMemberships.status,
    }).from(hospitalMemberships);

    const totalStaff = allMemberships.length;
    const hospitalAdmins = allMemberships.filter((m) => m.role === "HOSPITAL_ADMIN").length;
    const hospitalStaff = allMemberships.filter((m) => m.role === "HOSPITAL_STAFF").length;

    // 5. Recent audit logs
    const recentAuditLogs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.userId, user.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      stats: {
        hospitals: {
          total: totalHospitals,
          active: activeHospitals,
          deactivated: deactivatedHospitals,
        },
        beds: {
          total: totalBeds,
          available: availableBeds,
          occupied: occupiedBeds,
          occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
          categories: categoryBreakdown,
        },
        dispatches: {
          total: totalDispatches,
          pending: pendingDispatches,
          accepted: acceptedDispatches,
          completed: completedDispatches,
          active: pendingDispatches + acceptedDispatches,
        },
        staff: {
          total: totalStaff,
          admins: hospitalAdmins,
          staff: hospitalStaff,
        },
      },
      recentAuditLogs,
    });
  } catch (error: any) {
    console.error("Failed to fetch superadmin statistics:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

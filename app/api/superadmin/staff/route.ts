import { NextRequest, NextResponse } from "next/server";
import { assertSuperAdmin, recordAuditLog } from "@/lib/auth-server";
import { db } from "@/db";
import { hospitalMemberships, hospitals, user } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const allStaff = await db
      .select({
        membershipId: hospitalMemberships.id,
        hospitalId: hospitalMemberships.hospitalId,
        hospitalName: hospitals.name,
        hospitalCity: hospitals.city,
        userId: hospitalMemberships.userId,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        role: hospitalMemberships.role,
        status: hospitalMemberships.status,
        joinedAt: hospitalMemberships.createdAt,
      })
      .from(hospitalMemberships)
      .innerJoin(hospitals, eq(hospitalMemberships.hospitalId, hospitals.id))
      .innerJoin(user, eq(hospitalMemberships.userId, user.id))
      .orderBy(desc(hospitalMemberships.createdAt));

    return NextResponse.json({
      success: true,
      staff: allStaff,
    });
  } catch (error: any) {
    console.error("SuperAdmin staff GET failed:", error);
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
    const { hospitalId, email, name, role } = body;

    if (!hospitalId || !email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "hospitalId and email are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const assignedRole = role === "HOSPITAL_ADMIN" ? "HOSPITAL_ADMIN" : "HOSPITAL_STAFF";

    const [targetHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (!targetHospital) {
      return NextResponse.json({ error: "Target hospital not found" }, { status: 404 });
    }

    // Find or create user
    const now = new Date();
    let [targetUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, cleanEmail))
      .limit(1);

    if (!targetUser) {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const userName = name && typeof name === "string" && name.trim() ? name.trim() : cleanEmail.split("@")[0];

      const [createdUser] = await db
        .insert(user)
        .values({
          id: newUserId,
          name: userName,
          email: cleanEmail,
          emailVerified: true,
          role: "USER",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      targetUser = createdUser;
    }

    // Check if membership already exists for this hospital
    const [existingMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(
        and(
          eq(hospitalMemberships.hospitalId, hospitalId),
          eq(hospitalMemberships.userId, targetUser.id)
        )
      )
      .limit(1);

    let finalMembership;

    if (existingMembership) {
      // Update role & activate
      const [updated] = await db
        .update(hospitalMemberships)
        .set({
          role: assignedRole,
          status: "ACTIVE",
          updatedAt: now,
        })
        .where(eq(hospitalMemberships.id, existingMembership.id))
        .returning();
      finalMembership = updated;
    } else {
      const membId = `memb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const [created] = await db
        .insert(hospitalMemberships)
        .values({
          id: membId,
          hospitalId,
          userId: targetUser.id,
          role: assignedRole,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      finalMembership = created;
    }

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "SUPERADMIN_ADD_STAFF",
      resourceType: "HOSPITAL_MEMBERSHIP",
      resourceId: finalMembership.id,
      details: {
        hospitalId,
        hospitalName: targetHospital.name,
        targetEmail: cleanEmail,
        assignedRole,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      membership: finalMembership,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (error: any) {
    console.error("SuperAdmin staff POST failed:", error);
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
    const { membershipId, role, status } = body;

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    const [existingMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(eq(hospitalMemberships.id, membershipId))
      .limit(1);

    if (!existingMembership) {
      return NextResponse.json({ error: "Membership record not found" }, { status: 404 });
    }

    const updateFields: Partial<typeof hospitalMemberships.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (role !== undefined) {
      if (role !== "HOSPITAL_ADMIN" && role !== "HOSPITAL_STAFF") {
        return NextResponse.json({ error: "Invalid role. Must be HOSPITAL_ADMIN or HOSPITAL_STAFF" }, { status: 400 });
      }
      updateFields.role = role;
    }

    if (status !== undefined) {
      if (status !== "ACTIVE" && status !== "SUSPENDED") {
        return NextResponse.json({ error: "Invalid status. Must be ACTIVE or SUSPENDED" }, { status: 400 });
      }
      updateFields.status = status;
    }

    const [updatedMembership] = await db
      .update(hospitalMemberships)
      .set(updateFields)
      .where(eq(hospitalMemberships.id, membershipId))
      .returning();

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "UPDATE_STAFF_MEMBERSHIP",
      resourceType: "HOSPITAL_MEMBERSHIP",
      resourceId: membershipId,
      details: {
        hospitalId: existingMembership.hospitalId,
        targetUserId: existingMembership.userId,
        previous: {
          role: existingMembership.role,
          status: existingMembership.status,
        },
        updated: updateFields,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      membership: updatedMembership,
    });
  } catch (error: any) {
    console.error("SuperAdmin staff PATCH failed:", error);
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

    const body = await req.json();
    const { membershipId } = body;

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    const [existingMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(eq(hospitalMemberships.id, membershipId))
      .limit(1);

    if (!existingMembership) {
      return NextResponse.json({ error: "Membership record not found" }, { status: 404 });
    }

    await db.delete(hospitalMemberships).where(eq(hospitalMemberships.id, membershipId));

    // Record audit log
    await recordAuditLog({
      userId: superAdmin!.id,
      action: "REVOKE_STAFF_MEMBERSHIP",
      resourceType: "HOSPITAL_MEMBERSHIP",
      resourceId: membershipId,
      details: {
        hospitalId: existingMembership.hospitalId,
        targetUserId: existingMembership.userId,
        revokedRole: existingMembership.role,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Staff membership revoked successfully",
    });
  } catch (error: any) {
    console.error("SuperAdmin staff DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

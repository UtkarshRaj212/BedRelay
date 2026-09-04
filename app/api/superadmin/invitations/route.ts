import { NextRequest, NextResponse } from "next/server";
import { assertSuperAdmin, recordAuditLog } from "@/lib/auth-server";
import { db } from "@/db";
import { hospitalInvitations, hospitals, user } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

function generateInviteCode(): string {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "BR-";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await assertSuperAdmin(req);
    if (errorResponse) return errorResponse;

    const invitations = await db
      .select({
        id: hospitalInvitations.id,
        hospitalId: hospitalInvitations.hospitalId,
        hospitalName: hospitals.name,
        hospitalCity: hospitals.city,
        code: hospitalInvitations.code,
        email: hospitalInvitations.email,
        role: hospitalInvitations.role,
        status: hospitalInvitations.status,
        expiresAt: hospitalInvitations.expiresAt,
        createdAt: hospitalInvitations.createdAt,
        inviterName: user.name,
        inviterEmail: user.email,
      })
      .from(hospitalInvitations)
      .innerJoin(hospitals, eq(hospitalInvitations.hospitalId, hospitals.id))
      .leftJoin(user, eq(hospitalInvitations.invitedByUserId, user.id))
      .orderBy(desc(hospitalInvitations.createdAt));

    return NextResponse.json({
      success: true,
      invitations,
    });
  } catch (error: any) {
    console.error("SuperAdmin invitations GET failed:", error);
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
    const { hospitalId, email, role } = body;

    if (!hospitalId) {
      return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
    }

    const [targetHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (!targetHospital) {
      return NextResponse.json({ error: "Target hospital not found" }, { status: 404 });
    }

    const assignedRole = role === "HOSPITAL_ADMIN" ? "HOSPITAL_ADMIN" : "HOSPITAL_STAFF";
    const cleanEmail = email && typeof email === "string" && email.trim().length > 0 ? email.trim().toLowerCase() : null;

    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const [exists] = await db
        .select()
        .from(hospitalInvitations)
        .where(eq(hospitalInvitations.code, inviteCode))
        .limit(1);
      if (!exists) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [createdInvitation] = await db
      .insert(hospitalInvitations)
      .values({
        id: invitationId,
        hospitalId,
        code: inviteCode,
        email: cleanEmail,
        role: assignedRole,
        invitedByUserId: superAdmin!.id,
        status: "PENDING",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await recordAuditLog({
      userId: superAdmin!.id,
      action: "SUPERADMIN_CREATE_INVITATION",
      resourceType: "HOSPITAL_INVITATION",
      resourceId: invitationId,
      details: {
        hospitalId,
        hospitalName: targetHospital.name,
        code: inviteCode,
        email: cleanEmail,
        role: assignedRole,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      invitation: createdInvitation,
    });
  } catch (error: any) {
    console.error("SuperAdmin invitations POST failed:", error);
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
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(hospitalInvitations)
      .where(eq(hospitalInvitations.id, invitationId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const now = new Date();
    await db
      .update(hospitalInvitations)
      .set({
        status: "REVOKED",
        updatedAt: now,
      })
      .where(eq(hospitalInvitations.id, invitationId));

    await recordAuditLog({
      userId: superAdmin!.id,
      action: "SUPERADMIN_REVOKE_INVITATION",
      resourceType: "HOSPITAL_INVITATION",
      resourceId: invitationId,
      details: {
        hospitalId: existing.hospitalId,
        code: existing.code,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (error: any) {
    console.error("SuperAdmin invitations DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

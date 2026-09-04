import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital, assertHospitalAdmin } from "@/lib/auth-server";
import { db } from "@/db";
import { hospitalInvitations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

export async function POST(req: NextRequest) {
  try {
    const { errorResponse, hospital, membership, needsOnboarding, session } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;

    if (needsOnboarding || !hospital || !session) {
      return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });
    }


    // Authorization: Only HOSPITAL_ADMIN can invite staff or administrators
    const roleError = assertHospitalAdmin(membership);
    if (roleError) return roleError;

    const body = await req.json();
    const { email, role } = body;

    // Validate role
    const assignedRole = role === "HOSPITAL_ADMIN" ? "HOSPITAL_ADMIN" : "HOSPITAL_STAFF";

    // Clean optional email
    const cleanEmail = email && typeof email === "string" && email.trim().length > 0 ? email.trim().toLowerCase() : null;

    // Generate unique invitation code
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
    // 7-day expiration
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [createdInvitation] = await db
      .insert(hospitalInvitations)
      .values({
        id: invitationId,
        hospitalId: hospital.id,
        code: inviteCode,
        email: cleanEmail,
        role: assignedRole,
        invitedByUserId: session.user.id,
        status: "PENDING",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({
      success: true,
      invitation: createdInvitation,
    });
  } catch (error: any) {
    console.error("Failed to generate staff invitation:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { errorResponse, hospital, membership, needsOnboarding } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;

    if (needsOnboarding || !hospital) {
      return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });
    }

    // Authorization: Only HOSPITAL_ADMIN can revoke invitations
    const roleError = assertHospitalAdmin(membership);
    if (roleError) return roleError;

    const body = await req.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    }

    // Check invitation belongs to this hospital
    const [existing] = await db
      .select()
      .from(hospitalInvitations)
      .where(
        and(
          eq(hospitalInvitations.id, invitationId),
          eq(hospitalInvitations.hospitalId, hospital.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Invitation not found or does not belong to your hospital" },
        { status: 404 }
      );
    }

    const now = new Date();
    await db
      .update(hospitalInvitations)
      .set({
        status: "REVOKED",
        updatedAt: now,
      })
      .where(
        and(
          eq(hospitalInvitations.id, invitationId),
          eq(hospitalInvitations.hospitalId, hospital.id)
        )
      );

    return NextResponse.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (error: any) {
    console.error("Failed to revoke invitation:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

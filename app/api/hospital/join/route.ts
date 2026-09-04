import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hospitals, hospitalMemberships, hospitalInvitations } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

// GET: Validate and preview invitation details
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: "Invitation code is required" }, { status: 400 });
    }

    const [invitation] = await db
      .select({
        id: hospitalInvitations.id,
        code: hospitalInvitations.code,
        role: hospitalInvitations.role,
        email: hospitalInvitations.email,
        status: hospitalInvitations.status,
        expiresAt: hospitalInvitations.expiresAt,
        hospitalId: hospitalInvitations.hospitalId,
      })
      .from(hospitalInvitations)
      .where(eq(hospitalInvitations.code, code))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation code. Facility invitation not found." }, { status: 404 });
    }

    const now = new Date();
    if (invitation.status !== "PENDING" || new Date(invitation.expiresAt) <= now) {
      return NextResponse.json(
        { error: "This invitation code has expired or has already been used/revoked." },
        { status: 410 }
      );
    }

    const [hospital] = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        city: hospitals.city,
        state: hospitals.state,
        phone: hospitals.phone,
      })
      .from(hospitals)
      .where(eq(hospitals.id, invitation.hospitalId))
      .limit(1);

    if (!hospital) {
      return NextResponse.json({ error: "Associated hospital facility not found." }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        code: invitation.code,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
      hospital,
    });
  } catch (error: any) {
    console.error("Failed to preview invitation:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

// POST: Accept invitation and join hospital
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized: Active Google session required" }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email.toLowerCase();

    const body = await req.json();
    const inviteCode = body.inviteCode?.trim().toUpperCase();

    if (!inviteCode) {
      return NextResponse.json({ error: "Invitation code is required" }, { status: 400 });
    }

    // Find invitation
    const [invitation] = await db
      .select()
      .from(hospitalInvitations)
      .where(eq(hospitalInvitations.code, inviteCode))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation code." }, { status: 404 });
    }

    const now = new Date();
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `This invitation is no longer active (Status: ${invitation.status}).` },
        { status: 400 }
      );
    }

    if (new Date(invitation.expiresAt) <= now) {
      await db
        .update(hospitalInvitations)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(eq(hospitalInvitations.id, invitation.id));

      return NextResponse.json({ error: "This invitation code has expired." }, { status: 410 });
    }

    // If invitation is locked to a specific email, verify
    if (invitation.email && invitation.email.trim().toLowerCase() !== userEmail) {
      return NextResponse.json(
        {
          error: `This invitation was issued specifically for ${invitation.email}. You are currently signed in as ${session.user.email}.`,
        },
        { status: 403 }
      );
    }

    // Check if user is already a member of this hospital
    const [existingMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(
        and(
          eq(hospitalMemberships.hospitalId, invitation.hospitalId),
          eq(hospitalMemberships.userId, userId)
        )
      )
      .limit(1);

    if (existingMembership) {
      if (existingMembership.status === "ACTIVE") {
        return NextResponse.json(
          { error: "You are already an active member of this hospital facility." },
          { status: 409 }
        );
      }
      // Re-activate if suspended
      const [reactivated] = await db
        .update(hospitalMemberships)
        .set({
          status: "ACTIVE",
          role: invitation.role,
          updatedAt: now,
        })
        .where(eq(hospitalMemberships.id, existingMembership.id))
        .returning();

      await db
        .update(hospitalInvitations)
        .set({ status: "ACCEPTED", updatedAt: now })
        .where(eq(hospitalInvitations.id, invitation.id));

      return NextResponse.json({
        success: true,
        membership: reactivated,
      });
    }

    // Mark invitation as accepted
    await db
      .update(hospitalInvitations)
      .set({ status: "ACCEPTED", updatedAt: now })
      .where(eq(hospitalInvitations.id, invitation.id));

    // Create new membership record
    const membershipId = `memb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const [createdMembership] = await db
      .insert(hospitalMemberships)
      .values({
        id: membershipId,
        hospitalId: invitation.hospitalId,
        userId: userId,
        role: invitation.role,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [hospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, invitation.hospitalId))
      .limit(1);

    return NextResponse.json({
      success: true,
      hospital,
      membership: createdMembership,
    });
  } catch (error: any) {
    console.error("Failed to join hospital:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

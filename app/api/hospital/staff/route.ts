import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital, assertHospitalAdmin } from "@/lib/auth-server";
import { db } from "@/db";
import { hospitalMemberships, hospitalInvitations, user } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, hospital, membership, needsOnboarding } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;

    if (needsOnboarding || !hospital) {
      return NextResponse.json({ error: "Hospital facility onboarding required" }, { status: 403 });
    }

    // Role check: Only HOSPITAL_ADMIN can view or manage staff rosters
    const roleError = assertHospitalAdmin(membership);
    if (roleError) return roleError;

    // Fetch all members of this hospital with user details
    const members = await db
      .select({
        membershipId: hospitalMemberships.id,
        userId: hospitalMemberships.userId,
        role: hospitalMemberships.role,
        status: hospitalMemberships.status,
        joinedAt: hospitalMemberships.createdAt,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(hospitalMemberships)
      .innerJoin(user, eq(hospitalMemberships.userId, user.id))
      .where(eq(hospitalMemberships.hospitalId, hospital.id))
      .orderBy(desc(hospitalMemberships.createdAt));

    // Fetch active invitations for this hospital
    const invitations = await db
      .select({
        id: hospitalInvitations.id,
        code: hospitalInvitations.code,
        email: hospitalInvitations.email,
        role: hospitalInvitations.role,
        status: hospitalInvitations.status,
        expiresAt: hospitalInvitations.expiresAt,
        createdAt: hospitalInvitations.createdAt,
      })
      .from(hospitalInvitations)
      .where(
        and(
          eq(hospitalInvitations.hospitalId, hospital.id),
          eq(hospitalInvitations.status, "PENDING")
        )
      )
      .orderBy(desc(hospitalInvitations.createdAt));

    return NextResponse.json({
      hospital: {
        id: hospital.id,
        name: hospital.name,
        city: hospital.city,
        state: hospital.state,
        status: hospital.status,
      },
      currentRole: membership?.role,
      members,
      invitations,
    });
  } catch (error: any) {
    console.error("Failed to fetch hospital staff:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { errorResponse, hospital, membership, needsOnboarding } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;

    if (needsOnboarding || !hospital || !membership) {
      return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });
    }

    const roleError = assertHospitalAdmin(membership);
    if (roleError) return roleError;

    const body = await req.json();
    const { membershipId, role, status } = body;

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    // Verify target membership belongs to THIS hospital
    const [targetMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(
        and(
          eq(hospitalMemberships.id, membershipId),
          eq(hospitalMemberships.hospitalId, hospital.id)
        )
      )
      .limit(1);

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Member not found or does not belong to your hospital" },
        { status: 404 }
      );
    }

    // Prevent admin from removing their own admin privileges if they are the sole admin
    if (targetMembership.userId === membership.userId && role && role !== "HOSPITAL_ADMIN") {
      const otherAdmins = await db
        .select()
        .from(hospitalMemberships)
        .where(
          and(
            eq(hospitalMemberships.hospitalId, hospital.id),
            eq(hospitalMemberships.role, "HOSPITAL_ADMIN"),
            eq(hospitalMemberships.status, "ACTIVE")
          )
        );

      if (otherAdmins.length <= 1) {
        return NextResponse.json(
          { error: "Cannot demote yourself: The hospital must retain at least one active administrator." },
          { status: 400 }
        );
      }
    }

    const updateFields: Partial<typeof hospitalMemberships.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (role !== undefined) {
      if (role !== "HOSPITAL_ADMIN" && role !== "HOSPITAL_STAFF") {
        return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
      }
      updateFields.role = role;
    }

    if (status !== undefined) {
      if (status !== "ACTIVE" && status !== "SUSPENDED") {
        return NextResponse.json({ error: "Invalid status specified" }, { status: 400 });
      }
      updateFields.status = status;
    }

    const [updated] = await db
      .update(hospitalMemberships)
      .set(updateFields)
      .where(
        and(
          eq(hospitalMemberships.id, membershipId),
          eq(hospitalMemberships.hospitalId, hospital.id)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      membership: updated,
    });
  } catch (error: any) {
    console.error("Failed to update staff membership:", error);
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

    if (needsOnboarding || !hospital || !membership) {
      return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });
    }

    const roleError = assertHospitalAdmin(membership);
    if (roleError) return roleError;

    const body = await req.json();
    const { membershipId } = body;

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    // Verify membership belongs to THIS hospital
    const [targetMembership] = await db
      .select()
      .from(hospitalMemberships)
      .where(
        and(
          eq(hospitalMemberships.id, membershipId),
          eq(hospitalMemberships.hospitalId, hospital.id)
        )
      )
      .limit(1);

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Member not found or does not belong to your hospital" },
        { status: 404 }
      );
    }

    if (targetMembership.userId === membership.userId) {
      return NextResponse.json(
        { error: "Cannot revoke your own membership from here." },
        { status: 400 }
      );
    }

    await db
      .delete(hospitalMemberships)
      .where(
        and(
          eq(hospitalMemberships.id, membershipId),
          eq(hospitalMemberships.hospitalId, hospital.id)
        )
      );

    return NextResponse.json({
      success: true,
      message: "Staff member removed successfully",
    });
  } catch (error: any) {
    console.error("Failed to remove staff member:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}


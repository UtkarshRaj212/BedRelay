import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hospitals, hospitalMemberships, user, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";


export interface AuthenticatedHospitalContext {
  errorResponse: NextResponse | null;
  hospital: typeof hospitals.$inferSelect | null;
  membership: typeof hospitalMemberships.$inferSelect | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
  needsOnboarding: boolean;
}


export async function getAuthenticatedHospital(req: NextRequest): Promise<AuthenticatedHospitalContext> {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 }),
      hospital: null,
      membership: null,
      session: null,
      needsOnboarding: false,
    };
  }

  const userId = session.user.id;

  // 1. Look up existing active hospital membership
  const [activeMembership] = await db
    .select()
    .from(hospitalMemberships)
    .where(and(eq(hospitalMemberships.userId, userId), eq(hospitalMemberships.status, "ACTIVE")))
    .limit(1);

  let membership = activeMembership || null;
  let hospital: typeof hospitals.$inferSelect | null = null;

  if (membership) {
    const [hosp] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, membership.hospitalId))
      .limit(1);
    hospital = hosp || null;
  }

  // 2. Backward compatibility fallback: check if user is the creator of a hospital
  if (!hospital) {
    const [ownedHospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.userId, userId))
      .limit(1);

    if (ownedHospital) {
      hospital = ownedHospital;
      const now = new Date();
      // Ensure owner has HOSPITAL_ADMIN membership
      const [newMembership] = await db
        .insert(hospitalMemberships)
        .values({
          id: `memb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          hospitalId: ownedHospital.id,
          userId: userId,
          role: "HOSPITAL_ADMIN",
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();

      if (newMembership) {
        membership = newMembership;
      } else {
        const [existingMemb] = await db
          .select()
          .from(hospitalMemberships)
          .where(
            and(
              eq(hospitalMemberships.hospitalId, ownedHospital.id),
              eq(hospitalMemberships.userId, userId)
            )
          )
          .limit(1);
        membership = existingMemb || null;
      }
    }
  }

  // 3. If user has no associated hospital, flag for onboarding
  if (!hospital || !membership) {
    return {
      errorResponse: null,
      hospital: null,
      membership: null,
      session,
      needsOnboarding: true,
    };
  }

  return {
    errorResponse: null,
    hospital,
    membership,
    session,
    needsOnboarding: false,
  };
}

export function assertHospitalAdmin(membership: { role: string } | null | undefined): NextResponse | null {
  if (!membership || membership.role !== "HOSPITAL_ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Only Hospital Administrators can perform this action." },
      { status: 403 }
    );
  }
  return null;
}

export interface AuthenticatedUserContext {
  errorResponse: NextResponse | null;
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
  user: typeof user.$inferSelect | null;
}

/**
 * Validates session and fetches the verified user record directly from database.
 * This guarantees the user's role cannot be spoofed by outdated or tampered client tokens.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUserContext> {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 }),
      session: null,
      user: null,
    };
  }

  const [dbUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!dbUser) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized: User record not found" }, { status: 401 }),
      session: null,
      user: null,
    };
  }

  return {
    errorResponse: null,
    session,
    user: dbUser,
  };
}

/**
 * Strict server-side verification: Only users with role === 'SUPER_ADMIN' in the database are permitted.
 */
export async function assertSuperAdmin(req: NextRequest): Promise<AuthenticatedUserContext> {
  const authContext = await getAuthenticatedUser(req);
  if (authContext.errorResponse) {
    return authContext;
  }

  if (authContext.user?.role !== "SUPER_ADMIN") {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: SuperAdmin clearance required." },
        { status: 403 }
      ),
      session: authContext.session,
      user: authContext.user,
    };
  }

  return authContext;
}

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, any> | string | null;
  req?: NextRequest | null;
}

/**
 * Records an immutable audit log entry in the database.
 */
export async function recordAuditLog({
  userId = null,
  action,
  resourceType,
  resourceId = null,
  details = null,
  req = null,
}: AuditLogParams) {
  try {
    let ipAddress: string | null = null;
    if (req) {
      ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null;
    }

    const detailsStr = typeof details === "object" ? JSON.stringify(details) : details;

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      action,
      resourceType,
      resourceId,
      details: detailsStr,
      ipAddress,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to write audit log entry:", error);
  }
}


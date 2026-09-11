import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, dispatchActivities, user, hospitalMemberships } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isWithinRetentionWindow, calculateRetentionDeadline } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const [dispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, id))
      .limit(1);

    if (!dispatch) {
      return NextResponse.json({ error: "Dispatch request not found" }, { status: 404 });
    }

    // Role-based security check:
    // 1. SuperAdmin -> Always permitted
    // 2. Member of destination hospital -> Permitted
    // 3. Dispatcher / Ambulance driver owner of this request -> Permitted
    // 4. Authenticated user who is NOT staff of a competing hospital -> Permitted (acting as ambulance driver/dispatcher)
    // 5. If authenticated user IS staff of a DIFFERENT hospital (and not dispatcher owner) -> Forbidden
    // 6. If unauthenticated, but an explicit contradictory sessionId parameter is provided -> Forbidden
    const { searchParams } = new URL(req.url);
    const cookieSessionId = req.cookies.get("bedrelay_dispatcher_session_id")?.value;
    const paramSessionId = searchParams.get("sessionId");
    const currentSessionId = paramSessionId || cookieSessionId;

    const isOwnerDispatcher = Boolean(
      dispatch.dispatcherSessionId &&
      currentSessionId &&
      (dispatch.dispatcherSessionId === currentSessionId ||
       dispatch.dispatcherSessionId === cookieSessionId ||
       dispatch.dispatcherSessionId === paramSessionId)
    );

    const session = await auth.api.getSession({ headers: req.headers });
    let isSuperAdmin = false;
    let isHospitalMember = false;

    if (session?.user) {
      const [dbUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      isSuperAdmin = dbUser?.role === "SUPER_ADMIN";

      if (!isSuperAdmin) {
        const [membership] = await db
          .select()
          .from(hospitalMemberships)
          .where(
            and(
              eq(hospitalMemberships.userId, session.user.id),
              eq(hospitalMemberships.hospitalId, dispatch.hospitalId),
              eq(hospitalMemberships.status, "ACTIVE")
            )
          )
          .limit(1);

        isHospitalMember = Boolean(membership);
      }
    }

    if (!isSuperAdmin && !isHospitalMember && !isOwnerDispatcher) {
      if (session?.user) {
        const [otherMembership] = await db
          .select()
          .from(hospitalMemberships)
          .where(
            and(
              eq(hospitalMemberships.userId, session.user.id),
              eq(hospitalMemberships.status, "ACTIVE")
            )
          )
          .limit(1);

        if (otherMembership) {
          return NextResponse.json(
            { error: "Forbidden: You are not authorized to view activity for another hospital." },
            { status: 403 }
          );
        }
      } else if (paramSessionId && dispatch.dispatcherSessionId && paramSessionId !== dispatch.dispatcherSessionId) {
        return NextResponse.json(
          { error: "Forbidden: Access denied to this dispatch activity timeline." },
          { status: 403 }
        );
      }
    }

    const isVisible = isWithinRetentionWindow(dispatch.createdAt, dispatch.etaMinutes);
    const retentionDeadline = calculateRetentionDeadline(dispatch.createdAt, dispatch.etaMinutes);

    const activities = await db
      .select()
      .from(dispatchActivities)
      .where(eq(dispatchActivities.dispatchId, id))
      .orderBy(asc(dispatchActivities.timestamp));

    return NextResponse.json(
      {
        success: true,
        dispatchId: id,
        activities,
        isVisible,
        retentionDeadline: retentionDeadline.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to fetch dispatch timeline:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

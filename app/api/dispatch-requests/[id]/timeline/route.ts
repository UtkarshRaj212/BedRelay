import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, dispatchActivities } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
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

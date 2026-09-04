import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedHospital } from "@/lib/auth-server";
import { db } from "@/db";
import { dispatchRequests } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (!hospital) return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });

    // Fetch dispatch requests scoped ONLY to the authenticated hospital
    const dispatches = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.hospitalId, hospital.id))
      .orderBy(desc(dispatchRequests.createdAt));

    return NextResponse.json({ hospital, dispatches });
  } catch (error: any) {
    console.error("Failed to fetch dispatch requests:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { errorResponse, hospital } = await getAuthenticatedHospital(req);
    if (errorResponse) return errorResponse;
    if (!hospital) return NextResponse.json({ error: "Hospital onboarding required" }, { status: 403 });


    const body = await req.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: requestId, status" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Authorization check: Verify that the dispatch request belongs to the authenticated hospital
    const [existingDispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, requestId))
      .limit(1);

    if (!existingDispatch) {
      return NextResponse.json(
        { error: "Dispatch request not found" },
        { status: 404 }
      );
    }

    if (existingDispatch.hospitalId !== hospital.id) {
      return NextResponse.json(
        { error: "Forbidden: Access denied. Dispatch request does not belong to your hospital." },
        { status: 403 }
      );
    }

    const now = new Date();
    const [updatedDispatch] = await db
      .update(dispatchRequests)
      .set({
        status: status.toUpperCase(),
        updatedAt: now,
      })
      .where(and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.hospitalId, hospital.id)))
      .returning();

    return NextResponse.json({
      success: true,
      dispatch: updatedDispatch,
    });
  } catch (error: any) {
    console.error("Failed to update dispatch request status:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

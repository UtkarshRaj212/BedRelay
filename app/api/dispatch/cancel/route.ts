import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerDispatcherSession,
  cancelActiveDispatchTx,
} from "@/lib/dispatcher-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, applyCookie } = resolveServerDispatcherSession(req);

    const cancelledDispatch = await cancelActiveDispatchTx(sessionId);

    const res = NextResponse.json(
      {
        success: true,
        message: "Active dispatch request cancelled successfully.",
        dispatch: cancelledDispatch,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );

    applyCookie(res);
    return res;
  } catch (error: any) {
    console.error("Failed to cancel active dispatch:", error);
    const isClientError = error.message?.includes("No active dispatch request");
    return NextResponse.json(
      { error: error.message || "Failed to cancel active dispatch." },
      { status: isClientError ? 404 : 500 }
    );
  }
}

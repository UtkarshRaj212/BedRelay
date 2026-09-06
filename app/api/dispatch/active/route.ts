import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerDispatcherSession,
  getActiveDispatchForSession,
  getLastRejectedDispatchForSession,
} from "@/lib/dispatcher-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { sessionId, applyCookie } = resolveServerDispatcherSession(req);
    const activeDispatch = await getActiveDispatchForSession(sessionId);
    const lastRejectedDispatch = !activeDispatch
      ? await getLastRejectedDispatchForSession(sessionId)
      : null;

    const res = NextResponse.json(
      {
        success: true,
        sessionId,
        activeDispatch,
        lastRejectedDispatch,
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
    console.error("Failed to fetch active dispatch:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

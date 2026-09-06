import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerDispatcherSession,
  switchReceivingHospitalTx,
} from "@/lib/dispatcher-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, applyCookie } = resolveServerDispatcherSession(req);
    const body = await req.json();

    const {
      targetHospitalId,
      ambulanceUnit,
      ambulanceId,
      ambulanceLat,
      ambulanceLng,
      patientRef,
      patientReference,
      bedCategoryCode,
      requestedBeds,
      etaMinutes,
      patientCondition,
    } = body;

    if (!targetHospitalId) {
      return NextResponse.json(
        { error: "Target receiving hospital ID is required." },
        { status: 400 }
      );
    }

    const result = await switchReceivingHospitalTx({
      sessionId,
      targetHospitalId,
      ambulanceUnit,
      ambulanceId,
      ambulanceLat,
      ambulanceLng,
      patientRef,
      patientReference,
      bedCategoryCode,
      requestedBeds,
      etaMinutes,
      patientCondition,
    });

    const res = NextResponse.json(
      {
        success: true,
        message: "Successfully switched receiving hospital.",
        cancelledDispatchId: result.cancelledDispatchId,
        dispatch: result.newDispatch,
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
    console.error("Failed to switch hospital:", error);
    const isClientError =
      error.message?.includes("Insufficient beds") ||
      error.message?.includes("No active dispatch request") ||
      error.message?.includes("not found");

    return NextResponse.json(
      { error: error.message || "Failed to switch hospital" },
      { status: isClientError ? 400 : 500 }
    );
  }
}

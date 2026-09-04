import { NextRequest, NextResponse } from "next/server";
import { seedIndianHospitals } from "@/lib/seed-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceReset = searchParams.get("reset") === "true";

    const result = await seedIndianHospitals(forceReset);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to seed database:", error);
    return NextResponse.json(
      { error: "Failed to seed database", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceReset = body.reset === true;

    const result = await seedIndianHospitals(forceReset);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to seed database:", error);
    return NextResponse.json(
      { error: "Failed to seed database", message: error.message },
      { status: 500 }
    );
  }
}

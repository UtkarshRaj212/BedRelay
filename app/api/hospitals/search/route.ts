import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hospitals, bedCategories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get("category"); // ICU, GENERAL, VENTILATOR

    const allHospitals = await db.select().from(hospitals);
    const allBeds = await db.select().from(bedCategories);

    const result = allHospitals.map((hosp) => {
      let hospBeds = allBeds.filter((b) => b.hospitalId === hosp.id);
      if (categoryFilter && categoryFilter !== "ALL") {
        hospBeds = hospBeds.filter((b) => b.categoryCode === categoryFilter);
      }

      const totalAvailable = hospBeds.reduce((acc, b) => acc + b.availableBeds, 0);
      const totalBeds = hospBeds.reduce((acc, b) => acc + b.totalBeds, 0);

      return {
        ...hosp,
        beds: hospBeds,
        totalAvailable,
        totalBeds,
      };
    });

    return NextResponse.json({ hospitals: result });
  } catch (error: any) {
    console.error("Failed to search hospital beds:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

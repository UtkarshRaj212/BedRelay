import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests } from "@/db/schema";
import { calculateDistanceKm, INDIAN_CITIES } from "@/lib/geo";
import { seedIndianHospitals } from "@/lib/seed-service";
import { desc, eq } from "drizzle-orm";

// Maximum radius (km) for a hospital to be considered "local" to the selected city
const LOCAL_DISPATCH_RADIUS_KM = 50;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await seedIndianHospitals(false);

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";
    const minBeds = parseInt(searchParams.get("minBeds") || "1", 10);
    const userLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
    const userLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null;
    const cityParam = searchParams.get("city");

    // Only ACTIVE hospitals are surfaced for EMS dispatch availability
    const allHospitals = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.status, "ACTIVE"));
    const allBeds = await db.select().from(bedCategories);

    const activeDispatches = await db
      .select()
      .from(dispatchRequests)
      .orderBy(desc(dispatchRequests.createdAt))
      .limit(10);

    // Resolve the search origin coordinates from city name or explicit lat/lng
    let originLat: number | null = userLat;
    let originLng: number | null = userLng;
    const cleanCity = cityParam ? cityParam.split(",")[0].trim().toLowerCase() : null;

    if (originLat === null && originLng === null && cleanCity) {
      const cityPreset = INDIAN_CITIES.find(
        (c) => c.name.toLowerCase() === cleanCity
      );
      if (cityPreset) {
        originLat = cityPreset.lat;
        originLng = cityPreset.lng;
      }
    }

    // Build result for each hospital, computing distance and suitability
    const enriched = allHospitals.map((hosp) => {
      const hospBeds = allBeds.filter((b) => b.hospitalId === hosp.id);

      // Compute distance from origin
      let distanceKm: number | null = null;
      if (originLat !== null && originLng !== null && hosp.latitude && hosp.longitude) {
        distanceKm = calculateDistanceKm(originLat, originLng, hosp.latitude, hosp.longitude);
      }

      // Check if hospital is in the selected city by name match
      const isDirectCityMatch =
        cleanCity && hosp.city
          ? hosp.city.toLowerCase() === cleanCity ||
            cleanCity === hosp.city.toLowerCase()
          : false;

      // Hospital is "local" if city name matches or it's within dispatch radius
      const isLocal = cleanCity
        ? isDirectCityMatch || (distanceKm !== null && distanceKm <= LOCAL_DISPATCH_RADIUS_KM)
        : true; // No city filter => all hospitals are considered

      // Compute bed availability for the requested category
      let targetCategoryBeds = 0;
      if (category !== "ALL") {
        const catBed = hospBeds.find(
          (b) => b.categoryCode.toUpperCase() === category.toUpperCase()
        );
        targetCategoryBeds = catBed ? catBed.availableBeds : 0;
      } else {
        targetCategoryBeds = hospBeds.reduce((acc, b) => acc + b.availableBeds, 0);
      }

      const totalAvailable = hospBeds.reduce((acc, b) => acc + b.availableBeds, 0);
      const totalBeds = hospBeds.reduce((acc, b) => acc + b.totalBeds, 0);

      // Suitable = local hospital with enough beds in the required category
      const isSuitable = isLocal && targetCategoryBeds >= minBeds;

      return {
        ...hosp,
        beds: hospBeds,
        totalAvailable,
        totalBeds,
        targetCategoryBeds,
        distanceKm,
        isLocal,
        isSuitable,
      };
    });

    // Enrich dispatches with hospital name and location
    const enrichedDispatches = activeDispatches.map((disp) => {
      const hospInfo = allHospitals.find((h) => h.id === disp.hospitalId);
      return {
        ...disp,
        hospitalName: hospInfo?.name || "Unknown Hospital",
        hospitalCity: hospInfo?.city || "",
        hospitalState: hospInfo?.state || "",
      };
    });

    // ONLY return hospitals that are local to the selected city.
    // Out-of-city hospitals are completely excluded from the response.
    const localHospitals = enriched.filter((h) => h.isLocal);

    // Sort: suitable first, then by distance, then by available capacity
    localHospitals.sort((a, b) => {
      if (a.isSuitable !== b.isSuitable) return a.isSuitable ? -1 : 1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return b.totalAvailable - a.totalAvailable;
    });

    return NextResponse.json(
      {
        hospitals: localHospitals,
        activeDispatches: enrichedDispatches,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to fetch hospital telemetry for dispatcher:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

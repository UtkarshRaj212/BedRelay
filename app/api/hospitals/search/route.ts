import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests } from "@/db/schema";
import { calculateDistanceKm, INDIAN_CITIES, isValidCoordinates } from "@/lib/geo";
import { seedIndianHospitals } from "@/lib/seed-service";
import { desc, eq } from "drizzle-orm";

// Maximum radius (km) for a hospital to be considered "local" to the selected city or GPS position
const LOCAL_DISPATCH_RADIUS_KM = 50;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await seedIndianHospitals(false);

    const [allHospitals, allBeds, activeDispatches] = await Promise.all([
      db.select().from(hospitals).where(eq(hospitals.status, "ACTIVE")),
      db.select().from(bedCategories),
      db
        .select()
        .from(dispatchRequests)
        .where(eq(dispatchRequests.status, "PENDING"))
        .orderBy(desc(dispatchRequests.createdAt)),
    ]);

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";
    const minBeds = parseInt(searchParams.get("minBeds") || "1", 10);
    const rawLat = searchParams.get("lat");
    const rawLng = searchParams.get("lng");
    const cityParam = searchParams.get("city");

    let originLat: number | null = null;
    let originLng: number | null = null;
    let hasExactCoordinates = false;

    if (rawLat !== null && rawLng !== null) {
      const parsedLat = parseFloat(rawLat);
      const parsedLng = parseFloat(rawLng);
      if (!isValidCoordinates(parsedLat, parsedLng)) {
        return NextResponse.json(
          {
            error: "Invalid GPS coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.",
          },
          { status: 400 }
        );
      }
      originLat = parsedLat;
      originLng = parsedLng;
      hasExactCoordinates = true;
    }

    const cleanCity = cityParam ? cityParam.split(",")[0].trim().toLowerCase() : null;

    // Fall back to city preset center ONLY if exact GPS coordinates were not provided
    if (!hasExactCoordinates && cleanCity) {
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

      // Compute distance from origin using Haversine
      let distanceKm: number | null = null;
      if (originLat !== null && originLng !== null && hosp.latitude && hosp.longitude) {
        distanceKm = calculateDistanceKm(originLat, originLng, hosp.latitude, hosp.longitude);
      }

      // If exact coordinates are provided, locality is determined STRICTLY by coordinate proximity.
      // We do NOT allow a mismatched city parameter (e.g. default 'chennai') to falsely mark far-away hospitals as local.
      let isLocal = false;
      if (hasExactCoordinates) {
        isLocal = distanceKm !== null && distanceKm <= LOCAL_DISPATCH_RADIUS_KM;
      } else if (cleanCity) {
        const isDirectCityMatch = hosp.city
          ? hosp.city.toLowerCase() === cleanCity || cleanCity === hosp.city.toLowerCase()
          : false;
        isLocal = isDirectCityMatch || (distanceKm !== null && distanceKm <= LOCAL_DISPATCH_RADIUS_KM);
      } else {
        // No coordinates and no city filter => all facilities considered
        isLocal = true;
      }

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

    // Return hospitals that are in the local dispatch radius
    let localHospitals = enriched.filter((h) => h.isLocal);

    // If exact coordinates were specified but no facility is within 50km,
    // gracefully provide the nearest available facilities within 150km.
    if (hasExactCoordinates && localHospitals.length === 0) {
      localHospitals = enriched.filter((h) => h.distanceKm !== null && h.distanceKm <= 150);
    }

    // Sort: suitable first, then by distance, then by available capacity
    localHospitals.sort((a, b) => {
      if (a.isSuitable !== b.isSuitable) return a.isSuitable ? -1 : 1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return b.totalAvailable - a.totalAvailable;
    });

    return NextResponse.json(
      {
        origin: originLat !== null && originLng !== null ? { lat: originLat, lng: originLng } : null,
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

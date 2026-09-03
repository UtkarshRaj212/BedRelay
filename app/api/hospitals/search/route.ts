import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests, user } from "@/db/schema";
import { calculateDistanceKm, INDIAN_CITIES } from "@/lib/geo";
import { eq, desc } from "drizzle-orm";

async function ensureSeedData() {
  const existingHospitals = await db.select().from(hospitals).limit(1);
  if (existingHospitals.length > 0) return;

  const now = new Date();

  // Create seed user for hospital ownership
  const seedUserId = `user_seed_${Date.now()}`;
  await db.insert(user).values({
    id: seedUserId,
    name: "Indian Health Infrastructure Admin",
    email: "admin@health.gov.in",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  const seedHospitals = [
    {
      id: "hosp_aiims_delhi",
      userId: seedUserId,
      name: "AIIMS New Delhi",
      address: "Sri Aurobindo Marg, Ansari Nagar",
      city: "New Delhi",
      state: "Delhi",
      phone: "+91 11 2658 8500",
      latitude: 28.5672,
      longitude: 77.21,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "hosp_apollo_mumbai",
      userId: seedUserId,
      name: "Apollo Hospital Navi Mumbai",
      address: "Plot #13, Parsik Hill Rd, Sector 23, CBD Belapur",
      city: "Mumbai",
      state: "Maharashtra",
      phone: "+91 22 3350 3350",
      latitude: 19.021,
      longitude: 73.038,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "hosp_fortis_bengaluru",
      userId: seedUserId,
      name: "Fortis Hospital Bannerghatta",
      address: "154/9, Bannerghatta Main Rd, Opp. IIMB",
      city: "Bengaluru",
      state: "Karnataka",
      phone: "+91 80 6621 4444",
      latitude: 12.8942,
      longitude: 77.5989,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "hosp_kem_mumbai",
      userId: seedUserId,
      name: "Seth GS Medical College & KEM Hospital",
      address: "Acharya Donde Marg, Parel",
      city: "Mumbai",
      state: "Maharashtra",
      phone: "+91 22 2410 7000",
      latitude: 19.0028,
      longitude: 72.8423,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "hosp_manipal_hyderabad",
      userId: seedUserId,
      name: "KIMS Hospitals Kondapur",
      address: "1-112/86, Beside RTA Office, Kondapur",
      city: "Hyderabad",
      state: "Telangana",
      phone: "+91 40 4488 5000",
      latitude: 17.4649,
      longitude: 78.3686,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.insert(hospitals).values(seedHospitals);

  // Seed bed categories for each hospital
  const seedBeds = [
    // AIIMS Delhi
    { id: "b1", hospitalId: "hosp_aiims_delhi", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 40, availableBeds: 8, occupiedBeds: 32, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b2", hospitalId: "hosp_aiims_delhi", categoryCode: "GENERAL", name: "General Ward", totalBeds: 200, availableBeds: 45, occupiedBeds: 155, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b3", hospitalId: "hosp_aiims_delhi", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 25, availableBeds: 5, occupiedBeds: 20, lastUpdated: now, createdAt: now, updatedAt: now },

    // Apollo Mumbai
    { id: "b4", hospitalId: "hosp_apollo_mumbai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 30, availableBeds: 4, occupiedBeds: 26, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b5", hospitalId: "hosp_apollo_mumbai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 150, availableBeds: 22, occupiedBeds: 128, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b6", hospitalId: "hosp_apollo_mumbai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 20, availableBeds: 0, occupiedBeds: 20, lastUpdated: now, createdAt: now, updatedAt: now },

    // Fortis Bengaluru
    { id: "b7", hospitalId: "hosp_fortis_bengaluru", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 25, availableBeds: 7, occupiedBeds: 18, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b8", hospitalId: "hosp_fortis_bengaluru", categoryCode: "GENERAL", name: "General Ward", totalBeds: 110, availableBeds: 18, occupiedBeds: 92, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b9", hospitalId: "hosp_fortis_bengaluru", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 15, availableBeds: 3, occupiedBeds: 12, lastUpdated: now, createdAt: now, updatedAt: now },

    // KEM Mumbai
    { id: "b10", hospitalId: "hosp_kem_mumbai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 35, availableBeds: 2, occupiedBeds: 33, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b11", hospitalId: "hosp_kem_mumbai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 300, availableBeds: 50, occupiedBeds: 250, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b12", hospitalId: "hosp_kem_mumbai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 30, availableBeds: 6, occupiedBeds: 24, lastUpdated: now, createdAt: now, updatedAt: now },

    // KIMS Hyderabad
    { id: "b13", hospitalId: "hosp_manipal_hyderabad", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 20, availableBeds: 5, occupiedBeds: 15, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b14", hospitalId: "hosp_manipal_hyderabad", categoryCode: "GENERAL", name: "General Ward", totalBeds: 90, availableBeds: 14, occupiedBeds: 76, lastUpdated: now, createdAt: now, updatedAt: now },
    { id: "b15", hospitalId: "hosp_manipal_hyderabad", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 12, availableBeds: 2, occupiedBeds: 10, lastUpdated: now, createdAt: now, updatedAt: now },
  ];

  await db.insert(bedCategories).values(seedBeds);

  // Seed sample active dispatch request
  await db.insert(dispatchRequests).values({
    id: "disp_seed_101",
    hospitalId: "hosp_aiims_delhi",
    ambulanceUnit: "108 EMS Unit-14",
    bedCategoryCode: "ICU",
    requestedBeds: 1,
    etaMinutes: 14,
    patientCondition: "Acute Myocardial Infarction",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  });
}

export async function GET(req: NextRequest) {
  try {
    await ensureSeedData();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";
    const minBeds = parseInt(searchParams.get("minBeds") || "1", 10);
    const userLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
    const userLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null;
    const city = searchParams.get("city");

    const allHospitals = await db.select().from(hospitals);
    const allBeds = await db.select().from(bedCategories);
    const activeDispatches = await db
      .select()
      .from(dispatchRequests)
      .orderBy(desc(dispatchRequests.createdAt))
      .limit(10);

    const result = allHospitals.map((hosp) => {
      let hospBeds = allBeds.filter((b) => b.hospitalId === hosp.id);

      let targetCategoryBeds = 0;
      if (category !== "ALL") {
        const catBed = hospBeds.find((b) => b.categoryCode.toUpperCase() === category.toUpperCase());
        targetCategoryBeds = catBed ? catBed.availableBeds : 0;
      } else {
        targetCategoryBeds = hospBeds.reduce((acc, b) => acc + b.availableBeds, 0);
      }

      let distanceKm: number | null = null;
      if (userLat !== null && userLng !== null && hosp.latitude && hosp.longitude) {
        distanceKm = calculateDistanceKm(userLat, userLng, hosp.latitude, hosp.longitude);
      } else if (city) {
        const cityPreset = INDIAN_CITIES.find((c) => c.name.toLowerCase() === city.toLowerCase());
        if (cityPreset && hosp.latitude && hosp.longitude) {
          distanceKm = calculateDistanceKm(cityPreset.lat, cityPreset.lng, hosp.latitude, hosp.longitude);
        }
      }

      const totalAvailable = hospBeds.reduce((acc, b) => acc + b.availableBeds, 0);
      const totalBeds = hospBeds.reduce((acc, b) => acc + b.totalBeds, 0);
      const isSuitable = targetCategoryBeds >= minBeds;

      return {
        ...hosp,
        beds: hospBeds,
        totalAvailable,
        totalBeds,
        targetCategoryBeds,
        distanceKm,
        isSuitable,
      };
    });

    // Sort by suitability first, then by distance (if available), then by total available beds
    result.sort((a, b) => {
      if (a.isSuitable !== b.isSuitable) return a.isSuitable ? -1 : 1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return b.totalAvailable - a.totalAvailable;
    });

    return NextResponse.json({
      hospitals: result,
      activeDispatches,
    });
  } catch (error: any) {
    console.error("Failed to fetch hospital telemetry for dispatcher:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests, user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function seedIndianHospitals(forceReset = false) {
  try {
    const existingHospitals = await db.select().from(hospitals);
    const existingBeds = await db.select().from(bedCategories);

    // Quick check: if we already have the expanded dataset, skip
    const hasExpanded = existingHospitals.some((h) => h.id === "hosp_fortis_kolkata");
    const hasSufficientBeds = existingBeds.length >= 60;

    if (!forceReset && hasExpanded && hasSufficientBeds) {
      return { success: true, message: "Database already contains complete hospital telemetry data.", seeded: false };
    }

    if (forceReset) {
      await db.delete(dispatchRequests);
      await db.delete(bedCategories);
      // Only delete seed hospitals, not user-created ones
      const seedHospitals = existingHospitals.filter((h) => h.userId === "user_seed_admin_101");
      for (const h of seedHospitals) {
        await db.delete(hospitals).where(eq(hospitals.id, h.id));
      }
    }

    const now = new Date();
    const seedUserId = "user_seed_admin_101";

    // Ensure seed admin user exists
    const [existingUser] = await db.select().from(user).where(eq(user.id, seedUserId)).limit(1);
    if (!existingUser) {
      await db.insert(user).values({
        id: seedUserId,
        name: "Indian Emergency Health Network",
        email: "admin@bedrelay.health.gov.in",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }

    // =============================================
    // HOSPITALS: 3 per major city, 2 per smaller city
    // =============================================
    const indianHospitalsList = [
      // ── Chennai (3 hospitals) ──
      {
        id: "hosp_apollo_chennai",
        userId: seedUserId,
        name: "Apollo Hospital Greams Road",
        address: "21 Greams Lane, Off Greams Road, Thousand Lights",
        city: "Chennai",
        state: "Tamil Nadu",
        phone: "+91 44 2829 0200",
        latitude: 13.0604,
        longitude: 80.2512,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_miot_chennai",
        userId: seedUserId,
        name: "MIOT International Hospital",
        address: "4/112, Mount Poonamallee Rd, Manapakkam",
        city: "Chennai",
        state: "Tamil Nadu",
        phone: "+91 44 4200 2288",
        latitude: 13.0223,
        longitude: 80.1764,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_stanley_chennai",
        userId: seedUserId,
        name: "Govt. Stanley Medical College Hospital",
        address: "Old Jail Rd, Royapuram",
        city: "Chennai",
        state: "Tamil Nadu",
        phone: "+91 44 2528 1665",
        latitude: 13.1167,
        longitude: 80.2881,
        createdAt: now,
        updatedAt: now,
      },

      // ── Mumbai (3 hospitals) ──
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
        id: "hosp_lilavati_mumbai",
        userId: seedUserId,
        name: "Lilavati Hospital & Research Centre",
        address: "A-791, Bandra Reclamation, Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        phone: "+91 22 2675 1000",
        latitude: 19.0512,
        longitude: 72.8286,
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

      // ── New Delhi (3 hospitals) ──
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
        id: "hosp_max_delhi",
        userId: seedUserId,
        name: "Max Super Speciality Hospital Saket",
        address: "1, 2, Press Enclave Marg, Saket",
        city: "New Delhi",
        state: "Delhi",
        phone: "+91 11 2651 5050",
        latitude: 28.5273,
        longitude: 77.212,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_safdarjung_delhi",
        userId: seedUserId,
        name: "Safdarjung Hospital",
        address: "Ansari Nagar West, Ring Road",
        city: "New Delhi",
        state: "Delhi",
        phone: "+91 11 2616 5060",
        latitude: 28.5685,
        longitude: 77.2066,
        createdAt: now,
        updatedAt: now,
      },

      // ── Bengaluru (3 hospitals) ──
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
        id: "hosp_manipal_bengaluru",
        userId: seedUserId,
        name: "Manipal Hospital HAL Airport Road",
        address: "98, HAL Old Airport Rd, Kodihalli",
        city: "Bengaluru",
        state: "Karnataka",
        phone: "+91 80 2502 4444",
        latitude: 12.9577,
        longitude: 77.6483,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_nimhans_bengaluru",
        userId: seedUserId,
        name: "NIMHANS Hospital",
        address: "Hosur Road, Lakkasandra",
        city: "Bengaluru",
        state: "Karnataka",
        phone: "+91 80 2699 5000",
        latitude: 12.9417,
        longitude: 77.5963,
        createdAt: now,
        updatedAt: now,
      },

      // ── Hyderabad (3 hospitals) ──
      {
        id: "hosp_kims_hyderabad",
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
      {
        id: "hosp_yashoda_hyderabad",
        userId: seedUserId,
        name: "Yashoda Hospitals Secunderabad",
        address: "Alexander Rd, Kummari Guda, Secunderabad",
        city: "Hyderabad",
        state: "Telangana",
        phone: "+91 40 4567 4567",
        latitude: 17.4399,
        longitude: 78.4983,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_osmania_hyderabad",
        userId: seedUserId,
        name: "Osmania General Hospital",
        address: "Afzalgunj, Near MJ Market",
        city: "Hyderabad",
        state: "Telangana",
        phone: "+91 40 2460 0146",
        latitude: 17.3753,
        longitude: 78.4744,
        createdAt: now,
        updatedAt: now,
      },

      // ── Kolkata (3 hospitals) ──
      {
        id: "hosp_amri_kolkata",
        userId: seedUserId,
        name: "AMRI Hospital Salt Lake",
        address: "JC-16 & 17, Salt Lake City, Sector III",
        city: "Kolkata",
        state: "West Bengal",
        phone: "+91 33 6680 0000",
        latitude: 22.5726,
        longitude: 88.3639,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_fortis_kolkata",
        userId: seedUserId,
        name: "Fortis Hospital Anandapur",
        address: "730, Anandapur, EM Bypass",
        city: "Kolkata",
        state: "West Bengal",
        phone: "+91 33 6628 4444",
        latitude: 22.5130,
        longitude: 88.4025,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_sskm_kolkata",
        userId: seedUserId,
        name: "SSKM Hospital (PG Hospital)",
        address: "242, AJC Bose Road, Bhowanipore",
        city: "Kolkata",
        state: "West Bengal",
        phone: "+91 33 2223 4567",
        latitude: 22.5366,
        longitude: 88.3446,
        createdAt: now,
        updatedAt: now,
      },

      // ── Pune (2 hospitals) ──
      {
        id: "hosp_ruby_pune",
        userId: seedUserId,
        name: "Ruby Hall Clinic",
        address: "40, Sassoon Road, Near Pune Railway Station",
        city: "Pune",
        state: "Maharashtra",
        phone: "+91 20 6645 5100",
        latitude: 18.5204,
        longitude: 73.8567,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_jehangir_pune",
        userId: seedUserId,
        name: "Jehangir Hospital",
        address: "32, Sassoon Road, Sangamvadi",
        city: "Pune",
        state: "Maharashtra",
        phone: "+91 20 6681 3333",
        latitude: 18.5314,
        longitude: 73.8777,
        createdAt: now,
        updatedAt: now,
      },

      // ── Ahmedabad (2 hospitals) ──
      {
        id: "hosp_zydus_ahmedabad",
        userId: seedUserId,
        name: "Zydus Hospital Thaltej",
        address: "Zydus Hospital Rd, Thaltej",
        city: "Ahmedabad",
        state: "Gujarat",
        phone: "+91 79 6670 0000",
        latitude: 23.0225,
        longitude: 72.5714,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hosp_civil_ahmedabad",
        userId: seedUserId,
        name: "Civil Hospital Ahmedabad",
        address: "Asarwa, Ahmedabad",
        city: "Ahmedabad",
        state: "Gujarat",
        phone: "+91 79 2268 3721",
        latitude: 23.0469,
        longitude: 72.6064,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const hosp of indianHospitalsList) {
      const [existing] = await db.select().from(hospitals).where(eq(hospitals.id, hosp.id)).limit(1);
      if (!existing) {
        await db.insert(hospitals).values(hosp);
      }
    }

    // =============================================
    // BED CATEGORIES: 3 per hospital (ICU, GENERAL, VENTILATOR)
    // =============================================
    const seedBedsList = [
      // Apollo Chennai
      { id: "b_apollo_icu", hospitalId: "hosp_apollo_chennai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 35, availableBeds: 9, occupiedBeds: 26, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_apollo_gen", hospitalId: "hosp_apollo_chennai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 180, availableBeds: 42, occupiedBeds: 138, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_apollo_vent", hospitalId: "hosp_apollo_chennai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 20, availableBeds: 4, occupiedBeds: 16, lastUpdated: now, createdAt: now, updatedAt: now },

      // MIOT Chennai
      { id: "b_miot_icu", hospitalId: "hosp_miot_chennai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 30, availableBeds: 7, occupiedBeds: 23, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_miot_gen", hospitalId: "hosp_miot_chennai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 160, availableBeds: 38, occupiedBeds: 122, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_miot_vent", hospitalId: "hosp_miot_chennai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 18, availableBeds: 3, occupiedBeds: 15, lastUpdated: now, createdAt: now, updatedAt: now },

      // Stanley Chennai
      { id: "b_stanley_icu", hospitalId: "hosp_stanley_chennai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 22, availableBeds: 5, occupiedBeds: 17, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_stanley_gen", hospitalId: "hosp_stanley_chennai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 250, availableBeds: 60, occupiedBeds: 190, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_stanley_vent", hospitalId: "hosp_stanley_chennai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 14, availableBeds: 2, occupiedBeds: 12, lastUpdated: now, createdAt: now, updatedAt: now },

      // KEM Mumbai
      { id: "b_kem_icu", hospitalId: "hosp_kem_mumbai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 45, availableBeds: 10, occupiedBeds: 35, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_kem_gen", hospitalId: "hosp_kem_mumbai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 350, availableBeds: 65, occupiedBeds: 285, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_kem_vent", hospitalId: "hosp_kem_mumbai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 35, availableBeds: 8, occupiedBeds: 27, lastUpdated: now, createdAt: now, updatedAt: now },

      // Lilavati Mumbai
      { id: "b_lila_icu", hospitalId: "hosp_lilavati_mumbai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 28, availableBeds: 5, occupiedBeds: 23, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_lila_gen", hospitalId: "hosp_lilavati_mumbai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 160, availableBeds: 30, occupiedBeds: 130, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_lila_vent", hospitalId: "hosp_lilavati_mumbai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 16, availableBeds: 2, occupiedBeds: 14, lastUpdated: now, createdAt: now, updatedAt: now },

      // Apollo Mumbai
      { id: "b_apolm_icu", hospitalId: "hosp_apollo_mumbai", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 30, availableBeds: 6, occupiedBeds: 24, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_apolm_gen", hospitalId: "hosp_apollo_mumbai", categoryCode: "GENERAL", name: "General Ward", totalBeds: 150, availableBeds: 35, occupiedBeds: 115, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_apolm_vent", hospitalId: "hosp_apollo_mumbai", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 20, availableBeds: 4, occupiedBeds: 16, lastUpdated: now, createdAt: now, updatedAt: now },

      // AIIMS Delhi
      { id: "b_aiims_icu", hospitalId: "hosp_aiims_delhi", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 40, availableBeds: 12, occupiedBeds: 28, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_aiims_gen", hospitalId: "hosp_aiims_delhi", categoryCode: "GENERAL", name: "General Ward", totalBeds: 250, availableBeds: 55, occupiedBeds: 195, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_aiims_vent", hospitalId: "hosp_aiims_delhi", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 30, availableBeds: 6, occupiedBeds: 24, lastUpdated: now, createdAt: now, updatedAt: now },

      // Max Delhi
      { id: "b_max_icu", hospitalId: "hosp_max_delhi", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 30, availableBeds: 8, occupiedBeds: 22, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_max_gen", hospitalId: "hosp_max_delhi", categoryCode: "GENERAL", name: "General Ward", totalBeds: 180, availableBeds: 40, occupiedBeds: 140, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_max_vent", hospitalId: "hosp_max_delhi", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 20, availableBeds: 5, occupiedBeds: 15, lastUpdated: now, createdAt: now, updatedAt: now },

      // Safdarjung Delhi
      { id: "b_safdar_icu", hospitalId: "hosp_safdarjung_delhi", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 36, availableBeds: 10, occupiedBeds: 26, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_safdar_gen", hospitalId: "hosp_safdarjung_delhi", categoryCode: "GENERAL", name: "General Ward", totalBeds: 300, availableBeds: 72, occupiedBeds: 228, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_safdar_vent", hospitalId: "hosp_safdarjung_delhi", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 22, availableBeds: 4, occupiedBeds: 18, lastUpdated: now, createdAt: now, updatedAt: now },

      // Fortis Bengaluru
      { id: "b_fortis_icu", hospitalId: "hosp_fortis_bengaluru", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 30, availableBeds: 7, occupiedBeds: 23, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_fortis_gen", hospitalId: "hosp_fortis_bengaluru", categoryCode: "GENERAL", name: "General Ward", totalBeds: 140, availableBeds: 28, occupiedBeds: 112, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_fortis_vent", hospitalId: "hosp_fortis_bengaluru", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 15, availableBeds: 3, occupiedBeds: 12, lastUpdated: now, createdAt: now, updatedAt: now },

      // Manipal Bengaluru
      { id: "b_manipal_icu", hospitalId: "hosp_manipal_bengaluru", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 35, availableBeds: 10, occupiedBeds: 25, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_manipal_gen", hospitalId: "hosp_manipal_bengaluru", categoryCode: "GENERAL", name: "General Ward", totalBeds: 200, availableBeds: 48, occupiedBeds: 152, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_manipal_vent", hospitalId: "hosp_manipal_bengaluru", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 25, availableBeds: 6, occupiedBeds: 19, lastUpdated: now, createdAt: now, updatedAt: now },

      // NIMHANS Bengaluru
      { id: "b_nimhans_icu", hospitalId: "hosp_nimhans_bengaluru", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 20, availableBeds: 4, occupiedBeds: 16, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_nimhans_gen", hospitalId: "hosp_nimhans_bengaluru", categoryCode: "GENERAL", name: "General Ward", totalBeds: 180, availableBeds: 35, occupiedBeds: 145, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_nimhans_vent", hospitalId: "hosp_nimhans_bengaluru", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 12, availableBeds: 2, occupiedBeds: 10, lastUpdated: now, createdAt: now, updatedAt: now },

      // KIMS Hyderabad
      { id: "b_kims_icu", hospitalId: "hosp_kims_hyderabad", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 25, availableBeds: 6, occupiedBeds: 19, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_kims_gen", hospitalId: "hosp_kims_hyderabad", categoryCode: "GENERAL", name: "General Ward", totalBeds: 120, availableBeds: 20, occupiedBeds: 100, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_kims_vent", hospitalId: "hosp_kims_hyderabad", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 18, availableBeds: 5, occupiedBeds: 13, lastUpdated: now, createdAt: now, updatedAt: now },

      // Yashoda Hyderabad
      { id: "b_yash_icu", hospitalId: "hosp_yashoda_hyderabad", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 32, availableBeds: 8, occupiedBeds: 24, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_yash_gen", hospitalId: "hosp_yashoda_hyderabad", categoryCode: "GENERAL", name: "General Ward", totalBeds: 170, availableBeds: 38, occupiedBeds: 132, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_yash_vent", hospitalId: "hosp_yashoda_hyderabad", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 22, availableBeds: 4, occupiedBeds: 18, lastUpdated: now, createdAt: now, updatedAt: now },

      // Osmania Hyderabad
      { id: "b_osmania_icu", hospitalId: "hosp_osmania_hyderabad", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 28, availableBeds: 5, occupiedBeds: 23, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_osmania_gen", hospitalId: "hosp_osmania_hyderabad", categoryCode: "GENERAL", name: "General Ward", totalBeds: 280, availableBeds: 55, occupiedBeds: 225, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_osmania_vent", hospitalId: "hosp_osmania_hyderabad", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 16, availableBeds: 3, occupiedBeds: 13, lastUpdated: now, createdAt: now, updatedAt: now },

      // AMRI Kolkata
      { id: "b_amri_icu", hospitalId: "hosp_amri_kolkata", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 22, availableBeds: 4, occupiedBeds: 18, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_amri_gen", hospitalId: "hosp_amri_kolkata", categoryCode: "GENERAL", name: "General Ward", totalBeds: 100, availableBeds: 15, occupiedBeds: 85, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_amri_vent", hospitalId: "hosp_amri_kolkata", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 14, availableBeds: 3, occupiedBeds: 11, lastUpdated: now, createdAt: now, updatedAt: now },

      // Fortis Kolkata
      { id: "b_fortisk_icu", hospitalId: "hosp_fortis_kolkata", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 28, availableBeds: 6, occupiedBeds: 22, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_fortisk_gen", hospitalId: "hosp_fortis_kolkata", categoryCode: "GENERAL", name: "General Ward", totalBeds: 140, availableBeds: 32, occupiedBeds: 108, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_fortisk_vent", hospitalId: "hosp_fortis_kolkata", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 18, availableBeds: 5, occupiedBeds: 13, lastUpdated: now, createdAt: now, updatedAt: now },

      // SSKM Kolkata
      { id: "b_sskm_icu", hospitalId: "hosp_sskm_kolkata", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 30, availableBeds: 7, occupiedBeds: 23, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_sskm_gen", hospitalId: "hosp_sskm_kolkata", categoryCode: "GENERAL", name: "General Ward", totalBeds: 320, availableBeds: 68, occupiedBeds: 252, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_sskm_vent", hospitalId: "hosp_sskm_kolkata", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 20, availableBeds: 4, occupiedBeds: 16, lastUpdated: now, createdAt: now, updatedAt: now },

      // Ruby Hall Pune
      { id: "b_ruby_icu", hospitalId: "hosp_ruby_pune", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 32, availableBeds: 8, occupiedBeds: 24, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_ruby_gen", hospitalId: "hosp_ruby_pune", categoryCode: "GENERAL", name: "General Ward", totalBeds: 130, availableBeds: 25, occupiedBeds: 105, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_ruby_vent", hospitalId: "hosp_ruby_pune", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 18, availableBeds: 4, occupiedBeds: 14, lastUpdated: now, createdAt: now, updatedAt: now },

      // Jehangir Pune
      { id: "b_jehangir_icu", hospitalId: "hosp_jehangir_pune", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 26, availableBeds: 6, occupiedBeds: 20, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_jehangir_gen", hospitalId: "hosp_jehangir_pune", categoryCode: "GENERAL", name: "General Ward", totalBeds: 150, availableBeds: 35, occupiedBeds: 115, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_jehangir_vent", hospitalId: "hosp_jehangir_pune", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 14, availableBeds: 3, occupiedBeds: 11, lastUpdated: now, createdAt: now, updatedAt: now },

      // Zydus Ahmedabad
      { id: "b_zydus_icu", hospitalId: "hosp_zydus_ahmedabad", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 26, availableBeds: 6, occupiedBeds: 20, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_zydus_gen", hospitalId: "hosp_zydus_ahmedabad", categoryCode: "GENERAL", name: "General Ward", totalBeds: 115, availableBeds: 22, occupiedBeds: 93, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_zydus_vent", hospitalId: "hosp_zydus_ahmedabad", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 16, availableBeds: 3, occupiedBeds: 13, lastUpdated: now, createdAt: now, updatedAt: now },

      // Civil Ahmedabad
      { id: "b_civil_icu", hospitalId: "hosp_civil_ahmedabad", categoryCode: "ICU", name: "Intensive Care Unit (ICU)", totalBeds: 34, availableBeds: 9, occupiedBeds: 25, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_civil_gen", hospitalId: "hosp_civil_ahmedabad", categoryCode: "GENERAL", name: "General Ward", totalBeds: 400, availableBeds: 88, occupiedBeds: 312, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: "b_civil_vent", hospitalId: "hosp_civil_ahmedabad", categoryCode: "VENTILATOR", name: "Ventilator & Critical Care", totalBeds: 20, availableBeds: 5, occupiedBeds: 15, lastUpdated: now, createdAt: now, updatedAt: now },
    ];

    for (const bed of seedBedsList) {
      const [existing] = await db.select().from(bedCategories).where(eq(bedCategories.id, bed.id)).limit(1);
      if (!existing) {
        await db.insert(bedCategories).values(bed);
      }
    }

    // =============================================
    // DISPATCH REQUESTS: Covering all statuses across cities
    // =============================================
    const seedDispatchesList = [
      // Chennai dispatches
      {
        id: "disp_apollo_01",
        hospitalId: "hosp_apollo_chennai",
        ambulanceUnit: "108 EMS Unit-09 (Chennai South)",
        ambulanceLat: 13.0827,
        ambulanceLng: 80.2707,
        patientRef: "PAT-3091",
        bedCategoryCode: "VENTILATOR",
        requestedBeds: 1,
        etaMinutes: 18,
        patientCondition: "Severe Acute Respiratory Distress Syndrome",
        status: "ACCEPTED",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_miot_02",
        hospitalId: "hosp_miot_chennai",
        ambulanceUnit: "108 EMS Unit-12 (Manapakkam)",
        ambulanceLat: 13.0223,
        ambulanceLng: 80.1764,
        patientRef: "PAT-1104",
        bedCategoryCode: "GENERAL",
        requestedBeds: 1,
        etaMinutes: 10,
        patientCondition: "Post-Operative Observation Required",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_stanley_03",
        hospitalId: "hosp_stanley_chennai",
        ambulanceUnit: "GVK EMRI Unit-45 (Royapuram)",
        ambulanceLat: 13.1100,
        ambulanceLng: 80.2950,
        patientRef: "PAT-6640",
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 7,
        patientCondition: "Diabetic Ketoacidosis — Critical",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },

      // Delhi dispatches
      {
        id: "disp_aiims_04",
        hospitalId: "hosp_aiims_delhi",
        ambulanceUnit: "CATS Ambulance Unit-14 (Connaught Place)",
        ambulanceLat: 28.6139,
        ambulanceLng: 77.209,
        patientRef: "PAT-1082",
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 12,
        patientCondition: "Acute Myocardial Infarction — Cardiac Telemetry Active",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_max_05",
        hospitalId: "hosp_max_delhi",
        ambulanceUnit: "108 EMS Unit-33 (Saket)",
        ambulanceLat: 28.5273,
        ambulanceLng: 77.212,
        patientRef: "PAT-5501",
        bedCategoryCode: "GENERAL",
        requestedBeds: 1,
        etaMinutes: 10,
        patientCondition: "Severe Acute Fever & Dehydration",
        status: "ACCEPTED",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_safdar_06",
        hospitalId: "hosp_safdarjung_delhi",
        ambulanceUnit: "CATS Ambulance Unit-28 (Ring Road)",
        ambulanceLat: 28.5700,
        ambulanceLng: 77.2100,
        patientRef: "PAT-8820",
        bedCategoryCode: "VENTILATOR",
        requestedBeds: 1,
        etaMinutes: 6,
        patientCondition: "COPD Exacerbation — Mechanical Ventilation Required",
        status: "ACCEPTED",
        createdAt: now,
        updatedAt: now,
      },

      // Bengaluru dispatches
      {
        id: "disp_fortis_07",
        hospitalId: "hosp_fortis_bengaluru",
        ambulanceUnit: "108 EMS Unit-41 (Electronic City)",
        ambulanceLat: 12.9716,
        ambulanceLng: 77.5946,
        patientRef: "PAT-8812",
        bedCategoryCode: "GENERAL",
        requestedBeds: 2,
        etaMinutes: 15,
        patientCondition: "Polytrauma Post-Accident — Stabilized",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_nimhans_08",
        hospitalId: "hosp_nimhans_bengaluru",
        ambulanceUnit: "108 EMS Unit-55 (Hosur Road)",
        ambulanceLat: 12.9350,
        ambulanceLng: 77.5980,
        patientRef: "PAT-1190",
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 8,
        patientCondition: "Severe Head Injury — GCS 6",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },

      // Mumbai dispatches
      {
        id: "disp_kem_09",
        hospitalId: "hosp_kem_mumbai",
        ambulanceUnit: "ALS Ambulance-02 (Dadar)",
        ambulanceLat: 19.076,
        ambulanceLng: 72.8777,
        patientRef: "PAT-4419",
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 8,
        patientCondition: "Subarachnoid Hemorrhage — Neuro ICU Candidate",
        status: "ACCEPTED",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_lilavati_10",
        hospitalId: "hosp_lilavati_mumbai",
        ambulanceUnit: "CATSEMS Unit-105 (Bandra)",
        ambulanceLat: 19.0512,
        ambulanceLng: 72.8286,
        patientRef: "PAT-2204",
        bedCategoryCode: "GENERAL",
        requestedBeds: 1,
        etaMinutes: 5,
        patientCondition: "Acute Appendicitis — Admitted to Inpatient Ward",
        status: "COMPLETED",
        createdAt: now,
        updatedAt: now,
      },

      // Hyderabad dispatches
      {
        id: "disp_kims_11",
        hospitalId: "hosp_kims_hyderabad",
        ambulanceUnit: "108 EMS Unit-77 (Gachibowli)",
        ambulanceLat: 17.385,
        ambulanceLng: 78.4867,
        patientRef: "PAT-9011",
        bedCategoryCode: "VENTILATOR",
        requestedBeds: 1,
        etaMinutes: 25,
        patientCondition: "Advanced Respiratory Failure — Diverted due to Maintenance",
        status: "REJECTED",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "disp_osmania_12",
        hospitalId: "hosp_osmania_hyderabad",
        ambulanceUnit: "108 EMS Unit-60 (Afzalgunj)",
        ambulanceLat: 17.3700,
        ambulanceLng: 78.4750,
        patientRef: "PAT-7722",
        bedCategoryCode: "GENERAL",
        requestedBeds: 2,
        etaMinutes: 9,
        patientCondition: "Multi-Vehicle Accident — Two Patients Stabilized",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },

      // Kolkata dispatch
      {
        id: "disp_fortisk_13",
        hospitalId: "hosp_fortis_kolkata",
        ambulanceUnit: "108 EMS Unit-90 (EM Bypass)",
        ambulanceLat: 22.5200,
        ambulanceLng: 88.4000,
        patientRef: "PAT-3350",
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 11,
        patientCondition: "Acute Pancreatitis — ICU Monitoring Required",
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },

      // Pune dispatch
      {
        id: "disp_ruby_14",
        hospitalId: "hosp_ruby_pune",
        ambulanceUnit: "108 EMS Unit-19 (Sassoon Road)",
        ambulanceLat: 18.5204,
        ambulanceLng: 73.8567,
        patientRef: "PAT-6712",
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 10,
        patientCondition: "Hypovolemic Shock — Re-routed to Closer Facility",
        status: "CANCELLED",
        createdAt: now,
        updatedAt: now,
      },

      // Ahmedabad dispatch
      {
        id: "disp_civil_15",
        hospitalId: "hosp_civil_ahmedabad",
        ambulanceUnit: "108 EMS Unit-36 (Asarwa)",
        ambulanceLat: 23.0450,
        ambulanceLng: 72.6050,
        patientRef: "PAT-4480",
        bedCategoryCode: "GENERAL",
        requestedBeds: 1,
        etaMinutes: 7,
        patientCondition: "Severe Burns — 30% TBSA — Urgent Debridement",
        status: "ACCEPTED",
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const disp of seedDispatchesList) {
      const [existing] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, disp.id)).limit(1);
      if (!existing) {
        await db.insert(dispatchRequests).values(disp);
      }
    }

    return {
      success: true,
      message: "Successfully verified and seeded complete Indian hospital dataset for all cities and scenarios.",
      seeded: true,
    };
  } catch (error: any) {
    console.error("Error in seedIndianHospitals:", error);
    return { success: false, message: error.message, seeded: false };
  }
}

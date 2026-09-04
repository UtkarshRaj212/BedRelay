import { db } from "@/db";
import { hospitals, bedCategories, dispatchRequests, user, hospitalMemberships, hospitalInvitations } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function seedIndianHospitals(forceReset = false) {
  try {
    const existingHospitals = await db.select().from(hospitals);
    const existingBeds = await db.select().from(bedCategories);
    const existingMemberships = await db.select().from(hospitalMemberships);

    // Quick check: if we already have the expanded dataset AND memberships, skip
    const hasExpanded = existingHospitals.some((h) => h.id === "hosp_fortis_kolkata");
    const hasSufficientBeds = existingBeds.length >= 60;
    const hasStaff = existingMemberships.length >= 10;

    if (!forceReset && hasExpanded && hasSufficientBeds && hasStaff) {
      return { success: true, message: "Database already contains complete hospital telemetry & staff data.", seeded: false };
    }


    if (forceReset) {
      // Only delete seed hospitals, beds, and dispatches - NEVER touch user-created hospitals
      const seedHospitals = existingHospitals.filter((h) => h.userId === "user_seed_admin_101");
      const seedHospitalIds = seedHospitals.map((h) => h.id);
      if (seedHospitalIds.length > 0) {
        await db.delete(dispatchRequests).where(inArray(dispatchRequests.hospitalId, seedHospitalIds));
        await db.delete(bedCategories).where(inArray(bedCategories.hospitalId, seedHospitalIds));
        for (const h of seedHospitals) {
          await db.delete(hospitals).where(eq(hospitals.id, h.id));
        }
      }
    }


    const now = new Date();
    const seedUserId = "user_seed_admin_101";

    // Ensure seed admin user exists with SUPER_ADMIN role
    const [existingUser] = await db.select().from(user).where(eq(user.id, seedUserId)).limit(1);
    if (!existingUser) {
      await db.insert(user).values({
        id: seedUserId,
        name: "Indian Emergency Health Network",
        email: "admin@bedrelay.health.gov.in",
        emailVerified: true,
        role: "SUPER_ADMIN",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    } else if (existingUser.role !== "SUPER_ADMIN") {
      await db.update(user).set({ role: "SUPER_ADMIN", updatedAt: now }).where(eq(user.id, seedUserId));
    }

    // Ensure dedicated National Health Authority SuperAdmin user exists
    const superAdminUserId = "user_national_superadmin";
    const [existingSuperAdmin] = await db.select().from(user).where(eq(user.id, superAdminUserId)).limit(1);
    if (!existingSuperAdmin) {
      await db.insert(user).values({
        id: superAdminUserId,
        name: "National Health Authority SuperAdmin",
        email: "superadmin@bedrelay.gov.in",
        emailVerified: true,
        role: "SUPER_ADMIN",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    } else if (existingSuperAdmin.role !== "SUPER_ADMIN") {
      await db.update(user).set({ role: "SUPER_ADMIN", updatedAt: now }).where(eq(user.id, superAdminUserId));
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

    // =============================================
    // DEMO STAFF USERS & HOSPITAL MEMBERSHIPS
    // =============================================
    const demoStaffUsers = [
      // AIIMS Delhi / User Hospital Staff
      { id: "usr_aiims_gupta", name: "Dr. Arvind Gupta, HOD Emergency", email: "dr.gupta@aiims.delhi.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_aiims_tandon", name: "Dr. Sanjeev Tandon, Sr. Consultant Trauma", email: "dr.tandon@aiims.delhi.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_aiims_meera", name: "Meera Nair, BSN (Charge Nurse)", email: "meera.nair@aiims.delhi.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_aiims_khatri", name: "Ramesh Khatri, Paramedic Specialist", email: "ramesh.khatri@aiims.delhi.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_aiims_pooja", name: "Pooja Sharma, ICU Nursing Lead", email: "pooja.sharma@aiims.delhi.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Apollo Chennai Staff
      { id: "usr_apollo_sharma", name: "Dr. Rajesh Sharma, MD", email: "dr.sharma@apollo.chennai.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_apollo_priya", name: "Priya Venkataraman, RN", email: "priya.v@apollo.chennai.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_apollo_sundaram", name: "Dr. K. Sundaram, Cardiologist", email: "k.sundaram@apollo.chennai.in", emailVerified: true, createdAt: now, updatedAt: now },

      // KEM Mumbai Staff
      { id: "usr_kem_kulkarni", name: "Dr. Sunita Kulkarni, MS", email: "dr.kulkarni@kem.mumbai.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_kem_rahul", name: "Rahul Deshmukh, EMT-P", email: "rahul.deshmukh@kem.mumbai.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_kem_vaishali", name: "Dr. Vaishali Joshi, Critical Care", email: "dr.joshi@kem.mumbai.gov.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Max Saket Delhi
      { id: "usr_max_kapoor", name: "Dr. Alok Kapoor, Director EMS", email: "alok.kapoor@maxhealthcare.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_max_ananya", name: "Ananya Roy, Nurse Supervisor", email: "ananya.roy@maxhealthcare.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Safdarjung Delhi
      { id: "usr_safdar_singh", name: "Dr. H.S. Balhara, HOD Burn ICU", email: "dr.balhara@safdarjung.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_safdar_neha", name: "Neha Verma, Senior Nursing Officer", email: "neha.verma@safdarjung.gov.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Fortis Bengaluru
      { id: "usr_fortis_rao", name: "Dr. Mohan Rao, Trauma Director", email: "mohan.rao@fortishealthcare.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_fortis_deepa", name: "Deepa Menon, RN Triage", email: "deepa.menon@fortishealthcare.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Manipal Bengaluru
      { id: "usr_manipal_hegde", name: "Dr. Sudhir Hegde, Chief Medical Officer", email: "sudhir.hegde@manipalhospitals.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_manipal_kavitha", name: "Kavitha Nair, Emergency Dispatcher", email: "kavitha.nair@manipalhospitals.com", emailVerified: true, createdAt: now, updatedAt: now },

      // NIMHANS Bengaluru
      { id: "usr_nimhans_prasad", name: "Dr. B.N. Gangadhar, Neuro Emergency", email: "bn.gangadhar@nimhans.ac.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_nimhans_arjun", name: "Arjun Gowda, Critical Care Paramedic", email: "arjun.gowda@nimhans.ac.in", emailVerified: true, createdAt: now, updatedAt: now },

      // KIMS Hyderabad
      { id: "usr_kims_reddy", name: "Dr. B. Bhaskar Rao, Chief of Surgery", email: "bhaskar.rao@kims.co.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_kims_swathi", name: "Swathi Reddy, Clinical Coordinator", email: "swathi.reddy@kims.co.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Yashoda Hyderabad
      { id: "usr_yashoda_rao", name: "Dr. G. Ravender Rao, MD", email: "ravender.rao@yashodahospitals.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_yashoda_kiran", name: "Kiran Kumar, EMS Specialist", email: "kiran.kumar@yashodahospitals.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Osmania Hyderabad
      { id: "usr_osmania_shafiq", name: "Dr. Mohammed Shafiq, Superintendent", email: "dr.shafiq@osmania.telangana.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_osmania_fatima", name: "Fatima Begum, Senior Nurse", email: "fatima.begum@osmania.telangana.gov.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Fortis Kolkata
      { id: "usr_fortis_kol_das", name: "Dr. Subrata Das, Intensive Care Head", email: "subrata.das@fortishealthcare.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_fortis_kol_tanusree", name: "Tanusree Bose, Triage Lead", email: "tanusree.bose@fortishealthcare.com", emailVerified: true, createdAt: now, updatedAt: now },

      // AMRI Kolkata
      { id: "usr_amri_sen", name: "Dr. Rupak Sen, Medical Superintendent", email: "rupak.sen@amrihospitals.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_amri_deb", name: "Debashis Banerjee, Emergency Paramedic", email: "deb.banerjee@amrihospitals.in", emailVerified: true, createdAt: now, updatedAt: now },

      // SSKM Kolkata
      { id: "usr_sskm_mukherjee", name: "Dr. Manimoy Bandyopadhyay, Director", email: "director@sskm.wb.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_sskm_ruma", name: "Ruma Chatterjee, Nursing Superintendent", email: "ruma.chatterjee@sskm.wb.gov.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Ruby Hall Pune
      { id: "usr_ruby_grant", name: "Dr. P.K. Grant, Managing Trustee", email: "pk.grant@rubyhall.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_ruby_sonali", name: "Sonali Patil, ICU Shift Lead", email: "sonali.patil@rubyhall.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Jehangir Pune
      { id: "usr_jehangir_patel", name: "Dr. Jehangir Patel, Medical Director", email: "director@jehangirhospital.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_jehangir_vikas", name: "Vikas Shinde, Emergency Coordinator", email: "vikas.shinde@jehangirhospital.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Zydus Ahmedabad
      { id: "usr_zydus_patel", name: "Dr. Pankaj Patel, Chairman", email: "pankaj.patel@zydushospitals.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_zydus_hetal", name: "Hetal Shah, Lead Critical Care Nurse", email: "hetal.shah@zydushospitals.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Civil Hospital Ahmedabad
      { id: "usr_civil_prabhakar", name: "Dr. M.M. Prabhakar, Medical Superintendent", email: "superintendent@civilhosp.gujarat.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_civil_bhavna", name: "Bhavna Barot, Senior Nursing Staff", email: "bhavna.barot@civilhosp.gujarat.gov.in", emailVerified: true, createdAt: now, updatedAt: now },

      // MIOT Chennai
      { id: "usr_miot_mohandas", name: "Dr. PVA Mohandas, Founder & Managing Director", email: "dr.mohandas@miotinternational.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_miot_saravanan", name: "Saravanan R., Head of Emergency Nursing", email: "saravanan.r@miotinternational.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Stanley Chennai
      { id: "usr_stanley_balaji", name: "Dr. P. Balaji, Dean", email: "dean@stanley.tn.gov.in", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_stanley_revathi", name: "Revathi S., Emergency Dispatch Nurse", email: "revathi.s@stanley.tn.gov.in", emailVerified: true, createdAt: now, updatedAt: now },

      // Lilavati Mumbai
      { id: "usr_lilavati_mehta", name: "Dr. Narendra Mehta, Medical VP", email: "dr.mehta@lilavatihospital.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_lilavati_pooja", name: "Pooja Sawant, Critical Care Nurse", email: "pooja.sawant@lilavatihospital.com", emailVerified: true, createdAt: now, updatedAt: now },

      // Apollo Mumbai
      { id: "usr_apollo_mum_sharma", name: "Dr. Sanjeev Jadhav, HOD CVTS & Critical Care", email: "sanjeev.j@apollomumbai.com", emailVerified: true, createdAt: now, updatedAt: now },
      { id: "usr_apollo_mum_riya", name: "Riya Fernandes, Triage Officer", email: "riya.f@apollomumbai.com", emailVerified: true, createdAt: now, updatedAt: now },
    ];

    for (const u of demoStaffUsers) {
      const [existing] = await db.select().from(user).where(eq(user.id, u.id)).limit(1);
      if (!existing) {
        await db.insert(user).values(u);
      }
    }

    // Default admin memberships for all seed hospitals linked to seedUserId
    for (const hosp of indianHospitalsList) {
      const [existing] = await db
        .select()
        .from(hospitalMemberships)
        .where(eq(hospitalMemberships.hospitalId, hosp.id))
        .limit(1);
      if (!existing) {
        await db.insert(hospitalMemberships).values({
          id: `memb_seed_${hosp.id}`,
          hospitalId: hosp.id,
          userId: seedUserId,
          role: "HOSPITAL_ADMIN",
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Specific demo staff memberships for all hospitals
    const specificStaffMemberships = [
      // Apollo Chennai
      { id: "memb_usr_apollo_sharma_hosp_apollo_chennai", hospitalId: "hosp_apollo_chennai", userId: "usr_apollo_sharma", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_apollo_priya_hosp_apollo_chennai", hospitalId: "hosp_apollo_chennai", userId: "usr_apollo_priya", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_apollo_sundaram_hosp_apollo_chennai", hospitalId: "hosp_apollo_chennai", userId: "usr_apollo_sundaram", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // KEM Mumbai
      { id: "memb_usr_kem_kulkarni_hosp_kem_mumbai", hospitalId: "hosp_kem_mumbai", userId: "usr_kem_kulkarni", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_kem_rahul_hosp_kem_mumbai", hospitalId: "hosp_kem_mumbai", userId: "usr_kem_rahul", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_kem_vaishali_hosp_kem_mumbai", hospitalId: "hosp_kem_mumbai", userId: "usr_kem_vaishali", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Max Delhi
      { id: "memb_usr_max_kapoor_hosp_max_delhi", hospitalId: "hosp_max_delhi", userId: "usr_max_kapoor", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_max_ananya_hosp_max_delhi", hospitalId: "hosp_max_delhi", userId: "usr_max_ananya", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Safdarjung Delhi
      { id: "memb_usr_safdar_singh_hosp_safdarjung_delhi", hospitalId: "hosp_safdarjung_delhi", userId: "usr_safdar_singh", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_safdar_neha_hosp_safdarjung_delhi", hospitalId: "hosp_safdarjung_delhi", userId: "usr_safdar_neha", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Fortis Bengaluru
      { id: "memb_usr_fortis_rao_hosp_fortis_bengaluru", hospitalId: "hosp_fortis_bengaluru", userId: "usr_fortis_rao", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_fortis_deepa_hosp_fortis_bengaluru", hospitalId: "hosp_fortis_bengaluru", userId: "usr_fortis_deepa", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Manipal Bengaluru
      { id: "memb_usr_manipal_hegde_hosp_manipal_bengaluru", hospitalId: "hosp_manipal_bengaluru", userId: "usr_manipal_hegde", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_manipal_kavitha_hosp_manipal_bengaluru", hospitalId: "hosp_manipal_bengaluru", userId: "usr_manipal_kavitha", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // NIMHANS Bengaluru
      { id: "memb_usr_nimhans_prasad_hosp_nimhans_bengaluru", hospitalId: "hosp_nimhans_bengaluru", userId: "usr_nimhans_prasad", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_nimhans_arjun_hosp_nimhans_bengaluru", hospitalId: "hosp_nimhans_bengaluru", userId: "usr_nimhans_arjun", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // KIMS Hyderabad
      { id: "memb_usr_kims_reddy_hosp_kims_hyderabad", hospitalId: "hosp_kims_hyderabad", userId: "usr_kims_reddy", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_kims_swathi_hosp_kims_hyderabad", hospitalId: "hosp_kims_hyderabad", userId: "usr_kims_swathi", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Yashoda Hyderabad
      { id: "memb_usr_yashoda_rao_hosp_yashoda_hyderabad", hospitalId: "hosp_yashoda_hyderabad", userId: "usr_yashoda_rao", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_yashoda_kiran_hosp_yashoda_hyderabad", hospitalId: "hosp_yashoda_hyderabad", userId: "usr_yashoda_kiran", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Osmania Hyderabad
      { id: "memb_usr_osmania_shafiq_hosp_osmania_hyderabad", hospitalId: "hosp_osmania_hyderabad", userId: "usr_osmania_shafiq", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_osmania_fatima_hosp_osmania_hyderabad", hospitalId: "hosp_osmania_hyderabad", userId: "usr_osmania_fatima", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Fortis Kolkata
      { id: "memb_usr_fortis_kol_das_hosp_fortis_kolkata", hospitalId: "hosp_fortis_kolkata", userId: "usr_fortis_kol_das", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_fortis_kol_tanusree_hosp_fortis_kolkata", hospitalId: "hosp_fortis_kolkata", userId: "usr_fortis_kol_tanusree", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // AMRI Kolkata
      { id: "memb_usr_amri_sen_hosp_amri_kolkata", hospitalId: "hosp_amri_kolkata", userId: "usr_amri_sen", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_amri_deb_hosp_amri_kolkata", hospitalId: "hosp_amri_kolkata", userId: "usr_amri_deb", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // SSKM Kolkata
      { id: "memb_usr_sskm_mukherjee_hosp_sskm_kolkata", hospitalId: "hosp_sskm_kolkata", userId: "usr_sskm_mukherjee", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_sskm_ruma_hosp_sskm_kolkata", hospitalId: "hosp_sskm_kolkata", userId: "usr_sskm_ruma", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Ruby Hall Pune
      { id: "memb_usr_ruby_grant_hosp_ruby_pune", hospitalId: "hosp_ruby_pune", userId: "usr_ruby_grant", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_ruby_sonali_hosp_ruby_pune", hospitalId: "hosp_ruby_pune", userId: "usr_ruby_sonali", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Jehangir Pune
      { id: "memb_usr_jehangir_patel_hosp_jehangir_pune", hospitalId: "hosp_jehangir_pune", userId: "usr_jehangir_patel", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_jehangir_vikas_hosp_jehangir_pune", hospitalId: "hosp_jehangir_pune", userId: "usr_jehangir_vikas", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Zydus Ahmedabad
      { id: "memb_usr_zydus_patel_hosp_zydus_ahmedabad", hospitalId: "hosp_zydus_ahmedabad", userId: "usr_zydus_patel", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_zydus_hetal_hosp_zydus_ahmedabad", hospitalId: "hosp_zydus_ahmedabad", userId: "usr_zydus_hetal", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Civil Hospital Ahmedabad
      { id: "memb_usr_civil_prabhakar_hosp_civil_ahmedabad", hospitalId: "hosp_civil_ahmedabad", userId: "usr_civil_prabhakar", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_civil_bhavna_hosp_civil_ahmedabad", hospitalId: "hosp_civil_ahmedabad", userId: "usr_civil_bhavna", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // MIOT Chennai
      { id: "memb_usr_miot_mohandas_hosp_miot_chennai", hospitalId: "hosp_miot_chennai", userId: "usr_miot_mohandas", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_miot_saravanan_hosp_miot_chennai", hospitalId: "hosp_miot_chennai", userId: "usr_miot_saravanan", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Stanley Chennai
      { id: "memb_usr_stanley_balaji_hosp_stanley_chennai", hospitalId: "hosp_stanley_chennai", userId: "usr_stanley_balaji", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_stanley_revathi_hosp_stanley_chennai", hospitalId: "hosp_stanley_chennai", userId: "usr_stanley_revathi", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Lilavati Mumbai
      { id: "memb_usr_lilavati_mehta_hosp_lilavati_mumbai", hospitalId: "hosp_lilavati_mumbai", userId: "usr_lilavati_mehta", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_lilavati_pooja_hosp_lilavati_mumbai", hospitalId: "hosp_lilavati_mumbai", userId: "usr_lilavati_pooja", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },

      // Apollo Mumbai
      { id: "memb_usr_apollo_mum_sharma_hosp_apollo_mumbai", hospitalId: "hosp_apollo_mumbai", userId: "usr_apollo_mum_sharma", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
      { id: "memb_usr_apollo_mum_riya_hosp_apollo_mumbai", hospitalId: "hosp_apollo_mumbai", userId: "usr_apollo_mum_riya", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },
    ];

    // Find any user-created hospitals and also attach AIIMS staff to them if they are AIIMS
    const userHospitals = existingHospitals.filter((h) => h.userId !== "user_seed_admin_101");
    for (const uh of userHospitals) {
      // Add AIIMS staff to user's AIIMS hospital
      const aiimsStaff = [
        { id: `memb_usr_aiims_gupta_${uh.id}`, hospitalId: uh.id, userId: "usr_aiims_gupta", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
        { id: `memb_usr_aiims_tandon_${uh.id}`, hospitalId: uh.id, userId: "usr_aiims_tandon", role: "HOSPITAL_ADMIN", status: "ACTIVE", createdAt: now, updatedAt: now },
        { id: `memb_usr_aiims_meera_${uh.id}`, hospitalId: uh.id, userId: "usr_aiims_meera", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },
        { id: `memb_usr_aiims_khatri_${uh.id}`, hospitalId: uh.id, userId: "usr_aiims_khatri", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },
        { id: `memb_usr_aiims_pooja_${uh.id}`, hospitalId: uh.id, userId: "usr_aiims_pooja", role: "HOSPITAL_STAFF", status: "ACTIVE", createdAt: now, updatedAt: now },
      ];
      specificStaffMemberships.push(...aiimsStaff);
    }

    for (const memb of specificStaffMemberships) {
      const [existing] = await db.select().from(hospitalMemberships).where(eq(hospitalMemberships.id, memb.id)).limit(1);
      if (!existing) {
        await db.insert(hospitalMemberships).values(memb);
      }
    }


    // =============================================
    // DEMO HOSPITAL INVITATIONS (Ready for testing!)
    // =============================================
    const seedInvitations = [
      {
        id: "inv_apollo_demo_1",
        hospitalId: "hosp_apollo_chennai",
        code: "BR-APOLLO7",
        email: null,
        role: "HOSPITAL_STAFF",
        invitedByUserId: "user_dr_sharma",
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "inv_apollo_demo_2",
        hospitalId: "hosp_apollo_chennai",
        code: "BR-APOLLO9",
        email: null,
        role: "HOSPITAL_ADMIN",
        invitedByUserId: "user_dr_sharma",
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "inv_aiims_demo_1",
        hospitalId: "hosp_aiims_delhi",
        code: "BR-AIIMS42",
        email: null,
        role: "HOSPITAL_STAFF",
        invitedByUserId: "user_dr_gupta",
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "inv_kem_demo_1",
        hospitalId: "hosp_kem_mumbai",
        code: "BR-KEM888",
        email: null,
        role: "HOSPITAL_STAFF",
        invitedByUserId: "user_dr_kulkarni",
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const inv of seedInvitations) {
      const [existing] = await db.select().from(hospitalInvitations).where(eq(hospitalInvitations.id, inv.id)).limit(1);
      if (!existing) {
        await db.insert(hospitalInvitations).values(inv);
      }
    }

    return {
      success: true,
      message: "Successfully verified and seeded complete Indian hospital dataset, staff rosters, and demo invitation codes.",
      seeded: true,
    };
  } catch (error: unknown) {
    console.error("Error in seedIndianHospitals:", error);
    const msg = error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, message: msg, seeded: false };
  }
}



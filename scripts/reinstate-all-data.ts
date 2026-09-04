import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, hospitalMemberships, hospitalInvitations, user } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

async function reinstateAllData() {
  console.log("=== REINSTATING ALL HOSPITAL STAFF, BEDS, AND DISPATCH TELEMETRY ===");

  const now = new Date();

  // 1. Locate User Hospital
  const allHospitals = await db.select().from(hospitals);
  const userHospital = allHospitals.find((h) => h.userId !== "user_seed_admin_101") ||
    allHospitals.find((h) => h.id === "hosp_1788463370935");

  if (!userHospital) {
    console.error("User hospital not found!");
    process.exit(1);
  }

  console.log(`\n1. Reinstating Bed Categories for User Hospital: ${userHospital.name} (${userHospital.id})...`);
  await db.delete(bedCategories).where(eq(bedCategories.hospitalId, userHospital.id));

  const userBeds = [
    {
      id: `cat_user_icu_${userHospital.id}`,
      hospitalId: userHospital.id,
      categoryCode: "ICU",
      name: "Intensive Care Unit (ICU)",
      totalBeds: 40,
      availableBeds: 12,
      occupiedBeds: 28,
      lastUpdated: new Date(now.getTime() - 8 * 60000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat_user_gen_${userHospital.id}`,
      hospitalId: userHospital.id,
      categoryCode: "GENERAL",
      name: "General Ward",
      totalBeds: 250,
      availableBeds: 55,
      occupiedBeds: 195,
      lastUpdated: new Date(now.getTime() - 5 * 60000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat_user_vent_${userHospital.id}`,
      hospitalId: userHospital.id,
      categoryCode: "VENTILATOR",
      name: "Ventilator & Critical Care",
      totalBeds: 30,
      availableBeds: 6,
      occupiedBeds: 24,
      lastUpdated: new Date(now.getTime() - 3 * 60000),
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const b of userBeds) {
    await db.insert(bedCategories).values(b);
  }
  console.log(`✓ Added ${userBeds.length} bed categories (Total: 320 beds, 73 available).`);

  // 2. Reinstate Inbound Dispatch Requests for User Hospital
  console.log(`\n2. Reinstating Dispatch Requests for User Hospital: ${userHospital.name}...`);
  await db.delete(dispatchRequests).where(eq(dispatchRequests.hospitalId, userHospital.id));

  const userDispatches = [
    {
      id: `disp_user_01_${Date.now()}`,
      hospitalId: userHospital.id,
      ambulanceUnit: "CATS Ambulance Unit-07 (Dwarka)",
      ambulanceLat: 28.5830,
      ambulanceLng: 77.0500,
      patientRef: "PAT-7201",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 9,
      patientCondition: "Acute ST-Elevation Myocardial Infarction — Thrombolysis Window Active",
      status: "PENDING",
      createdAt: new Date(now.getTime() - 4 * 60000),
      updatedAt: new Date(now.getTime() - 4 * 60000),
    },
    {
      id: `disp_user_02_${Date.now()}`,
      hospitalId: userHospital.id,
      ambulanceUnit: "108 EMS Unit-118 (Janakpuri)",
      ambulanceLat: 28.6215,
      ambulanceLng: 77.0855,
      patientRef: "PAT-3488",
      bedCategoryCode: "GENERAL",
      requestedBeds: 1,
      etaMinutes: 14,
      patientCondition: "Severe Dengue Hemorrhagic Fever — Platelet Count Critical",
      status: "PENDING",
      createdAt: new Date(now.getTime() - 8 * 60000),
      updatedAt: new Date(now.getTime() - 8 * 60000),
    },
    {
      id: `disp_user_03_${Date.now()}`,
      hospitalId: userHospital.id,
      ambulanceUnit: "ALS Ambulance-15 (Palam)",
      ambulanceLat: 28.5785,
      ambulanceLng: 77.0891,
      patientRef: "PAT-5590",
      bedCategoryCode: "VENTILATOR",
      requestedBeds: 1,
      etaMinutes: 11,
      patientCondition: "Acute Respiratory Failure — BiPAP Non-Responsive, Intubation Required",
      status: "PENDING",
      createdAt: new Date(now.getTime() - 6 * 60000),
      updatedAt: new Date(now.getTime() - 6 * 60000),
    },
    {
      id: `disp_user_04_${Date.now()}`,
      hospitalId: userHospital.id,
      ambulanceUnit: "CATS Ambulance Unit-22 (Najafgarh)",
      ambulanceLat: 28.5690,
      ambulanceLng: 76.9800,
      patientRef: "PAT-2117",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 18,
      patientCondition: "Organophosphate Poisoning — Atropinized, Ventilatory Support Active",
      status: "ACCEPTED",
      createdAt: new Date(now.getTime() - 22 * 60000),
      updatedAt: new Date(now.getTime() - 15 * 60000),
    },
    {
      id: `disp_user_05_${Date.now()}`,
      hospitalId: userHospital.id,
      ambulanceUnit: "108 EMS Unit-204 (Uttam Nagar)",
      ambulanceLat: 28.6196,
      ambulanceLng: 77.0513,
      patientRef: "PAT-8834",
      bedCategoryCode: "GENERAL",
      requestedBeds: 2,
      etaMinutes: 7,
      patientCondition: "Road Traffic Accident — Two Patients Stabilized, Fracture Immobilized",
      status: "ACCEPTED",
      createdAt: new Date(now.getTime() - 30 * 60000),
      updatedAt: new Date(now.getTime() - 25 * 60000),
    },
  ];

  for (const d of userDispatches) {
    await db.insert(dispatchRequests).values(d);
  }
  console.log(`✓ Added ${userDispatches.length} inbound dispatch alerts for ${userHospital.name}.`);

  // 3. Reinstate Comprehensive Hospital Staff Data for All Hospitals
  console.log("\n3. Creating & Reinstating Staff Members across ALL Hospitals...");

  // Define realistic doctors, nurses, and staff
  const staffList = [
    // AIIMS Delhi / User Hospital Staff
    { id: "usr_aiims_gupta", name: "Dr. Arvind Gupta, HOD Emergency", email: "dr.gupta@aiims.delhi.in", role: "HOSPITAL_ADMIN", hospitalId: userHospital.id },
    { id: "usr_aiims_tandon", name: "Dr. Sanjeev Tandon, Sr. Consultant Trauma", email: "dr.tandon@aiims.delhi.in", role: "HOSPITAL_ADMIN", hospitalId: userHospital.id },
    { id: "usr_aiims_meera", name: "Meera Nair, BSN (Charge Nurse)", email: "meera.nair@aiims.delhi.in", role: "HOSPITAL_STAFF", hospitalId: userHospital.id },
    { id: "usr_aiims_khatri", name: "Ramesh Khatri, Paramedic Specialist", email: "ramesh.khatri@aiims.delhi.in", role: "HOSPITAL_STAFF", hospitalId: userHospital.id },
    { id: "usr_aiims_pooja", name: "Pooja Sharma, ICU Nursing Lead", email: "pooja.sharma@aiims.delhi.in", role: "HOSPITAL_STAFF", hospitalId: userHospital.id },

    // Apollo Chennai Staff
    { id: "usr_apollo_sharma", name: "Dr. Rajesh Sharma, MD", email: "dr.sharma@apollo.chennai.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_apollo_chennai" },
    { id: "usr_apollo_priya", name: "Priya Venkataraman, RN", email: "priya.v@apollo.chennai.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_apollo_chennai" },
    { id: "usr_apollo_sundaram", name: "Dr. K. Sundaram, Cardiologist", email: "k.sundaram@apollo.chennai.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_apollo_chennai" },

    // KEM Mumbai Staff
    { id: "usr_kem_kulkarni", name: "Dr. Sunita Kulkarni, MS", email: "dr.kulkarni@kem.mumbai.gov.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_kem_mumbai" },
    { id: "usr_kem_rahul", name: "Rahul Deshmukh, EMT-P", email: "rahul.deshmukh@kem.mumbai.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_kem_mumbai" },
    { id: "usr_kem_vaishali", name: "Dr. Vaishali Joshi, Critical Care", email: "dr.joshi@kem.mumbai.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_kem_mumbai" },

    // Max Saket Delhi
    { id: "usr_max_kapoor", name: "Dr. Alok Kapoor, Director EMS", email: "alok.kapoor@maxhealthcare.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_max_delhi" },
    { id: "usr_max_ananya", name: "Ananya Roy, Nurse Supervisor", email: "ananya.roy@maxhealthcare.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_max_delhi" },

    // Safdarjung Delhi
    { id: "usr_safdar_singh", name: "Dr. H.S. Balhara, HOD Burn ICU", email: "dr.balhara@safdarjung.gov.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_safdarjung_delhi" },
    { id: "usr_safdar_neha", name: "Neha Verma, Senior Nursing Officer", email: "neha.verma@safdarjung.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_safdarjung_delhi" },

    // Fortis Bengaluru
    { id: "usr_fortis_rao", name: "Dr. Mohan Rao, Trauma Director", email: "mohan.rao@fortishealthcare.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_fortis_bengaluru" },
    { id: "usr_fortis_deepa", name: "Deepa Menon, RN Triage", email: "deepa.menon@fortishealthcare.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_fortis_bengaluru" },

    // Manipal Bengaluru
    { id: "usr_manipal_hegde", name: "Dr. Sudhir Hegde, Chief Medical Officer", email: "sudhir.hegde@manipalhospitals.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_manipal_bengaluru" },
    { id: "usr_manipal_kavitha", name: "Kavitha Nair, Emergency Dispatcher", email: "kavitha.nair@manipalhospitals.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_manipal_bengaluru" },

    // NIMHANS Bengaluru
    { id: "usr_nimhans_prasad", name: "Dr. B.N. Gangadhar, Neuro Emergency", email: "bn.gangadhar@nimhans.ac.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_nimhans_bengaluru" },
    { id: "usr_nimhans_arjun", name: "Arjun Gowda, Critical Care Paramedic", email: "arjun.gowda@nimhans.ac.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_nimhans_bengaluru" },

    // KIMS Hyderabad
    { id: "usr_kims_reddy", name: "Dr. B. Bhaskar Rao, Chief of Surgery", email: "bhaskar.rao@kims.co.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_kims_hyderabad" },
    { id: "usr_kims_swathi", name: "Swathi Reddy, Clinical Coordinator", email: "swathi.reddy@kims.co.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_kims_hyderabad" },

    // Yashoda Hyderabad
    { id: "usr_yashoda_rao", name: "Dr. G. Ravender Rao, MD", email: "ravender.rao@yashodahospitals.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_yashoda_hyderabad" },
    { id: "usr_yashoda_kiran", name: "Kiran Kumar, EMS Specialist", email: "kiran.kumar@yashodahospitals.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_yashoda_hyderabad" },

    // Osmania Hyderabad
    { id: "usr_osmania_shafiq", name: "Dr. Mohammed Shafiq, Superintendent", email: "dr.shafiq@osmania.telangana.gov.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_osmania_hyderabad" },
    { id: "usr_osmania_fatima", name: "Fatima Begum, Senior Nurse", email: "fatima.begum@osmania.telangana.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_osmania_hyderabad" },

    // Fortis Kolkata
    { id: "usr_fortis_kol_das", name: "Dr. Subrata Das, Intensive Care Head", email: "subrata.das@fortishealthcare.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_fortis_kolkata" },
    { id: "usr_fortis_kol_tanusree", name: "Tanusree Bose, Triage Lead", email: "tanusree.bose@fortishealthcare.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_fortis_kolkata" },

    // AMRI Kolkata
    { id: "usr_amri_sen", name: "Dr. Rupak Sen, Medical Superintendent", email: "rupak.sen@amrihospitals.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_amri_kolkata" },
    { id: "usr_amri_deb", name: "Debashis Banerjee, Emergency Paramedic", email: "deb.banerjee@amrihospitals.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_amri_kolkata" },

    // SSKM Kolkata
    { id: "usr_sskm_mukherjee", name: "Dr. Manimoy Bandyopadhyay, Director", email: "director@sskm.wb.gov.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_sskm_kolkata" },
    { id: "usr_sskm_ruma", name: "Ruma Chatterjee, Nursing Superintendent", email: "ruma.chatterjee@sskm.wb.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_sskm_kolkata" },

    // Ruby Hall Pune
    { id: "usr_ruby_grant", name: "Dr. P.K. Grant, Managing Trustee", email: "pk.grant@rubyhall.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_ruby_pune" },
    { id: "usr_ruby_sonali", name: "Sonali Patil, ICU Shift Lead", email: "sonali.patil@rubyhall.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_ruby_pune" },

    // Jehangir Pune
    { id: "usr_jehangir_patel", name: "Dr. Jehangir Patel, Medical Director", email: "director@jehangirhospital.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_jehangir_pune" },
    { id: "usr_jehangir_vikas", name: "Vikas Shinde, Emergency Coordinator", email: "vikas.shinde@jehangirhospital.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_jehangir_pune" },

    // Zydus Ahmedabad
    { id: "usr_zydus_patel", name: "Dr. Pankaj Patel, Chairman", email: "pankaj.patel@zydushospitals.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_zydus_ahmedabad" },
    { id: "usr_zydus_hetal", name: "Hetal Shah, Lead Critical Care Nurse", email: "hetal.shah@zydushospitals.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_zydus_ahmedabad" },

    // Civil Hospital Ahmedabad
    { id: "usr_civil_prabhakar", name: "Dr. M.M. Prabhakar, Medical Superintendent", email: "superintendent@civilhosp.gujarat.gov.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_civil_ahmedabad" },
    { id: "usr_civil_bhavna", name: "Bhavna Barot, Senior Nursing Staff", email: "bhavna.barot@civilhosp.gujarat.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_civil_ahmedabad" },

    // MIOT Chennai
    { id: "usr_miot_mohandas", name: "Dr. PVA Mohandas, Founder & Managing Director", email: "dr.mohandas@miotinternational.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_miot_chennai" },
    { id: "usr_miot_saravanan", name: "Saravanan R., Head of Emergency Nursing", email: "saravanan.r@miotinternational.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_miot_chennai" },

    // Stanley Chennai
    { id: "usr_stanley_balaji", name: "Dr. P. Balaji, Dean", email: "dean@stanley.tn.gov.in", role: "HOSPITAL_ADMIN", hospitalId: "hosp_stanley_chennai" },
    { id: "usr_stanley_revathi", name: "Revathi S., Emergency Dispatch Nurse", email: "revathi.s@stanley.tn.gov.in", role: "HOSPITAL_STAFF", hospitalId: "hosp_stanley_chennai" },

    // Lilavati Mumbai
    { id: "usr_lilavati_mehta", name: "Dr. Narendra Mehta, Medical VP", email: "dr.mehta@lilavatihospital.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_lilavati_mumbai" },
    { id: "usr_lilavati_pooja", name: "Pooja Sawant, Critical Care Nurse", email: "pooja.sawant@lilavatihospital.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_lilavati_mumbai" },

    // Apollo Mumbai
    { id: "usr_apollo_mum_sharma", name: "Dr. Sanjeev Jadhav, HOD CVTS & Critical Care", email: "sanjeev.j@apollomumbai.com", role: "HOSPITAL_ADMIN", hospitalId: "hosp_apollo_mumbai" },
    { id: "usr_apollo_mum_riya", name: "Riya Fernandes, Triage Officer", email: "riya.f@apollomumbai.com", role: "HOSPITAL_STAFF", hospitalId: "hosp_apollo_mumbai" },
  ];

  // Insert Users
  for (const s of staffList) {
    const [existing] = await db.select().from(user).where(eq(user.id, s.id)).limit(1);
    if (!existing) {
      await db.insert(user).values({
        id: s.id,
        name: s.name,
        email: s.email,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Insert Memberships
  for (const s of staffList) {
    const [existing] = await db
      .select()
      .from(hospitalMemberships)
      .where(eq(hospitalMemberships.id, `memb_${s.id}_${s.hospitalId}`))
      .limit(1);

    if (!existing) {
      await db.insert(hospitalMemberships).values({
        id: `memb_${s.id}_${s.hospitalId}`,
        hospitalId: s.hospitalId,
        userId: s.id,
        role: s.role,
        status: "ACTIVE",
        createdAt: new Date(now.getTime() - Math.floor(Math.random() * 30 + 5) * 86400000),
        updatedAt: now,
      });
    }
  }
  console.log(`✓ Reinstated ${staffList.length} staff memberships across all facilities.`);

  // 4. Ensure User Hospital has invitations
  const userInvitations = [
    {
      id: `inv_user_aiims_01`,
      hospitalId: userHospital.id,
      code: "BR-AIIMS42",
      email: null,
      role: "HOSPITAL_STAFF",
      invitedByUserId: userHospital.userId,
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `inv_user_aiims_02`,
      hospitalId: userHospital.id,
      code: "BR-AIIMS99",
      email: null,
      role: "HOSPITAL_ADMIN",
      invitedByUserId: userHospital.userId,
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `inv_user_apollo_01`,
      hospitalId: "hosp_apollo_chennai",
      code: "BR-APOLLO7",
      email: null,
      role: "HOSPITAL_STAFF",
      invitedByUserId: "usr_apollo_sharma",
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `inv_user_apollo_02`,
      hospitalId: "hosp_apollo_chennai",
      code: "BR-APOLLO9",
      email: null,
      role: "HOSPITAL_ADMIN",
      invitedByUserId: "usr_apollo_sharma",
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `inv_user_kem_01`,
      hospitalId: "hosp_kem_mumbai",
      code: "BR-KEM888",
      email: null,
      role: "HOSPITAL_STAFF",
      invitedByUserId: "usr_kem_kulkarni",
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `inv_user_max_01`,
      hospitalId: "hosp_max_delhi",
      code: "BR-MAX555",
      email: null,
      role: "HOSPITAL_STAFF",
      invitedByUserId: "usr_max_kapoor",
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const inv of userInvitations) {
    const [existing] = await db.select().from(hospitalInvitations).where(eq(hospitalInvitations.code, inv.code)).limit(1);
    if (!existing) {
      await db.insert(hospitalInvitations).values(inv);
    } else {
      await db.update(hospitalInvitations).set({ hospitalId: inv.hospitalId, status: "PENDING", expiresAt: inv.expiresAt }).where(eq(hospitalInvitations.code, inv.code));
    }
  }
  console.log(`✓ Reinstated ${userInvitations.length} pending invitations.`);


  console.log("\n=== ALL DATA SUCCESSFULLY REINSTATED ===");
  process.exit(0);
}

reinstateAllData().catch((err) => {
  console.error("Reinstatement failed:", err);
  process.exit(1);
});

import { db } from "../db";
import { dispatchRequests, hospitals } from "../db/schema";
import { eq } from "drizzle-orm";

async function addUserHospitalDispatches() {
  // Find the user's hospital (non-seed hospital)
  const allHospitals = await db.select().from(hospitals);
  const userHospital = allHospitals.find(
    (h) => h.userId !== "user_seed_admin_101"
  );

  if (!userHospital) {
    console.error("No user-created hospital found. Sign in first to create one.");
    process.exit(1);
  }

  console.log(`Found user hospital: ${userHospital.name} (${userHospital.id})`);
  console.log(`Location: ${userHospital.city}, ${userHospital.state}`);

  const now = new Date();

  const dispatches = [
    // PENDING — incoming critical
    {
      id: `disp_user_01`,
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
    // PENDING — general admission
    {
      id: `disp_user_02`,
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
    // PENDING — ventilator
    {
      id: `disp_user_03`,
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
    // ACCEPTED — en route
    {
      id: `disp_user_04`,
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
    // ACCEPTED — general
    {
      id: `disp_user_05`,
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
    // COMPLETED — successfully admitted
    {
      id: `disp_user_06`,
      hospitalId: userHospital.id,
      ambulanceUnit: "108 EMS Unit-91 (Vasant Kunj)",
      ambulanceLat: 28.5220,
      ambulanceLng: 77.1568,
      patientRef: "PAT-4405",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 12,
      patientCondition: "Hypertensive Emergency — BP 220/130 — IV Labetalol Started",
      status: "COMPLETED",
      createdAt: new Date(now.getTime() - 90 * 60000),
      updatedAt: new Date(now.getTime() - 60 * 60000),
    },
    // COMPLETED — general ward
    {
      id: `disp_user_07`,
      hospitalId: userHospital.id,
      ambulanceUnit: "CATS Ambulance Unit-35 (Mahavir Enclave)",
      ambulanceLat: 28.5910,
      ambulanceLng: 77.0380,
      patientRef: "PAT-1192",
      bedCategoryCode: "GENERAL",
      requestedBeds: 1,
      etaMinutes: 6,
      patientCondition: "Acute Gastroenteritis — Severe Dehydration, IV Fluid Resuscitation",
      status: "COMPLETED",
      createdAt: new Date(now.getTime() - 120 * 60000),
      updatedAt: new Date(now.getTime() - 100 * 60000),
    },
    // REJECTED — beds unavailable at that time
    {
      id: `disp_user_08`,
      hospitalId: userHospital.id,
      ambulanceUnit: "108 EMS Unit-66 (Dabri)",
      ambulanceLat: 28.5980,
      ambulanceLng: 77.0630,
      patientRef: "PAT-6078",
      bedCategoryCode: "VENTILATOR",
      requestedBeds: 2,
      etaMinutes: 20,
      patientCondition: "Smoke Inhalation Injury — Two Patients, Bilateral Lung Infiltrates",
      status: "REJECTED",
      createdAt: new Date(now.getTime() - 180 * 60000),
      updatedAt: new Date(now.getTime() - 175 * 60000),
    },
    // CANCELLED — rerouted to closer facility
    {
      id: `disp_user_09`,
      hospitalId: userHospital.id,
      ambulanceUnit: "ALS Ambulance-08 (Chhawla)",
      ambulanceLat: 28.5550,
      ambulanceLng: 76.9500,
      patientRef: "PAT-9921",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 30,
      patientCondition: "Severe Anaphylaxis — Epinephrine Administered, Re-routed to Safdarjung",
      status: "CANCELLED",
      createdAt: new Date(now.getTime() - 240 * 60000),
      updatedAt: new Date(now.getTime() - 235 * 60000),
    },
  ];

  // Delete any existing user dispatches to avoid duplicates
  for (const disp of dispatches) {
    const [existing] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, disp.id))
      .limit(1);
    if (existing) {
      await db.delete(dispatchRequests).where(eq(dispatchRequests.id, disp.id));
    }
  }

  // Also remove the auto-generated dispatch from signup
  const allDispatches = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.hospitalId, userHospital.id));
  for (const d of allDispatches) {
    if (d.id.startsWith("disp_1788")) {
      await db.delete(dispatchRequests).where(eq(dispatchRequests.id, d.id));
      console.log(`  Removed old auto-generated dispatch: ${d.id}`);
    }
  }

  // Insert new dispatches
  for (const disp of dispatches) {
    await db.insert(dispatchRequests).values(disp);
  }

  console.log(`✓ Added ${dispatches.length} dispatch requests for ${userHospital.name}`);
  console.log("  3 PENDING, 2 ACCEPTED, 2 COMPLETED, 1 REJECTED, 1 CANCELLED");
  process.exit(0);
}

addUserHospitalDispatches().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

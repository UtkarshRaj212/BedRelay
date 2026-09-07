import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, dispatchActivities } from "../db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET as getTimelineHandler } from "../app/api/dispatch-requests/[id]/timeline/route";

async function main() {
  console.log("=== VERIFYING AUDIT LOG PAYLOAD DETAILS & PERMISSIONS ===");

  // 1. Get or create test hospital and bed category
  const [hospital] = await db.select().from(hospitals).limit(1);
  if (!hospital) throw new Error("No hospital found");

  const [category] = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.hospitalId, hospital.id))
    .limit(1);
  if (!category) throw new Error("No bed category found");

  const testSessionId = `dispatcher_audit_test_${Date.now()}`;
  const testDispatchId = `disp_audit_test_${Date.now()}`;

  // 2. Insert test dispatch
  await db.insert(dispatchRequests).values({
    id: testDispatchId,
    hospitalId: hospital.id,
    dispatcherSessionId: testSessionId,
    ambulanceUnit: "AMB-108",
    patientRef: "REF-9921",
    bedCategoryCode: category.categoryCode,
    requestedBeds: 1,
    approvedBeds: 1,
    etaMinutes: 20,
    patientCondition: "Stable",
    status: "ACCEPTED",
    reviewRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. Log activities with structured payload
  const { logDispatchActivity } = await import("../lib/activity-logger");

  // Initial creation
  await logDispatchActivity({
    dispatchId: testDispatchId,
    actorType: "DISPATCHER",
    action: "REQUEST_CREATED",
    details: `Pre-arrival alert transmitted to ${hospital.name}. Required: 1 ${category.categoryCode} bed(s). ETA: 20m.`,
    newValue: "PENDING",
  });

  // Modification with old and new JSON payloads
  await logDispatchActivity({
    dispatchId: testDispatchId,
    actorType: "DISPATCHER",
    action: "REQUEST_MODIFIED",
    details: `Dispatch request modified: beds=10 (GENERAL), ETA=30m.`,
    oldValue: JSON.stringify({
      beds: 1,
      category: "ICU",
      eta: 20,
      condition: "Stable",
      ambulance: "AMB-108",
      patientRef: "REF-9921",
    }),
    newValue: JSON.stringify({
      beds: 10,
      category: "GENERAL",
      eta: 30,
      condition: "Critical",
      ambulance: "AMB-108-ADV",
      patientRef: "REF-9921-A",
    }),
    note: "Emergency escalation - patient vitals deteriorating en route",
  });

  // Hospital reviewed
  await logDispatchActivity({
    dispatchId: testDispatchId,
    actorType: "HOSPITAL",
    actorName: hospital.name,
    action: "HOSPITAL_REVIEWED",
    details: "Hospital reviewed update. Approved beds: 10.",
    oldValue: "1 ICU (approved: 1)",
    newValue: "10 GENERAL (approved: 10)",
    note: "Review confirmed by ICU triage team.",
  });

  console.log("✓ Inserted test dispatch and audit log entries");

  // 4. Test Permissions: Unauthorized dispatcher session ID
  console.log("\n--- TEST: Unauthorized Access Check ---");
  const badReq = new NextRequest(
    `http://localhost:3000/api/dispatch-requests/${testDispatchId}/timeline?sessionId=wrong_session_id_456`
  );
  const badRes = await getTimelineHandler(badReq, { params: Promise.resolve({ id: testDispatchId }) });
  console.log(`Response status with wrong session ID: ${badRes.status}`);
  if (badRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for wrong session ID, got ${badRes.status}`);
  }
  console.log("✓ Correctly denied unauthorized request with 403 Forbidden");

  // 5. Test Permissions: Authorized dispatcher session ID
  console.log("\n--- TEST: Authorized Access Check ---");
  const authReq = new NextRequest(
    `http://localhost:3000/api/dispatch-requests/${testDispatchId}/timeline?sessionId=${testSessionId}`
  );
  const authRes = await getTimelineHandler(authReq, { params: Promise.resolve({ id: testDispatchId }) });
  console.log(`Response status with matching session ID: ${authRes.status}`);
  if (authRes.status !== 200) {
    throw new Error(`Expected 200 OK for authorized session ID, got ${authRes.status}`);
  }
  const timelineData = await authRes.json();
  console.log(`✓ Successfully retrieved ${timelineData.activities.length} activities`);

  // 6. Validate Payload Contents in returned activities
  const modifiedAct = timelineData.activities.find((a: any) => a.action === "REQUEST_MODIFIED");
  if (!modifiedAct) throw new Error("REQUEST_MODIFIED activity not found");

  const parsedOld = JSON.parse(modifiedAct.oldValue);
  const parsedNew = JSON.parse(modifiedAct.newValue);

  console.log("\n--- TEST: Payload Diff Verification ---");
  console.log("REQUESTED BEDS:", { previous: parsedOld.beds, new: parsedNew.beds });
  console.log("BED CATEGORY:", { previous: parsedOld.category, new: parsedNew.category });
  console.log("ETA:", { previous: parsedOld.eta, new: parsedNew.eta });
  console.log("CONDITION:", { previous: parsedOld.condition, new: parsedNew.condition });
  console.log("NOTE:", modifiedAct.note);

  if (parsedOld.beds !== 1 || parsedNew.beds !== 10) {
    throw new Error("Bed count diff incorrect");
  }
  if (parsedOld.category !== "ICU" || parsedNew.category !== "GENERAL") {
    throw new Error("Category diff incorrect");
  }
  if (parsedOld.eta !== 20 || parsedNew.eta !== 30) {
    throw new Error("ETA diff incorrect");
  }
  if (parsedOld.condition !== "Stable" || parsedNew.condition !== "Critical") {
    throw new Error("Condition diff incorrect");
  }
  if (!modifiedAct.note.includes("Emergency escalation")) {
    throw new Error("Note not preserved in payload");
  }

  // Clean up test data
  await db.delete(dispatchActivities).where(eq(dispatchActivities.dispatchId, testDispatchId));
  await db.delete(dispatchRequests).where(eq(dispatchRequests.id, testDispatchId));

  console.log("\n✓ All audit log payload tests PASSED successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

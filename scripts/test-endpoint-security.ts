import "dotenv/config";
import { NextRequest } from "next/server";
import { GET as getStats } from "../app/api/superadmin/stats/route";
import { GET as getHospitals, POST as postHospitals, PATCH as patchHospitals } from "../app/api/superadmin/hospitals/route";
import { GET as getStaff } from "../app/api/superadmin/staff/route";
import { GET as getInvitations } from "../app/api/superadmin/invitations/route";

async function runSecurityAudit() {
  console.log("=== Testing SuperAdmin Protected Route Security Handlers ===\n");

  // 1. Test unauthenticated GET /api/superadmin/stats
  console.log("Test 1: Unauthenticated request to /api/superadmin/stats...");
  const dummyReq = new NextRequest("http://localhost:3000/api/superadmin/stats");
  const statsRes = await getStats(dummyReq);
  console.log(`  Response Status: ${statsRes.status}`);
  if (statsRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for unauthenticated stats request, got: ${statsRes.status}`);
  }
  console.log("  ✓ Correctly rejected with 401 Unauthorized");

  // 2. Test unauthenticated GET /api/superadmin/hospitals
  console.log("\nTest 2: Unauthenticated request to /api/superadmin/hospitals...");
  const hospRes = await getHospitals(dummyReq);
  console.log(`  Response Status: ${hospRes.status}`);
  if (hospRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for unauthenticated hospitals request, got: ${hospRes.status}`);
  }
  console.log("  ✓ Correctly rejected with 401 Unauthorized");

  // 3. Test unauthenticated GET /api/superadmin/staff
  console.log("\nTest 3: Unauthenticated request to /api/superadmin/staff...");
  const staffRes = await getStaff(dummyReq);
  console.log(`  Response Status: ${staffRes.status}`);
  if (staffRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for unauthenticated staff request, got: ${staffRes.status}`);
  }
  console.log("  ✓ Correctly rejected with 401 Unauthorized");

  // 4. Test unauthenticated GET /api/superadmin/invitations
  console.log("\nTest 4: Unauthenticated request to /api/superadmin/invitations...");
  const invRes = await getInvitations(dummyReq);
  console.log(`  Response Status: ${invRes.status}`);
  if (invRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for unauthenticated invitations request, got: ${invRes.status}`);
  }
  console.log("  ✓ Correctly rejected with 401 Unauthorized");

  console.log("\n=======================================================");
  console.log(" All security boundary checks passed with 100% precision!");
  console.log("=======================================================");
  process.exit(0);
}

runSecurityAudit().catch((err) => {
  console.error("Security audit failed:", err);
  process.exit(1);
});

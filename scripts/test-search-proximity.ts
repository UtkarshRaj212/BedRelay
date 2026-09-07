import { calculateDistanceKm, buildGoogleMapsDirectionsUrl } from "../lib/geo";

async function runSearchProximityTests() {
  console.log("=== BEDRELAY LOCATION & OSM SEARCH PROXIMITY INTEGRATION SUITE ===\n");
  const baseUrl = "http://localhost:3000";
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // TEST 1: Delhi GPS Coordinates with NO city param
  console.log("--- TEST 1: Hospital search with Delhi GPS coordinates (28.6139, 77.2090) ---");
  const res1 = await fetch(
    `${baseUrl}/api/hospitals/search?lat=28.6139&lng=77.2090&category=ICU&minBeds=1`
  );
  assert(res1.ok, "GET /api/hospitals/search with Delhi coordinates returns HTTP 200");
  const data1 = await res1.json();
  assert(Array.isArray(data1.hospitals), "Response includes hospitals array");

  const suitable1 = data1.hospitals.filter((h: any) => h.isSuitable);
  console.log(`Found ${suitable1.length} suitable hospitals for Delhi coordinates:`);
  suitable1.forEach((h: any) => {
    console.log(`  - ${h.name} (${h.city}): ${h.distanceKm} km away, Available ICU: ${h.targetCategoryBeds}`);
  });

  assert(suitable1.length > 0, "Suitable hospitals returned for Delhi coordinates");
  assert(
    suitable1.every((h: any) => h.city.toLowerCase().includes("delhi")),
    "ALL suitable hospitals are strictly in Delhi, none from other cities"
  );
  assert(
    suitable1.every((h: any) => h.distanceKm <= 25),
    "ALL suitable hospitals are within local proximity (< 25 km)"
  );

  // TEST 2: Bug Fix Verification - Delhi GPS coordinates with mismatched city=Chennai param
  console.log("\n--- TEST 2: BUG FIX: Coordinates must take precedence over mismatched city param ---");
  const res2 = await fetch(
    `${baseUrl}/api/hospitals/search?city=Chennai&lat=28.6139&lng=77.2090&category=ICU&minBeds=1`
  );
  assert(res2.ok, "GET /api/hospitals/search with city=Chennai and Delhi coordinates returns HTTP 200");
  const data2 = await res2.json();

  const suitable2 = data2.hospitals.filter((h: any) => h.isSuitable);
  console.log(`Found ${suitable2.length} suitable hospitals with city=Chennai and Delhi coordinates:`);
  suitable2.forEach((h: any) => {
    console.log(`  - ${h.name} (${h.city}): ${h.distanceKm} km away`);
  });

  assert(
    suitable2.every((h: any) => !h.city.toLowerCase().includes("chennai")),
    "ZERO Chennai hospitals marked as suitable when Delhi coordinates are sent"
  );
  assert(
    suitable2.every((h: any) => h.city.toLowerCase().includes("delhi")),
    "Only Delhi hospitals are returned as suitable, city param was correctly ignored"
  );

  // TEST 3: Google Maps Driving Directions Link Verification
  console.log("\n--- TEST 3: Google Maps Driving Directions URL Verification ---");
  const firstHosp = suitable1[0];
  const directionsUrl = buildGoogleMapsDirectionsUrl({
    lat: firstHosp.latitude,
    lng: firstHosp.longitude,
    name: firstHosp.name,
    city: firstHosp.city,
  });
  console.log(`Generated directions URL for ${firstHosp.name}: ${directionsUrl}`);
  assert(
    directionsUrl.startsWith("https://www.google.com/maps/dir/?api=1"),
    "Directions URL uses Google Maps Universal Direction API"
  );
  assert(
    !directionsUrl.includes("origin="),
    "Directions URL does NOT include starting point (origin omitted for device GPS routing)"
  );
  assert(
    directionsUrl.includes(`destination=${encodeURIComponent(`${firstHosp.name}, ${firstHosp.city}`)}`),
    "Directions URL contains hospital name for accurate real-world place directions"
  );
  assert(
    directionsUrl.includes("travelmode=driving"),
    "Directions URL contains travelmode=driving"
  );

  // TEST 4: Dispatch creation and retrieval with GPS Telemetry
  console.log("\n--- TEST 4: Dispatch Request Flow with GPS Telemetry & Directions ---");
  const dispatchRes = await fetch(`${baseUrl}/api/dispatch-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospitalId: firstHosp.id,
      ambulanceUnit: "108-DELHI-EXP-1",
      ambulanceLat: 28.6139,
      ambulanceLng: 77.2090,
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 14,
      patientCondition: "Severe Trauma - Proximity Verification",
      dispatcherSessionId: "test-dispatcher-session-001",
    }),
  });
  assert(dispatchRes.ok, "POST /api/dispatch-requests succeeded");
  const dispatchData = await dispatchRes.json();
  const dispatchId = dispatchData.dispatch.id;

  const detailRes = await fetch(`${baseUrl}/api/dispatch-requests/${dispatchId}`);
  assert(detailRes.ok, "GET /api/dispatch-requests/[id] succeeded");
  const detailData = await detailRes.json();

  assert(detailData.dispatch.ambulanceLat === 28.6139, "Stored ambulanceLat matches input");
  assert(detailData.dispatch.ambulanceLng === 77.2090, "Stored ambulanceLng matches input");
  assert(detailData.distanceKm !== null && detailData.distanceKm < 25, `Stored distanceKm is local (${detailData.distanceKm} km)`);

  const dispatchDirectionsUrl = buildGoogleMapsDirectionsUrl({
    name: detailData.hospital.name,
    city: detailData.hospital.city,
    lat: detailData.hospital.latitude,
    lng: detailData.hospital.longitude,
  });
  assert(
    dispatchDirectionsUrl.includes(`destination=${encodeURIComponent(`${detailData.hospital.name}, ${detailData.hospital.city}`)}`),
    "Directions URL uses hospital name from stored dispatch details"
  );
  assert(
    !dispatchDirectionsUrl.includes("origin="),
    "Directions URL has no origin so user device GPS is used"
  );

  console.log("\n=======================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runSearchProximityTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

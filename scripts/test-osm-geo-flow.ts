import { isValidCoordinates, calculateDistanceKm, formatDistanceKm, INDIAN_CITIES } from "../lib/geo";

async function runOsmGeoFlowTests() {
  console.log("=== BEDRELAY OPENSTREETMAP & GEO-TELEMETRY VERIFICATION SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Coordinate Validation Tests
  console.log("\n--- TEST 1: Coordinate Validation (isValidCoordinates) ---");
  assert(isValidCoordinates(19.076, 72.8777) === true, "Valid Mumbai coordinates (19.076, 72.8777)");
  assert(isValidCoordinates(28.6139, 77.209) === true, "Valid Delhi coordinates (28.6139, 77.2090)");
  assert(isValidCoordinates(90, 180) === true, "Boundary coordinates (90, 180)");
  assert(isValidCoordinates(-90, -180) === true, "Boundary coordinates (-90, -180)");
  assert(isValidCoordinates(91, 72) === false, "Latitude > 90 rejected");
  assert(isValidCoordinates(-91, 72) === false, "Latitude < -90 rejected");
  assert(isValidCoordinates(19, 181) === false, "Longitude > 180 rejected");
  assert(isValidCoordinates(19, -181) === false, "Longitude < -180 rejected");
  assert(isValidCoordinates(NaN, 72) === false, "NaN latitude rejected");
  assert(isValidCoordinates(19, NaN) === false, "NaN longitude rejected");
  assert(isValidCoordinates(null as any, 72) === false, "Null latitude rejected");

  // 2. Haversine Distance Calculation Tests
  console.log("\n--- TEST 2: Haversine Distance Calculation (calculateDistanceKm) ---");
  // Mumbai to Pune distance is approximately 120-150 km straight line
  const distMumbaiPune = calculateDistanceKm(19.076, 72.8777, 18.5204, 73.8567);
  console.log(`Calculated Mumbai -> Pune straight-line distance: ${distMumbaiPune} km`);
  assert(distMumbaiPune >= 115 && distMumbaiPune <= 135, "Mumbai -> Pune is ~120 km straight-line");

  // Same point distance should be 0
  const distZero = calculateDistanceKm(19.076, 72.8777, 19.076, 72.8777);
  assert(distZero === 0, "Distance between identical points is 0 km");

  // formatDistanceKm tests
  assert(formatDistanceKm(0.4) === "400 m", "Distance < 1 km formats in meters (400 m)");
  assert(formatDistanceKm(12.5) === "12.5 km", "Distance >= 1 km formats in km with 1 decimal (12.5 km)");
  assert(formatDistanceKm(null) === "—", "Null distance formats as dash (—)");

  // 3. Search API Proximity and Distance Calculation Verification
  console.log("\n--- TEST 3: Search API with GPS Coordinates ---");
  const baseUrl = "http://localhost:3000";
  try {
    // Search Mumbai hospitals with Mumbai center GPS
    const searchRes = await fetch(`${baseUrl}/api/hospitals/search?city=Mumbai&category=ICU&minBeds=1&lat=19.0760&lng=72.8777`);
    assert(searchRes.ok, "Search API returns HTTP 200 with lat/lng parameters");
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.hospitals), "Search API returns hospitals array");
    assert(searchData.hospitals.length > 0, "Found hospitals in Mumbai");

    // Verify distance is calculated and sorted
    const firstHosp = searchData.hospitals[0];
    assert(firstHosp.distanceKm !== null && firstHosp.distanceKm !== undefined, `First hospital has valid distanceKm (${firstHosp.distanceKm} km)`);
    assert(typeof firstHosp.latitude === "number" && typeof firstHosp.longitude === "number", `Hospital has valid coordinates (${firstHosp.latitude}, ${firstHosp.longitude})`);

    // Verify hospitals are sorted by proximity ascending
    let isSorted = true;
    for (let i = 1; i < searchData.hospitals.length; i++) {
      const prev = searchData.hospitals[i - 1].distanceKm;
      const curr = searchData.hospitals[i].distanceKm;
      if (prev !== null && curr !== null && prev > curr) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted, "Hospitals are strictly sorted by distanceKm in ascending order");
  } catch (err: any) {
    console.error("API test failed:", err);
    assert(false, `API search request failed: ${err.message}`);
  }

  // 4. Create Dispatch with GPS coordinates
  console.log("\n--- TEST 4: Dispatch Request Creation with Ambulance GPS ---");
  let testDispatchId = "";
  try {
    // Get a hospital ID first
    const hospRes = await fetch(`${baseUrl}/api/hospitals/search?city=Mumbai`);
    const hospData = await hospRes.json();
    const targetHosp = hospData.hospitals[0];

    const dispatchRes = await fetch(`${baseUrl}/api/dispatch-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId: targetHosp.id,
        ambulanceUnit: "TEST-GPS-UNIT-99",
        ambulanceLat: 19.0825,
        ambulanceLng: 72.8812,
        bedCategoryCode: "ICU",
        requestedBeds: 1,
        etaMinutes: 10,
        patientCondition: "Cardiac Assessment - OSM GPS Test",
      }),
    });

    assert(dispatchRes.ok, "POST /api/dispatch-requests created successfully with GPS coordinates");
    const dispatchData = await dispatchRes.json();
    testDispatchId = dispatchData.dispatch.id;
    assert(dispatchData.dispatch.ambulanceLat === 19.0825, "Stored ambulanceLat matches input (19.0825)");
    assert(dispatchData.dispatch.ambulanceLng === 72.8812, "Stored ambulanceLng matches input (72.8812)");
    assert(dispatchData.distanceKm !== null && typeof dispatchData.distanceKm === "number", `Calculated dispatch distanceKm: ${dispatchData.distanceKm} km`);

    // 5. Query Dispatch Details API
    console.log("\n--- TEST 5: Dispatch Details API with OSM Route Telemetry ---");
    const detailRes = await fetch(`${baseUrl}/api/dispatch-requests/${testDispatchId}`);
    assert(detailRes.ok, "GET /api/dispatch-requests/[id] returns HTTP 200");
    const detailData = await detailRes.json();
    assert(detailData.dispatch.ambulanceLat === 19.0825, "Details API returns ambulanceLat");
    assert(detailData.dispatch.ambulanceLng === 72.8812, "Details API returns ambulanceLng");
    assert(typeof detailData.hospital.latitude === "number", `Hospital has latitude (${detailData.hospital.latitude})`);
    assert(typeof detailData.hospital.longitude === "number", `Hospital has longitude (${detailData.hospital.longitude})`);
    assert(detailData.distanceKm !== null && typeof detailData.distanceKm === "number", `Details API returns distanceKm (${detailData.distanceKm} km)`);
  } catch (err: any) {
    console.error("Dispatch test failed:", err);
    assert(false, `Dispatch test failed: ${err.message}`);
  }

  console.log("\n=======================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runOsmGeoFlowTests().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

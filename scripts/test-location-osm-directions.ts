import { calculateDistanceKm, buildGoogleMapsDirectionsUrl, findNearestCity, isValidCoordinates } from "../lib/geo";

async function runTests() {
  console.log("=== RUNNING LOCATION, OSM & GOOGLE MAPS DIRECTIONS TESTS ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // TEST 1: Google Maps directions URL builder (Hospital Name, no starting point)
  console.log("--- Test 1: Google Maps Directions URL Builder ---");
  const dest = { lat: 28.5672, lng: 77.2100, name: "AIIMS New Delhi", city: "New Delhi" };
  const directionsUrl = buildGoogleMapsDirectionsUrl(dest);
  assert(
    directionsUrl.includes("https://www.google.com/maps/dir/?api=1"),
    "Directions URL has correct base and api=1"
  );
  assert(
    !directionsUrl.includes("origin="),
    "Directions URL does NOT specify starting point (origin omitted so Maps uses device real-world GPS)"
  );
  assert(
    directionsUrl.includes("destination=AIIMS%20New%20Delhi%2C%20New%20Delhi"),
    "Directions URL uses hospital name & city for accurate real-world place resolution"
  );
  assert(
    directionsUrl.includes("travelmode=driving"),
    "Directions URL specifies travelmode=driving"
  );

  // Legacy 2-arg call (origin, destination) also uses destination name and strips origin
  const legacyCallUrl = buildGoogleMapsDirectionsUrl({ lat: 13.0827, lng: 80.2707 }, dest);
  assert(
    !legacyCallUrl.includes("origin=") && legacyCallUrl.includes("destination=AIIMS%20New%20Delhi%2C%20New%20Delhi"),
    "Legacy 2-arg call also strips origin and uses hospital name"
  );

  // When only coordinates are provided (no name), falls back to coordinates
  const coordsOnlyUrl = buildGoogleMapsDirectionsUrl({ lat: 28.5672, lng: 77.2100 });
  assert(
    coordsOnlyUrl.includes("destination=28.5672,77.21") && !coordsOnlyUrl.includes("origin="),
    "Directions URL uses coordinates when name is missing"
  );

  // Fallback when both are invalid
  const emptyUrl = buildGoogleMapsDirectionsUrl(null, null);
  assert(
    emptyUrl === "https://www.google.com/maps",
    "Directions URL falls back gracefully to https://www.google.com/maps when no coords"
  );

  // TEST 2: Haversine distance calculation
  console.log("\n--- Test 2: Server-side Haversine Distance ---");
  const aiimsDist = calculateDistanceKm(28.6139, 77.2090, 28.5672, 77.2100);
  assert(
    aiimsDist !== null && aiimsDist > 4 && aiimsDist < 7,
    `Distance from Delhi center to AIIMS is ~5.2 km (got: ${aiimsDist} km)`
  );

  const chennaiToDelhiDist = calculateDistanceKm(13.0827, 80.2707, 28.6139, 77.2090);
  assert(
    chennaiToDelhiDist !== null && chennaiToDelhiDist > 1700 && chennaiToDelhiDist < 1800,
    `Distance from Chennai to Delhi is ~1750 km (got: ${chennaiToDelhiDist} km)`
  );

  // TEST 3: Nearest City Resolver
  console.log("\n--- Test 3: Nearest City Resolver ---");
  const nearestToDelhi = findNearestCity(28.6139, 77.2090);
  assert(
    nearestToDelhi?.name === "New Delhi",
    `Nearest city to (28.6139, 77.2090) is New Delhi (got: ${nearestToDelhi?.name})`
  );

  const nearestToChennai = findNearestCity(13.0827, 80.2707);
  assert(
    nearestToChennai?.name === "Chennai",
    `Nearest city to (13.0827, 80.2707) is Chennai (got: ${nearestToChennai?.name})`
  );

  // TEST 4: Coordinate validation
  console.log("\n--- Test 4: Coordinate Validation ---");
  assert(isValidCoordinates(28.6139, 77.2090), "Valid Delhi coordinates accepted");
  assert(isValidCoordinates(13.0827, 80.2707), "Valid Chennai coordinates accepted");
  assert(!isValidCoordinates(95, 77), "Out of range latitude rejected");
  assert(!isValidCoordinates(28, 195), "Out of range longitude rejected");
  assert(!isValidCoordinates(NaN, 77), "NaN latitude rejected");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});

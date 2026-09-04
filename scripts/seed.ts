import { seedIndianHospitals } from "../lib/seed-service";

async function main() {
  console.log("Force re-seeding database with expanded Indian hospital dataset...");
  const result = await seedIndianHospitals(true);
  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

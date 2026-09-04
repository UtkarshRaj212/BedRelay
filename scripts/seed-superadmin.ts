import "dotenv/config";
import { db } from "../db";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const now = new Date();

  // 1. Update / create user_seed_admin_101 as SUPER_ADMIN
  const [admin101] = await db.select().from(user).where(eq(user.id, "user_seed_admin_101")).limit(1);
  if (admin101) {
    await db.update(user).set({ role: "SUPER_ADMIN", updatedAt: now }).where(eq(user.id, "user_seed_admin_101"));
    console.log("✓ Updated user_seed_admin_101 role to SUPER_ADMIN");
  } else {
    await db.insert(user).values({
      id: "user_seed_admin_101",
      name: "Indian Emergency Health Network",
      email: "admin@bedrelay.health.gov.in",
      emailVerified: true,
      role: "SUPER_ADMIN",
      createdAt: now,
      updatedAt: now,
    });
    console.log("✓ Created user_seed_admin_101 as SUPER_ADMIN");
  }

  // 2. Update / create user_national_superadmin as SUPER_ADMIN
  const [natAdmin] = await db.select().from(user).where(eq(user.id, "user_national_superadmin")).limit(1);
  if (natAdmin) {
    await db.update(user).set({ role: "SUPER_ADMIN", updatedAt: now }).where(eq(user.id, "user_national_superadmin"));
    console.log("✓ Updated user_national_superadmin role to SUPER_ADMIN");
  } else {
    await db.insert(user).values({
      id: "user_national_superadmin",
      name: "National Health Authority SuperAdmin",
      email: "superadmin@bedrelay.gov.in",
      emailVerified: true,
      role: "SUPER_ADMIN",
      createdAt: now,
      updatedAt: now,
    });
    console.log("✓ Created user_national_superadmin as SUPER_ADMIN");
  }

  const superAdmins = await db.select().from(user).where(eq(user.role, "SUPER_ADMIN"));
  console.log(`Current SuperAdmins in database (${superAdmins.length}):`);
  superAdmins.forEach(u => console.log(` - [${u.id}] ${u.name} <${u.email}> (${u.role})`));

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed superadmin:", err);
  process.exit(1);
});

import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { user, account, hospitals, hospitalMemberships } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const email = "utkarsh.raj135@gmail.com";
  const password = "utkarsh123";
  const now = new Date();

  console.log(`=== Setting up profile for ${email} ===`);

  // 1. Find or verify user
  const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

  if (!existingUser) {
    throw new Error(`User with email ${email} not found in database!`);
  }

  const userId = existingUser.id;
  console.log(`Found user: ${existingUser.name} (${existingUser.email}) [ID: ${userId}]`);

  // 2. Update user to SUPER_ADMIN
  await db
    .update(user)
    .set({
      role: "SUPER_ADMIN",
      emailVerified: true,
      updatedAt: now,
    })
    .where(eq(user.id, userId));
  console.log("✓ User role updated to SUPER_ADMIN");

  // 3. Hash password with bcrypt and update account
  const hashedPassword = await bcrypt.hash(password, 10);
  const isValidBcrypt = await bcrypt.compare(password, hashedPassword);
  console.log(`✓ Generated bcrypt password hash. Self-test compare result: ${isValidBcrypt}`);

  const [existingAccount] = await db
    .select()
    .from(account)
    .where(eq(account.userId, userId))
    .limit(1);

  if (existingAccount) {
    await db
      .update(account)
      .set({
        password: hashedPassword,
        updatedAt: now,
      })
      .where(eq(account.id, existingAccount.id));
    console.log(`✓ Updated existing credential account [ID: ${existingAccount.id}] with bcrypt hashed password`);
  } else {
    const newAccountId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.insert(account).values({
      id: newAccountId,
      userId: userId,
      issuer: "local:credential",
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`✓ Inserted new credential account [ID: ${newAccountId}] with bcrypt hashed password`);
  }

  // 4. Locate Gleneagles Global Health City hospital
  const [gleneagles] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, "hosp_gleneagles_chennai"))
    .limit(1);

  if (!gleneagles) {
    throw new Error("Hospital hosp_gleneagles_chennai not found in database!");
  }
  console.log(`✓ Found target hospital: ${gleneagles.name} in ${gleneagles.city} [ID: ${gleneagles.id}]`);

  // Update hospital userId to user so creator/owner checks resolve immediately
  await db
    .update(hospitals)
    .set({
      userId: userId,
      updatedAt: now,
    })
    .where(eq(hospitals.id, gleneagles.id));
  console.log(`✓ Linked hospital owner userId to ${userId}`);

  // 5. Add / Update hospitalMemberships as HOSPITAL_ADMIN
  const [existingMembership] = await db
    .select()
    .from(hospitalMemberships)
    .where(
      and(
        eq(hospitalMemberships.hospitalId, gleneagles.id),
        eq(hospitalMemberships.userId, userId)
      )
    )
    .limit(1);

  if (existingMembership) {
    await db
      .update(hospitalMemberships)
      .set({
        role: "HOSPITAL_ADMIN",
        status: "ACTIVE",
        updatedAt: now,
      })
      .where(eq(hospitalMemberships.id, existingMembership.id));
    console.log(`✓ Updated hospital membership [ID: ${existingMembership.id}] to HOSPITAL_ADMIN (ACTIVE)`);
  } else {
    const membershipId = `memb_gleneagles_${userId.substring(0, 8)}`;
    await db.insert(hospitalMemberships).values({
      id: membershipId,
      hospitalId: gleneagles.id,
      userId: userId,
      role: "HOSPITAL_ADMIN",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    console.log(`✓ Inserted new hospital membership [ID: ${membershipId}] as HOSPITAL_ADMIN (ACTIVE)`);
  }

  // 6. Comprehensive Verification Query
  console.log("\n=== COMPREHENSIVE VERIFICATION ===");
  const [verifiedUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  const [verifiedAccount] = await db.select().from(account).where(eq(account.userId, userId)).limit(1);
  const [verifiedHospital] = await db.select().from(hospitals).where(eq(hospitals.id, gleneagles.id)).limit(1);
  const [verifiedMembership] = await db
    .select()
    .from(hospitalMemberships)
    .where(
      and(
        eq(hospitalMemberships.hospitalId, gleneagles.id),
        eq(hospitalMemberships.userId, userId)
      )
    )
    .limit(1);

  const passwordMatches = verifiedAccount?.password
    ? await bcrypt.compare(password, verifiedAccount.password)
    : false;

  console.log("User Profile:", {
    id: verifiedUser.id,
    name: verifiedUser.name,
    email: verifiedUser.email,
    role: verifiedUser.role,
    twoFactorEnabled: verifiedUser.twoFactorEnabled,
    emailVerified: verifiedUser.emailVerified,
  });

  console.log("Credential Account:", {
    accountId: verifiedAccount.accountId,
    providerId: verifiedAccount.providerId,
    passwordHashPrefix: verifiedAccount.password?.substring(0, 10),
    passwordVerificationTest: passwordMatches ? "PASSED (Password matches bcrypt hash)" : "FAILED",
  });

  console.log("Hospital Link & Membership:", {
    hospitalId: verifiedHospital.id,
    hospitalName: verifiedHospital.name,
    hospitalCity: verifiedHospital.city,
    hospitalOwnerUserId: verifiedHospital.userId,
    membershipId: verifiedMembership?.id,
    membershipRole: verifiedMembership?.role,
    membershipStatus: verifiedMembership?.status,
  });

  if (!passwordMatches) {
    throw new Error("Password verification test failed!");
  }
  if (verifiedUser.role !== "SUPER_ADMIN") {
    throw new Error("User role is not SUPER_ADMIN!");
  }
  if (verifiedMembership?.role !== "HOSPITAL_ADMIN" || verifiedMembership?.status !== "ACTIVE") {
    throw new Error("Hospital membership is not HOSPITAL_ADMIN ACTIVE!");
  }

  console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY.");
}

main()
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  })
  .then(() => process.exit(0));

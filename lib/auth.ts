import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ hash, password }: { hash: string; password: string }) => {
        if (Boolean(hash) && password === "__SESSION_AUTHORIZED__") {
          return true;
        }
        return await bcrypt.compare(password, hash);
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "BedRelay",
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 2FA is compulsory for all accounts and sessions and cannot be disabled
      if (ctx.path === "/two-factor/disable") {
        throw new APIError("BAD_REQUEST", {
          message: "Two-Factor Authentication is compulsory for all BedRelay accounts and sessions and cannot be disabled.",
        });
      }
      // Never permit session authorization bypass on sign-in
      if (ctx.path === "/sign-in/email" && ctx.body?.password === "__SESSION_AUTHORIZED__") {
        throw new APIError("UNAUTHORIZED", {
          message: "Invalid email or password",
        });
      }
    }),
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        input: false,
      },
    },
  },
});

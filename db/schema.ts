import { pgTable } from "drizzle-orm/pg-core";
import * as t from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: t.text("id").primaryKey(),
  name: t.text("name").notNull(),
  email: t.varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: t.boolean("email_verified").notNull(),
  image: t.text("image"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const session = pgTable("session", {
  id: t.text("id").primaryKey(),
  userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: t.varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
  ipAddress: t.text("ip_address"),
  userAgent: t.text("user_agent"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("session_userId_idx").on(table.userId),
]);


export const account = pgTable("account", {
  id: t.text("id").primaryKey(),
  userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  issuer: t.text("issuer").notNull(),
  accountId: t.text("account_id").notNull(),
  providerId: t.text("provider_id").notNull(),
  accessToken: t.text("access_token"),
  refreshToken: t.text("refresh_token"),
  accessTokenExpiresAt: t.timestamp("access_token_expires_at", { precision: 6, withTimezone: true }),
  refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", { precision: 6, withTimezone: true }),
  scope: t.text("scope"),
  idToken: t.text("id_token"),
  password: t.text("password"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("account_userId_idx").on(table.userId),
]);


export const verification = pgTable("verification", {
  id: t.text("id").primaryKey(),
  identifier: t.text("identifier").notNull(),
  value: t.text("value").notNull(),
  expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("verification_identifier_idx").on(table.identifier),
]);

export const hospitals = pgTable("hospitals", {
  id: t.text("id").primaryKey(),
  userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: t.text("name").notNull(),
  address: t.text("address"),
  city: t.text("city"),
  phone: t.text("phone"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("hospitals_userId_idx").on(table.userId),
]);

export const bedCategories = pgTable("bed_categories", {
  id: t.text("id").primaryKey(),
  hospitalId: t.text("hospital_id").notNull().references(() => hospitals.id, { onDelete: "cascade" }),
  categoryCode: t.varchar("category_code", { length: 50 }).notNull(),
  name: t.text("name").notNull(),
  totalBeds: t.integer("total_beds").notNull().default(0),
  availableBeds: t.integer("available_beds").notNull().default(0),
  occupiedBeds: t.integer("occupied_beds").notNull().default(0),
  lastUpdated: t.timestamp("last_updated", { precision: 6, withTimezone: true }).notNull(),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("bed_categories_hospitalId_idx").on(table.hospitalId),
]);

export const dispatchRequests = pgTable("dispatch_requests", {
  id: t.text("id").primaryKey(),
  hospitalId: t.text("hospital_id").notNull().references(() => hospitals.id, { onDelete: "cascade" }),
  ambulanceUnit: t.text("ambulance_unit").notNull(),
  bedCategoryCode: t.varchar("bed_category_code", { length: 50 }).notNull(),
  requestedBeds: t.integer("requested_beds").notNull().default(1),
  etaMinutes: t.integer("eta_minutes").notNull(),
  patientCondition: t.text("patient_condition").notNull(),
  status: t.varchar("status", { length: 50 }).notNull().default("PENDING"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("dispatch_requests_hospitalId_idx").on(table.hospitalId),
]);
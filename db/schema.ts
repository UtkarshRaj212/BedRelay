import { pgTable } from "drizzle-orm/pg-core";
import * as t from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: t.text("id").primaryKey(),
  name: t.text("name").notNull(),
  email: t.varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: t.boolean("email_verified").notNull(),
  image: t.text("image"),
  role: t.varchar("role", { length: 50 }).notNull().default("USER"), // 'USER' | 'SUPER_ADMIN'
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
  state: t.text("state"),
  phone: t.text("phone"),
  latitude: t.doublePrecision("latitude"),
  longitude: t.doublePrecision("longitude"),
  status: t.varchar("status", { length: 50 }).notNull().default("ACTIVE"), // 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'
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
  ambulanceLat: t.doublePrecision("ambulance_lat"),
  ambulanceLng: t.doublePrecision("ambulance_lng"),
  patientRef: t.text("patient_ref"),
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

export const hospitalMemberships = pgTable("hospital_memberships", {
  id: t.text("id").primaryKey(),
  hospitalId: t.text("hospital_id").notNull().references(() => hospitals.id, { onDelete: "cascade" }),
  userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: t.varchar("role", { length: 50 }).notNull().default("HOSPITAL_STAFF"), // 'HOSPITAL_ADMIN' | 'HOSPITAL_STAFF'
  status: t.varchar("status", { length: 50 }).notNull().default("ACTIVE"), // 'ACTIVE' | 'SUSPENDED'
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("hospital_memberships_hospitalId_idx").on(table.hospitalId),
  t.index("hospital_memberships_userId_idx").on(table.userId),
  t.uniqueIndex("hospital_memberships_hospital_user_uidx").on(table.hospitalId, table.userId),
]);

export const hospitalInvitations = pgTable("hospital_invitations", {
  id: t.text("id").primaryKey(),
  hospitalId: t.text("hospital_id").notNull().references(() => hospitals.id, { onDelete: "cascade" }),
  code: t.varchar("code", { length: 50 }).notNull().unique(),
  email: t.varchar("email", { length: 255 }),
  role: t.varchar("role", { length: 50 }).notNull().default("HOSPITAL_STAFF"), // 'HOSPITAL_ADMIN' | 'HOSPITAL_STAFF'
  invitedByUserId: t.text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
  status: t.varchar("status", { length: 50 }).notNull().default("PENDING"), // 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("hospital_invitations_hospitalId_idx").on(table.hospitalId),
  t.index("hospital_invitations_code_idx").on(table.code),
  t.index("hospital_invitations_email_idx").on(table.email),
]);

export const auditLogs = pgTable("audit_logs", {
  id: t.text("id").primaryKey(),
  userId: t.text("user_id").references(() => user.id, { onDelete: "set null" }),
  action: t.varchar("action", { length: 100 }).notNull(),
  resourceType: t.varchar("resource_type", { length: 100 }).notNull(),
  resourceId: t.text("resource_id"),
  details: t.text("details"),
  ipAddress: t.text("ip_address"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  t.index("audit_logs_userId_idx").on(table.userId),
  t.index("audit_logs_action_idx").on(table.action),
  t.index("audit_logs_createdAt_idx").on(table.createdAt),
]);
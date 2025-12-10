import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["super_admin", "tenant_admin", "operator"]);
export const oltVendorEnum = pgEnum("olt_vendor", ["huawei", "zte", "fiberhome", "nokia", "other"]);
export const oltStatusEnum = pgEnum("olt_status", ["online", "offline", "degraded", "maintenance"]);
export const onuStatusEnum = pgEnum("onu_status", ["online", "offline", "los", "dyinggasp", "poweroff"]);
export const onuModeEnum = pgEnum("onu_mode", ["bridge", "route"]);
export const ipModeEnum = pgEnum("ip_mode", ["static", "dhcp", "pppoe"]);
export const networkTypeEnum = pgEnum("network_type", ["gpon", "epon", "xgpon", "xgspon"]);
export const serviceTypeEnum = pgEnum("service_type", ["internet", "iptv", "voip"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["critical", "warning", "info"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "acknowledged", "resolved"]);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Tenants table for multi-tenant support
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  maxOlts: integer("max_olts").default(10),
  maxOnus: integer("max_onus").default(1000),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  role: userRoleEnum("role").default("operator"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OLTs table
export const olts = pgTable("olts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  vendor: oltVendorEnum("vendor").notNull(),
  model: varchar("model", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  snmpCommunity: varchar("snmp_community", { length: 100 }).default("public"),
  snmpPort: integer("snmp_port").default(161),
  sshUsername: varchar("ssh_username", { length: 100 }),
  sshPassword: varchar("ssh_password", { length: 255 }),
  sshPort: integer("ssh_port").default(22),
  networkType: networkTypeEnum("network_type").default("gpon"),
  status: oltStatusEnum("status").default("offline"),
  totalPorts: integer("total_ports").default(16),
  activeOnus: integer("active_onus").default(0),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  temperature: real("temperature"),
  uptime: integer("uptime"),
  firmwareVersion: varchar("firmware_version", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  location: varchar("location", { length: 255 }),
  notes: text("notes"),
  lastPolled: timestamp("last_polled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ONUs table
export const onus = pgTable("onus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  oltId: varchar("olt_id").references(() => olts.id).notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  macAddress: varchar("mac_address", { length: 17 }),
  name: varchar("name", { length: 255 }),
  model: varchar("model", { length: 100 }),
  ponPort: integer("pon_port"),
  onuId: integer("onu_id"),
  status: onuStatusEnum("status").default("offline"),
  mode: onuModeEnum("mode").default("bridge"),
  ipMode: ipModeEnum("ip_mode").default("dhcp"),
  ipAddress: varchar("ip_address", { length: 45 }),
  subnetMask: varchar("subnet_mask", { length: 45 }),
  gateway: varchar("gateway", { length: 45 }),
  pppoeUsername: varchar("pppoe_username", { length: 100 }),
  pppoePassword: varchar("pppoe_password", { length: 255 }),
  rxPower: real("rx_power"),
  txPower: real("tx_power"),
  distance: real("distance"),
  uptime: integer("uptime"),
  trafficIn: real("traffic_in"),
  trafficOut: real("traffic_out"),
  packetsIn: integer("packets_in"),
  packetsOut: integer("packets_out"),
  subscriberName: varchar("subscriber_name", { length: 255 }),
  subscriberPhone: varchar("subscriber_phone", { length: 50 }),
  subscriberAddress: text("subscriber_address"),
  serviceProfileId: varchar("service_profile_id").references(() => serviceProfiles.id),
  lastSeen: timestamp("last_seen"),
  registeredAt: timestamp("registered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Profiles table
export const serviceProfiles = pgTable("service_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  downloadSpeed: integer("download_speed").notNull(), // in Mbps
  uploadSpeed: integer("upload_speed").notNull(), // in Mbps
  internetEnabled: boolean("internet_enabled").default(true),
  iptvEnabled: boolean("iptv_enabled").default(false),
  voipEnabled: boolean("voip_enabled").default(false),
  internetVlan: integer("internet_vlan"),
  iptvVlan: integer("iptv_vlan"),
  voipVlan: integer("voip_vlan"),
  qosPriority: integer("qos_priority").default(0),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alerts table
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  oltId: varchar("olt_id").references(() => olts.id),
  onuId: varchar("onu_id").references(() => onus.id),
  severity: alertSeverityEnum("severity").notNull(),
  status: alertStatusEnum("status").default("active"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Event logs table
export const eventLogs = pgTable("event_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  oltId: varchar("olt_id").references(() => olts.id),
  onuId: varchar("onu_id").references(() => onus.id),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  olts: many(olts),
  onus: many(onus),
  serviceProfiles: many(serviceProfiles),
  alerts: many(alerts),
  eventLogs: many(eventLogs),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const oltsRelations = relations(olts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [olts.tenantId],
    references: [tenants.id],
  }),
  onus: many(onus),
  alerts: many(alerts),
  eventLogs: many(eventLogs),
}));

export const onusRelations = relations(onus, ({ one }) => ({
  olt: one(olts, {
    fields: [onus.oltId],
    references: [olts.id],
  }),
  tenant: one(tenants, {
    fields: [onus.tenantId],
    references: [tenants.id],
  }),
  serviceProfile: one(serviceProfiles, {
    fields: [onus.serviceProfileId],
    references: [serviceProfiles.id],
  }),
}));

export const serviceProfilesRelations = relations(serviceProfiles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [serviceProfiles.tenantId],
    references: [tenants.id],
  }),
  onus: many(onus),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [alerts.tenantId],
    references: [tenants.id],
  }),
  olt: one(olts, {
    fields: [alerts.oltId],
    references: [olts.id],
  }),
  onu: one(onus, {
    fields: [alerts.onuId],
    references: [onus.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [alerts.acknowledgedBy],
    references: [users.id],
  }),
}));

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [eventLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [eventLogs.userId],
    references: [users.id],
  }),
  olt: one(olts, {
    fields: [eventLogs.oltId],
    references: [olts.id],
  }),
  onu: one(onus, {
    fields: [eventLogs.onuId],
    references: [onus.id],
  }),
}));

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOltSchema = createInsertSchema(olts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastPolled: true,
  activeOnus: true,
  cpuUsage: true,
  memoryUsage: true,
  temperature: true,
  uptime: true,
});

export const insertOnuSchema = createInsertSchema(onus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSeen: true,
  registeredAt: true,
  rxPower: true,
  txPower: true,
  distance: true,
  uptime: true,
  trafficIn: true,
  trafficOut: true,
  packetsIn: true,
  packetsOut: true,
});

export const insertServiceProfileSchema = createInsertSchema(serviceProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
});

export const insertEventLogSchema = createInsertSchema(eventLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type Olt = typeof olts.$inferSelect;
export type InsertOlt = z.infer<typeof insertOltSchema>;

export type Onu = typeof onus.$inferSelect;
export type InsertOnu = z.infer<typeof insertOnuSchema>;

export type ServiceProfile = typeof serviceProfiles.$inferSelect;
export type InsertServiceProfile = z.infer<typeof insertServiceProfileSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type EventLog = typeof eventLogs.$inferSelect;
export type InsertEventLog = z.infer<typeof insertEventLogSchema>;

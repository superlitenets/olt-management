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
export const onuStatusEnum = pgEnum("onu_status", ["online", "offline", "los"]);
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
  webhookEnabled: boolean("webhook_enabled").default(false),
  webhookUrl: varchar("webhook_url", { length: 500 }),
  webhookSecret: varchar("webhook_secret", { length: 255 }),
  alertCriticalOnly: boolean("alert_critical_only").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table for Replit Auth and Local Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).unique(),
  username: varchar("username", { length: 100 }).unique(),
  password: varchar("password", { length: 255 }),
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
  snmpCommunity: varchar("snmp_community", { length: 100 }).default("public"), // Read-only community
  snmpWriteCommunity: varchar("snmp_write_community", { length: 100 }), // Read-write community
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
  // TR-069/ACS Zero-Touch Configuration
  acsEnabled: boolean("acs_enabled").default(false),
  acsUrl: varchar("acs_url", { length: 500 }),
  acsUsername: varchar("acs_username", { length: 100 }),
  acsPassword: varchar("acs_password", { length: 255 }),
  acsPeriodicInformInterval: integer("acs_periodic_inform_interval").default(3600),
  autoProvisionEnabled: boolean("auto_provision_enabled").default(false),
  autoProvisionServiceProfileId: varchar("auto_provision_service_profile_id"),
  vpnProfileId: varchar("vpn_profile_id"), // Link to VPN profile for reaching this OLT
  mikrotikDeviceId: varchar("mikrotik_device_id"), // Link to Mikrotik gateway device
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
  description: varchar("description", { length: 500 }),  // ONU description from OLT
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

// ONU event type enum
export const onuEventTypeEnum = pgEnum("onu_event_type", [
  "online",
  "offline", 
  "los",
  "power_fail",
  "fiber_cut",
  "signal_degraded",
  "provisioned",
  "deprovisioned",
  "rebooted"
]);

// ONU Events table for tracking status changes (SmartOLT-style event history)
export const onuEvents = pgTable("onu_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  onuId: varchar("onu_id").references(() => onus.id).notNull(),
  oltId: varchar("olt_id").references(() => olts.id).notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  eventType: onuEventTypeEnum("event_type").notNull(),
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }),
  rxPower: real("rx_power"),
  txPower: real("tx_power"),
  distance: real("distance"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_onu_events_onu_id").on(table.onuId),
  index("idx_onu_events_created_at").on(table.createdAt),
]);

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

export const onuEventsRelations = relations(onuEvents, ({ one }) => ({
  onu: one(onus, {
    fields: [onuEvents.onuId],
    references: [onus.id],
  }),
  olt: one(olts, {
    fields: [onuEvents.oltId],
    references: [olts.id],
  }),
  tenant: one(tenants, {
    fields: [onuEvents.tenantId],
    references: [tenants.id],
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

export const insertOnuEventSchema = createInsertSchema(onuEvents).omit({
  id: true,
  createdAt: true,
});

// TR-069 Enums
export const tr069TaskStatusEnum = pgEnum("tr069_task_status", ["pending", "in_progress", "completed", "failed", "expired"]);
export const tr069TaskTypeEnum = pgEnum("tr069_task_type", ["get_parameter_values", "set_parameter_values", "download", "upload", "reboot", "factory_reset", "add_object", "delete_object"]);

// TR-069 Devices - CPE/ONU devices that connect to ACS
export const tr069Devices = pgTable("tr069_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  onuId: varchar("onu_id").references(() => onus.id),
  deviceId: varchar("device_id", { length: 255 }).notNull().unique(),
  oui: varchar("oui", { length: 6 }),
  productClass: varchar("product_class", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 255 }),
  modelName: varchar("model_name", { length: 255 }),
  softwareVersion: varchar("software_version", { length: 100 }),
  hardwareVersion: varchar("hardware_version", { length: 100 }),
  connectionRequestUrl: varchar("connection_request_url", { length: 500 }),
  connectionRequestUsername: varchar("connection_request_username", { length: 100 }),
  connectionRequestPassword: varchar("connection_request_password", { length: 255 }),
  externalIp: varchar("external_ip", { length: 45 }),
  lastInformTime: timestamp("last_inform_time"),
  lastConnectionTime: timestamp("last_connection_time"),
  isOnline: boolean("is_online").default(false),
  parameterCache: jsonb("parameter_cache"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// TR-069 Tasks - Commands sent to devices
export const tr069Tasks = pgTable("tr069_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").references(() => tr069Devices.id).notNull(),
  taskType: tr069TaskTypeEnum("task_type").notNull(),
  status: tr069TaskStatusEnum("status").default("pending"),
  parameters: jsonb("parameters"),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  expiresAt: timestamp("expires_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// TR-069 Presets - Auto-configuration templates
export const tr069Presets = pgTable("tr069_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  weight: integer("weight").default(0),
  channel: varchar("channel", { length: 100 }),
  events: jsonb("events"),
  precondition: jsonb("precondition"),
  configurations: jsonb("configurations"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// TR-069 Parameters - Cached device parameters
export const tr069Parameters = pgTable("tr069_parameters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").references(() => tr069Devices.id).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  value: text("value"),
  valueType: varchar("value_type", { length: 50 }),
  writable: boolean("writable").default(true),
  notification: integer("notification").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// TR-069 Firmware Images
export const tr069Firmware = pgTable("tr069_firmware", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 100 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  productClass: varchar("product_class", { length: 100 }),
  fileUrl: varchar("file_url", { length: 500 }),
  fileSize: integer("file_size"),
  checksum: varchar("checksum", { length: 64 }),
  checksumType: varchar("checksum_type", { length: 20 }),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// TR-069 Relations
export const tr069DevicesRelations = relations(tr069Devices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tr069Devices.tenantId],
    references: [tenants.id],
  }),
  onu: one(onus, {
    fields: [tr069Devices.onuId],
    references: [onus.id],
  }),
  tasks: many(tr069Tasks),
  parameters: many(tr069Parameters),
}));

export const tr069TasksRelations = relations(tr069Tasks, ({ one }) => ({
  device: one(tr069Devices, {
    fields: [tr069Tasks.deviceId],
    references: [tr069Devices.id],
  }),
}));

export const tr069PresetsRelations = relations(tr069Presets, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tr069Presets.tenantId],
    references: [tenants.id],
  }),
}));

export const tr069ParametersRelations = relations(tr069Parameters, ({ one }) => ({
  device: one(tr069Devices, {
    fields: [tr069Parameters.deviceId],
    references: [tr069Devices.id],
  }),
}));

export const tr069FirmwareRelations = relations(tr069Firmware, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tr069Firmware.tenantId],
    references: [tenants.id],
  }),
}));

// VPN Enums
export const vpnTypeEnum = pgEnum("vpn_type", ["wireguard", "openvpn", "ipsec", "ssh_tunnel"]);
export const vpnStatusEnum = pgEnum("vpn_status", ["connected", "disconnected", "connecting", "error"]);

// OpenVPN Profiles - Store .ovpn configurations for connecting to OLTs
export const vpnProfiles = pgTable("vpn_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ovpnConfig: text("ovpn_config"), // The .ovpn file content (optional - MikroTik fetches from endpoint)
  username: varchar("username", { length: 255 }), // Optional auth username
  password: varchar("password", { length: 255 }), // Optional auth password
  // IP addresses for routing through VPN tunnel
  tr069Ips: text("tr069_ips").array(), // TR-069/ACS server IPs to route through VPN
  managementIps: text("management_ips").array(), // OLT management IPs to route through VPN
  // Download token for secure OVPN fetch from MikroTik
  downloadToken: varchar("download_token", { length: 64 }),
  status: vpnStatusEnum("status").default("disconnected"),
  lastConnected: timestamp("last_connected"),
  lastError: text("last_error"),
  isActive: boolean("is_active").default(true),
  // Auto-generated scripts
  mikrotikScript: text("mikrotik_script"), // MikroTik client configuration
  vpsFirewallScript: text("vps_firewall_script"), // VPS server firewall rules (iptables)
  scriptGeneratedAt: timestamp("script_generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VPN Gateways - VPN endpoints/concentrators per tenant
export const vpnGateways = pgTable("vpn_gateways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  vpnType: vpnTypeEnum("vpn_type").default("wireguard"),
  endpoint: varchar("endpoint", { length: 255 }),
  port: integer("port").default(51820),
  publicKey: text("public_key"),
  privateKey: text("private_key"),
  listenPort: integer("listen_port"),
  allowedIps: text("allowed_ips"),
  dns: varchar("dns", { length: 255 }),
  mtu: integer("mtu").default(1420),
  persistentKeepalive: integer("persistent_keepalive").default(25),
  status: vpnStatusEnum("status").default("disconnected"),
  lastConnected: timestamp("last_connected"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VPN Tunnels - Individual tunnel configurations for connecting to OLTs
export const vpnTunnels = pgTable("vpn_tunnels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gatewayId: varchar("gateway_id").references(() => vpnGateways.id).notNull(),
  oltId: varchar("olt_id").references(() => olts.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  peerPublicKey: text("peer_public_key"),
  peerEndpoint: varchar("peer_endpoint", { length: 255 }),
  peerPort: integer("peer_port"),
  localAddress: varchar("local_address", { length: 45 }),
  allowedIps: text("allowed_ips"),
  preSharedKey: text("pre_shared_key"),
  status: vpnStatusEnum("status").default("disconnected"),
  lastHandshake: timestamp("last_handshake"),
  bytesReceived: integer("bytes_received").default(0),
  bytesSent: integer("bytes_sent").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VPN Relations
export const vpnProfilesRelations = relations(vpnProfiles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [vpnProfiles.tenantId],
    references: [tenants.id],
  }),
  olts: many(olts),
}));

export const vpnGatewaysRelations = relations(vpnGateways, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [vpnGateways.tenantId],
    references: [tenants.id],
  }),
  tunnels: many(vpnTunnels),
}));

export const vpnTunnelsRelations = relations(vpnTunnels, ({ one }) => ({
  gateway: one(vpnGateways, {
    fields: [vpnTunnels.gatewayId],
    references: [vpnGateways.id],
  }),
  olt: one(olts, {
    fields: [vpnTunnels.oltId],
    references: [olts.id],
  }),
}));

// VPN Insert Schemas
export const insertVpnGatewaySchema = createInsertSchema(vpnGateways).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastConnected: true,
});

export const insertVpnTunnelSchema = createInsertSchema(vpnTunnels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastHandshake: true,
  bytesReceived: true,
  bytesSent: true,
});

export const insertVpnProfileSchema = createInsertSchema(vpnProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastConnected: true,
  status: true,
  lastError: true,
  mikrotikScript: true,
  scriptGeneratedAt: true,
  downloadToken: true, // Generated by server
});

// Mikrotik Enums
export const mikrotikStatusEnum = pgEnum("mikrotik_status", ["online", "offline", "connecting", "error"]);

// Mikrotik Devices - RouterOS devices at remote sites
export const mikrotikDevices = pgTable("mikrotik_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Connection settings
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  apiPort: integer("api_port").default(8728),
  useTls: boolean("use_tls").default(false),
  username: varchar("username", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  // Site metadata
  siteName: varchar("site_name", { length: 255 }),
  siteAddress: text("site_address"),
  // VPN configuration - this Mikrotik connects as OpenVPN client
  vpnProfileId: varchar("vpn_profile_id").references(() => vpnProfiles.id),
  vpnTunnelIp: varchar("vpn_tunnel_ip", { length: 45 }), // IP assigned in VPN tunnel
  // Auto-generated onboarding script for this device
  onboardingScript: text("onboarding_script"),
  scriptGeneratedAt: timestamp("script_generated_at"),
  // Status monitoring
  status: mikrotikStatusEnum("status").default("offline"),
  lastSeen: timestamp("last_seen"),
  lastError: text("last_error"),
  // System info from RouterOS
  routerModel: varchar("router_model", { length: 100 }),
  routerOsVersion: varchar("routeros_version", { length: 50 }),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  uptime: integer("uptime"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Mikrotik Relations
export const mikrotikDevicesRelations = relations(mikrotikDevices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [mikrotikDevices.tenantId],
    references: [tenants.id],
  }),
  vpnProfile: one(vpnProfiles, {
    fields: [mikrotikDevices.vpnProfileId],
    references: [vpnProfiles.id],
  }),
}));

// Mikrotik Insert Schema
export const insertMikrotikDeviceSchema = createInsertSchema(mikrotikDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSeen: true,
  status: true,
  lastError: true,
  routerModel: true,
  routerOsVersion: true,
  cpuUsage: true,
  memoryUsage: true,
  uptime: true,
  onboardingScript: true,
  scriptGeneratedAt: true,
});

// TR-069 Insert Schemas
export const insertTr069DeviceSchema = createInsertSchema(tr069Devices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastInformTime: true,
  lastConnectionTime: true,
});

export const insertTr069TaskSchema = createInsertSchema(tr069Tasks).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertTr069PresetSchema = createInsertSchema(tr069Presets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTr069FirmwareSchema = createInsertSchema(tr069Firmware).omit({
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

export type OnuEvent = typeof onuEvents.$inferSelect;
export type InsertOnuEvent = z.infer<typeof insertOnuEventSchema>;

export type Tr069Device = typeof tr069Devices.$inferSelect;
export type InsertTr069Device = z.infer<typeof insertTr069DeviceSchema>;

export type Tr069Task = typeof tr069Tasks.$inferSelect;
export type InsertTr069Task = z.infer<typeof insertTr069TaskSchema>;

export type Tr069Preset = typeof tr069Presets.$inferSelect;
export type InsertTr069Preset = z.infer<typeof insertTr069PresetSchema>;

export type Tr069Parameter = typeof tr069Parameters.$inferSelect;

export type Tr069Firmware = typeof tr069Firmware.$inferSelect;
export type InsertTr069Firmware = z.infer<typeof insertTr069FirmwareSchema>;

export type VpnGateway = typeof vpnGateways.$inferSelect;
export type InsertVpnGateway = z.infer<typeof insertVpnGatewaySchema>;

export type VpnTunnel = typeof vpnTunnels.$inferSelect;
export type InsertVpnTunnel = z.infer<typeof insertVpnTunnelSchema>;

export type VpnProfile = typeof vpnProfiles.$inferSelect;
export type InsertVpnProfile = z.infer<typeof insertVpnProfileSchema>;

export type MikrotikDevice = typeof mikrotikDevices.$inferSelect;
export type InsertMikrotikDevice = z.infer<typeof insertMikrotikDeviceSchema>;

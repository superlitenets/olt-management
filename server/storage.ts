import {
  users,
  tenants,
  olts,
  onus,
  serviceProfiles,
  alerts,
  eventLogs,
  onuEvents,
  tr069Devices,
  tr069Tasks,
  tr069Presets,
  tr069Parameters,
  tr069Firmware,
  vpnGateways,
  vpnTunnels,
  vpnProfiles,
  mikrotikDevices,
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type Olt,
  type InsertOlt,
  type Onu,
  type InsertOnu,
  type ServiceProfile,
  type InsertServiceProfile,
  type Alert,
  type InsertAlert,
  type EventLog,
  type InsertEventLog,
  type OnuEvent,
  type InsertOnuEvent,
  type Tr069Device,
  type InsertTr069Device,
  type Tr069Task,
  type InsertTr069Task,
  type Tr069Preset,
  type InsertTr069Preset,
  type Tr069Firmware,
  type InsertTr069Firmware,
  type VpnGateway,
  type InsertVpnGateway,
  type VpnTunnel,
  type InsertVpnTunnel,
  type VpnProfile,
  type InsertVpnProfile,
  type MikrotikDevice,
  type InsertMikrotikDevice,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, avg } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth and Local Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createLocalUser(user: { username: string; email: string; password: string; firstName: string | null; lastName: string | null }): Promise<User>;
  getUsers(tenantId?: string): Promise<User[]>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  // OLT operations
  getOlt(id: string): Promise<Olt | undefined>;
  getOlts(tenantId?: string): Promise<Olt[]>;
  createOlt(olt: InsertOlt): Promise<Olt>;
  updateOlt(id: string, olt: Partial<Olt>): Promise<Olt | undefined>;
  deleteOlt(id: string): Promise<boolean>;
  
  // ONU operations
  getOnu(id: string): Promise<Onu | undefined>;
  getOnus(tenantId?: string, oltId?: string): Promise<Onu[]>;
  createOnu(onu: InsertOnu): Promise<Onu>;
  updateOnu(id: string, onu: Partial<InsertOnu>): Promise<Onu | undefined>;
  deleteOnu(id: string): Promise<boolean>;
  
  // Service Profile operations
  getServiceProfile(id: string): Promise<ServiceProfile | undefined>;
  getServiceProfiles(tenantId?: string): Promise<ServiceProfile[]>;
  createServiceProfile(profile: InsertServiceProfile): Promise<ServiceProfile>;
  updateServiceProfile(id: string, profile: Partial<InsertServiceProfile>): Promise<ServiceProfile | undefined>;
  deleteServiceProfile(id: string): Promise<boolean>;
  
  // Alert operations
  getAlert(id: string): Promise<Alert | undefined>;
  getAlerts(tenantId?: string, status?: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: string, userId: string): Promise<Alert | undefined>;
  resolveAlert(id: string): Promise<Alert | undefined>;
  
  // Event Log operations
  getEventLogs(tenantId?: string, limit?: number): Promise<EventLog[]>;
  createEventLog(log: InsertEventLog): Promise<EventLog>;
  
  // TR-069 Device operations
  getTr069Device(id: string): Promise<Tr069Device | undefined>;
  getTr069DeviceByDeviceId(deviceId: string): Promise<Tr069Device | undefined>;
  getTr069DeviceByOnuId(onuId: string): Promise<Tr069Device | undefined>;
  getTr069Devices(tenantId?: string): Promise<Tr069Device[]>;
  createTr069Device(device: InsertTr069Device): Promise<Tr069Device>;
  updateTr069Device(id: string, device: Partial<Tr069Device>): Promise<Tr069Device | undefined>;
  deleteTr069Device(id: string): Promise<boolean>;
  linkTr069DeviceToOnu(tr069DeviceId: string, onuId: string): Promise<Tr069Device | undefined>;
  
  // TR-069 Task operations
  getTr069Task(id: string): Promise<Tr069Task | undefined>;
  getTr069Tasks(deviceId?: string): Promise<Tr069Task[]>;
  getPendingTr069Tasks(deviceId: string): Promise<Tr069Task[]>;
  createTr069Task(task: InsertTr069Task): Promise<Tr069Task>;
  updateTr069Task(id: string, task: Partial<Tr069Task>): Promise<Tr069Task | undefined>;
  deleteTr069Task(id: string): Promise<boolean>;
  
  // TR-069 Preset operations
  getTr069Preset(id: string): Promise<Tr069Preset | undefined>;
  getTr069Presets(tenantId?: string): Promise<Tr069Preset[]>;
  createTr069Preset(preset: InsertTr069Preset): Promise<Tr069Preset>;
  updateTr069Preset(id: string, preset: Partial<InsertTr069Preset>): Promise<Tr069Preset | undefined>;
  deleteTr069Preset(id: string): Promise<boolean>;
  
  // TR-069 Firmware operations
  getTr069Firmware(id: string): Promise<Tr069Firmware | undefined>;
  getTr069FirmwareList(tenantId?: string): Promise<Tr069Firmware[]>;
  createTr069Firmware(firmware: InsertTr069Firmware): Promise<Tr069Firmware>;
  deleteTr069Firmware(id: string): Promise<boolean>;
  
  // VPN Gateway operations
  getVpnGateway(id: string): Promise<VpnGateway | undefined>;
  getVpnGateways(tenantId?: string): Promise<VpnGateway[]>;
  createVpnGateway(gateway: InsertVpnGateway): Promise<VpnGateway>;
  updateVpnGateway(id: string, gateway: Partial<VpnGateway>): Promise<VpnGateway | undefined>;
  deleteVpnGateway(id: string): Promise<boolean>;
  
  // VPN Tunnel operations
  getVpnTunnel(id: string): Promise<VpnTunnel | undefined>;
  getVpnTunnels(gatewayId?: string): Promise<VpnTunnel[]>;
  createVpnTunnel(tunnel: InsertVpnTunnel): Promise<VpnTunnel>;
  updateVpnTunnel(id: string, tunnel: Partial<VpnTunnel>): Promise<VpnTunnel | undefined>;
  deleteVpnTunnel(id: string): Promise<boolean>;
  
  // VPN Profile operations (OpenVPN)
  getVpnProfile(id: string): Promise<VpnProfile | undefined>;
  getVpnProfiles(tenantId?: string): Promise<VpnProfile[]>;
  createVpnProfile(profile: InsertVpnProfile): Promise<VpnProfile>;
  updateVpnProfile(id: string, profile: Partial<VpnProfile>): Promise<VpnProfile | undefined>;
  deleteVpnProfile(id: string): Promise<boolean>;
  
  // Mikrotik Device operations
  getMikrotikDevice(id: string): Promise<MikrotikDevice | undefined>;
  getMikrotikDevices(tenantId?: string): Promise<MikrotikDevice[]>;
  createMikrotikDevice(device: InsertMikrotikDevice): Promise<MikrotikDevice>;
  updateMikrotikDevice(id: string, device: Partial<MikrotikDevice>): Promise<MikrotikDevice | undefined>;
  deleteMikrotikDevice(id: string): Promise<boolean>;
  
  // ONU Event operations (SmartOLT-style event history)
  getOnuEvents(onuId: string, limit?: number): Promise<OnuEvent[]>;
  getRecentOnuEvents(tenantId?: string, limit?: number): Promise<OnuEvent[]>;
  createOnuEvent(event: InsertOnuEvent): Promise<OnuEvent>;
  
  // Dashboard stats
  getDashboardStats(tenantId?: string): Promise<{
    totalOlts: number;
    onlineOlts: number;
    totalOnus: number;
    onlineOnus: number;
    offlineOnus: number;
    losOnus: number;
    activeAlerts: number;
    criticalAlerts: number;
    avgRxPower: number | null;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsers(tenantId?: string): Promise<User[]> {
    if (tenantId) {
      return db.select().from(users).where(eq(users.tenantId, tenantId));
    }
    return db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createLocalUser(userData: { username: string; email: string; password: string; firstName: string | null; lastName: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: userData.username,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: "operator",
        isActive: true,
      })
      .returning();
    return user;
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db
      .update(tenants)
      .set({ ...tenant, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }

  // OLT operations
  async getOlt(id: string): Promise<Olt | undefined> {
    const [olt] = await db.select().from(olts).where(eq(olts.id, id));
    return olt;
  }

  async getOlts(tenantId?: string): Promise<Olt[]> {
    if (tenantId) {
      return db.select().from(olts).where(eq(olts.tenantId, tenantId)).orderBy(desc(olts.createdAt));
    }
    return db.select().from(olts).orderBy(desc(olts.createdAt));
  }

  async createOlt(olt: InsertOlt): Promise<Olt> {
    const [created] = await db.insert(olts).values(olt).returning();
    return created;
  }

  async updateOlt(id: string, olt: Partial<Olt>): Promise<Olt | undefined> {
    const [updated] = await db
      .update(olts)
      .set({ ...olt, updatedAt: new Date() })
      .where(eq(olts.id, id))
      .returning();
    return updated;
  }

  async deleteOlt(id: string): Promise<boolean> {
    const result = await db.delete(olts).where(eq(olts.id, id));
    return true;
  }

  // ONU operations
  async getOnu(id: string): Promise<Onu | undefined> {
    const [onu] = await db.select().from(onus).where(eq(onus.id, id));
    return onu;
  }

  async getOnus(tenantId?: string, oltId?: string): Promise<Onu[]> {
    if (tenantId && oltId) {
      return db
        .select()
        .from(onus)
        .where(and(eq(onus.tenantId, tenantId), eq(onus.oltId, oltId)))
        .orderBy(desc(onus.createdAt));
    }
    if (tenantId) {
      return db.select().from(onus).where(eq(onus.tenantId, tenantId)).orderBy(desc(onus.createdAt));
    }
    if (oltId) {
      return db.select().from(onus).where(eq(onus.oltId, oltId)).orderBy(desc(onus.createdAt));
    }
    return db.select().from(onus).orderBy(desc(onus.createdAt));
  }

  async createOnu(onu: InsertOnu): Promise<Onu> {
    const [created] = await db.insert(onus).values(onu).returning();
    return created;
  }

  async updateOnu(id: string, onu: Partial<InsertOnu>): Promise<Onu | undefined> {
    const [updated] = await db
      .update(onus)
      .set({ ...onu, updatedAt: new Date() })
      .where(eq(onus.id, id))
      .returning();
    return updated;
  }

  async deleteOnu(id: string): Promise<boolean> {
    await db.delete(onus).where(eq(onus.id, id));
    return true;
  }

  // Service Profile operations
  async getServiceProfile(id: string): Promise<ServiceProfile | undefined> {
    const [profile] = await db.select().from(serviceProfiles).where(eq(serviceProfiles.id, id));
    return profile;
  }

  async getServiceProfiles(tenantId?: string): Promise<ServiceProfile[]> {
    if (tenantId) {
      return db
        .select()
        .from(serviceProfiles)
        .where(eq(serviceProfiles.tenantId, tenantId))
        .orderBy(desc(serviceProfiles.createdAt));
    }
    return db.select().from(serviceProfiles).orderBy(desc(serviceProfiles.createdAt));
  }

  async createServiceProfile(profile: InsertServiceProfile): Promise<ServiceProfile> {
    const [created] = await db.insert(serviceProfiles).values(profile).returning();
    return created;
  }

  async updateServiceProfile(id: string, profile: Partial<InsertServiceProfile>): Promise<ServiceProfile | undefined> {
    const [updated] = await db
      .update(serviceProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(serviceProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteServiceProfile(id: string): Promise<boolean> {
    await db.delete(serviceProfiles).where(eq(serviceProfiles.id, id));
    return true;
  }

  // Alert operations
  async getAlert(id: string): Promise<Alert | undefined> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    return alert;
  }

  async getAlerts(tenantId?: string, status?: string): Promise<Alert[]> {
    let query = db.select().from(alerts);
    if (tenantId && status) {
      return db
        .select()
        .from(alerts)
        .where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, status as any)))
        .orderBy(desc(alerts.createdAt));
    }
    if (tenantId) {
      return db.select().from(alerts).where(eq(alerts.tenantId, tenantId)).orderBy(desc(alerts.createdAt));
    }
    if (status) {
      return db.select().from(alerts).where(eq(alerts.status, status as any)).orderBy(desc(alerts.createdAt));
    }
    return db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async acknowledgeAlert(id: string, userId: string): Promise<Alert | undefined> {
    const [updated] = await db
      .update(alerts)
      .set({
        status: "acknowledged",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  async resolveAlert(id: string): Promise<Alert | undefined> {
    const [updated] = await db
      .update(alerts)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  // Event Log operations
  async getEventLogs(tenantId?: string, limit: number = 100): Promise<EventLog[]> {
    if (tenantId) {
      return db
        .select()
        .from(eventLogs)
        .where(eq(eventLogs.tenantId, tenantId))
        .orderBy(desc(eventLogs.createdAt))
        .limit(limit);
    }
    return db.select().from(eventLogs).orderBy(desc(eventLogs.createdAt)).limit(limit);
  }

  async createEventLog(log: InsertEventLog): Promise<EventLog> {
    const [created] = await db.insert(eventLogs).values(log).returning();
    return created;
  }

  // TR-069 Device operations
  async getTr069Device(id: string): Promise<Tr069Device | undefined> {
    const [device] = await db.select().from(tr069Devices).where(eq(tr069Devices.id, id));
    return device;
  }

  async getTr069DeviceByDeviceId(deviceId: string): Promise<Tr069Device | undefined> {
    const [device] = await db.select().from(tr069Devices).where(eq(tr069Devices.deviceId, deviceId));
    return device;
  }

  async getTr069DeviceByOnuId(onuId: string): Promise<Tr069Device | undefined> {
    const [device] = await db.select().from(tr069Devices).where(eq(tr069Devices.onuId, onuId));
    return device;
  }

  async getTr069Devices(tenantId?: string): Promise<Tr069Device[]> {
    if (tenantId) {
      return db.select().from(tr069Devices).where(eq(tr069Devices.tenantId, tenantId)).orderBy(desc(tr069Devices.lastInformTime));
    }
    return db.select().from(tr069Devices).orderBy(desc(tr069Devices.lastInformTime));
  }

  async createTr069Device(device: InsertTr069Device): Promise<Tr069Device> {
    const [created] = await db.insert(tr069Devices).values(device).returning();
    return created;
  }

  async updateTr069Device(id: string, device: Partial<Tr069Device>): Promise<Tr069Device | undefined> {
    const [updated] = await db
      .update(tr069Devices)
      .set({ ...device, updatedAt: new Date() })
      .where(eq(tr069Devices.id, id))
      .returning();
    return updated;
  }

  async deleteTr069Device(id: string): Promise<boolean> {
    const result = await db.delete(tr069Devices).where(eq(tr069Devices.id, id));
    return true;
  }

  async linkTr069DeviceToOnu(tr069DeviceId: string, onuId: string): Promise<Tr069Device | undefined> {
    const [updated] = await db
      .update(tr069Devices)
      .set({ onuId, updatedAt: new Date() })
      .where(eq(tr069Devices.id, tr069DeviceId))
      .returning();
    return updated;
  }

  // TR-069 Task operations
  async getTr069Task(id: string): Promise<Tr069Task | undefined> {
    const [task] = await db.select().from(tr069Tasks).where(eq(tr069Tasks.id, id));
    return task;
  }

  async getTr069Tasks(deviceId?: string): Promise<Tr069Task[]> {
    if (deviceId) {
      return db.select().from(tr069Tasks).where(eq(tr069Tasks.deviceId, deviceId)).orderBy(desc(tr069Tasks.createdAt));
    }
    return db.select().from(tr069Tasks).orderBy(desc(tr069Tasks.createdAt));
  }

  async getPendingTr069Tasks(deviceId: string): Promise<Tr069Task[]> {
    return db
      .select()
      .from(tr069Tasks)
      .where(and(eq(tr069Tasks.deviceId, deviceId), eq(tr069Tasks.status, "pending")))
      .orderBy(tr069Tasks.createdAt);
  }

  async createTr069Task(task: InsertTr069Task): Promise<Tr069Task> {
    const [created] = await db.insert(tr069Tasks).values(task).returning();
    return created;
  }

  async updateTr069Task(id: string, task: Partial<Tr069Task>): Promise<Tr069Task | undefined> {
    const [updated] = await db
      .update(tr069Tasks)
      .set(task)
      .where(eq(tr069Tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTr069Task(id: string): Promise<boolean> {
    await db.delete(tr069Tasks).where(eq(tr069Tasks.id, id));
    return true;
  }

  // TR-069 Preset operations
  async getTr069Preset(id: string): Promise<Tr069Preset | undefined> {
    const [preset] = await db.select().from(tr069Presets).where(eq(tr069Presets.id, id));
    return preset;
  }

  async getTr069Presets(tenantId?: string): Promise<Tr069Preset[]> {
    if (tenantId) {
      return db.select().from(tr069Presets).where(eq(tr069Presets.tenantId, tenantId)).orderBy(desc(tr069Presets.weight));
    }
    return db.select().from(tr069Presets).orderBy(desc(tr069Presets.weight));
  }

  async createTr069Preset(preset: InsertTr069Preset): Promise<Tr069Preset> {
    const [created] = await db.insert(tr069Presets).values(preset).returning();
    return created;
  }

  async updateTr069Preset(id: string, preset: Partial<InsertTr069Preset>): Promise<Tr069Preset | undefined> {
    const [updated] = await db
      .update(tr069Presets)
      .set({ ...preset, updatedAt: new Date() })
      .where(eq(tr069Presets.id, id))
      .returning();
    return updated;
  }

  async deleteTr069Preset(id: string): Promise<boolean> {
    await db.delete(tr069Presets).where(eq(tr069Presets.id, id));
    return true;
  }

  // TR-069 Firmware operations
  async getTr069Firmware(id: string): Promise<Tr069Firmware | undefined> {
    const [firmware] = await db.select().from(tr069Firmware).where(eq(tr069Firmware.id, id));
    return firmware;
  }

  async getTr069FirmwareList(tenantId?: string): Promise<Tr069Firmware[]> {
    if (tenantId) {
      return db.select().from(tr069Firmware).where(eq(tr069Firmware.tenantId, tenantId)).orderBy(desc(tr069Firmware.createdAt));
    }
    return db.select().from(tr069Firmware).orderBy(desc(tr069Firmware.createdAt));
  }

  async createTr069Firmware(firmware: InsertTr069Firmware): Promise<Tr069Firmware> {
    const [created] = await db.insert(tr069Firmware).values(firmware).returning();
    return created;
  }

  async deleteTr069Firmware(id: string): Promise<boolean> {
    await db.delete(tr069Firmware).where(eq(tr069Firmware.id, id));
    return true;
  }

  // VPN Gateway operations
  async getVpnGateway(id: string): Promise<VpnGateway | undefined> {
    const [gateway] = await db.select().from(vpnGateways).where(eq(vpnGateways.id, id));
    return gateway;
  }

  async getVpnGateways(tenantId?: string): Promise<VpnGateway[]> {
    if (tenantId) {
      return db.select().from(vpnGateways).where(eq(vpnGateways.tenantId, tenantId)).orderBy(desc(vpnGateways.createdAt));
    }
    return db.select().from(vpnGateways).orderBy(desc(vpnGateways.createdAt));
  }

  async createVpnGateway(gateway: InsertVpnGateway): Promise<VpnGateway> {
    const [created] = await db.insert(vpnGateways).values(gateway).returning();
    return created;
  }

  async updateVpnGateway(id: string, gateway: Partial<VpnGateway>): Promise<VpnGateway | undefined> {
    const [updated] = await db
      .update(vpnGateways)
      .set({ ...gateway, updatedAt: new Date() })
      .where(eq(vpnGateways.id, id))
      .returning();
    return updated;
  }

  async deleteVpnGateway(id: string): Promise<boolean> {
    await db.delete(vpnTunnels).where(eq(vpnTunnels.gatewayId, id));
    await db.delete(vpnGateways).where(eq(vpnGateways.id, id));
    return true;
  }

  // VPN Tunnel operations
  async getVpnTunnel(id: string): Promise<VpnTunnel | undefined> {
    const [tunnel] = await db.select().from(vpnTunnels).where(eq(vpnTunnels.id, id));
    return tunnel;
  }

  async getVpnTunnels(gatewayId?: string): Promise<VpnTunnel[]> {
    if (gatewayId) {
      return db.select().from(vpnTunnels).where(eq(vpnTunnels.gatewayId, gatewayId)).orderBy(desc(vpnTunnels.createdAt));
    }
    return db.select().from(vpnTunnels).orderBy(desc(vpnTunnels.createdAt));
  }

  async createVpnTunnel(tunnel: InsertVpnTunnel): Promise<VpnTunnel> {
    const [created] = await db.insert(vpnTunnels).values(tunnel).returning();
    return created;
  }

  async updateVpnTunnel(id: string, tunnel: Partial<VpnTunnel>): Promise<VpnTunnel | undefined> {
    const [updated] = await db
      .update(vpnTunnels)
      .set({ ...tunnel, updatedAt: new Date() })
      .where(eq(vpnTunnels.id, id))
      .returning();
    return updated;
  }

  async deleteVpnTunnel(id: string): Promise<boolean> {
    await db.delete(vpnTunnels).where(eq(vpnTunnels.id, id));
    return true;
  }

  // VPN Profile operations (OpenVPN)
  async getVpnProfile(id: string): Promise<VpnProfile | undefined> {
    const [profile] = await db.select().from(vpnProfiles).where(eq(vpnProfiles.id, id));
    return profile;
  }

  async getVpnProfiles(tenantId?: string): Promise<VpnProfile[]> {
    if (tenantId) {
      return db.select().from(vpnProfiles).where(eq(vpnProfiles.tenantId, tenantId)).orderBy(desc(vpnProfiles.createdAt));
    }
    return db.select().from(vpnProfiles).orderBy(desc(vpnProfiles.createdAt));
  }

  async createVpnProfile(profile: InsertVpnProfile): Promise<VpnProfile> {
    const [created] = await db.insert(vpnProfiles).values(profile).returning();
    return created;
  }

  async updateVpnProfile(id: string, profile: Partial<VpnProfile>): Promise<VpnProfile | undefined> {
    const [updated] = await db
      .update(vpnProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(vpnProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteVpnProfile(id: string): Promise<boolean> {
    await db.delete(vpnProfiles).where(eq(vpnProfiles.id, id));
    return true;
  }

  // ONU Event operations (SmartOLT-style event history)
  async getOnuEvents(onuId: string, limit: number = 50): Promise<OnuEvent[]> {
    return db.select().from(onuEvents)
      .where(eq(onuEvents.onuId, onuId))
      .orderBy(desc(onuEvents.createdAt))
      .limit(limit);
  }

  async getRecentOnuEvents(tenantId?: string, limit: number = 100): Promise<OnuEvent[]> {
    if (tenantId) {
      return db.select().from(onuEvents)
        .where(eq(onuEvents.tenantId, tenantId))
        .orderBy(desc(onuEvents.createdAt))
        .limit(limit);
    }
    return db.select().from(onuEvents)
      .orderBy(desc(onuEvents.createdAt))
      .limit(limit);
  }

  async createOnuEvent(event: InsertOnuEvent): Promise<OnuEvent> {
    const [created] = await db.insert(onuEvents).values(event).returning();
    return created;
  }

  // Dashboard stats
  async getDashboardStats(tenantId?: string): Promise<{
    totalOlts: number;
    onlineOlts: number;
    totalOnus: number;
    onlineOnus: number;
    offlineOnus: number;
    losOnus: number;
    activeAlerts: number;
    criticalAlerts: number;
    avgRxPower: number | null;
  }> {
    // Get OLT stats
    const oltList = tenantId 
      ? await db.select().from(olts).where(eq(olts.tenantId, tenantId))
      : await db.select().from(olts);
    const totalOlts = oltList.length;
    const onlineOlts = oltList.filter(o => o.status === "online").length;

    // Get ONU stats
    const onuList = tenantId
      ? await db.select().from(onus).where(eq(onus.tenantId, tenantId))
      : await db.select().from(onus);
    const totalOnus = onuList.length;
    const onlineOnus = onuList.filter(o => o.status === "online").length;
    const offlineOnus = onuList.filter(o => o.status === "offline").length;
    const losOnus = onuList.filter(o => o.status === "los").length;

    // Calculate average RX power (only from online ONUs with valid readings)
    const validRxPowers = onuList
      .filter(o => o.rxPower !== null && o.rxPower !== undefined && o.rxPower > -50 && o.rxPower < 0)
      .map(o => o.rxPower as number);
    const avgRxPower = validRxPowers.length > 0 
      ? validRxPowers.reduce((sum, p) => sum + p, 0) / validRxPowers.length
      : null;

    // Get alert stats
    const alertList = tenantId
      ? await db.select().from(alerts).where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, "active")))
      : await db.select().from(alerts).where(eq(alerts.status, "active"));
    const activeAlerts = alertList.length;
    const criticalAlerts = alertList.filter(a => a.severity === "critical").length;

    return {
      totalOlts,
      onlineOlts,
      totalOnus,
      onlineOnus,
      offlineOnus,
      losOnus,
      activeAlerts,
      criticalAlerts,
      avgRxPower,
    };
  }

  // Mikrotik Device operations
  async getMikrotikDevice(id: string): Promise<MikrotikDevice | undefined> {
    const [device] = await db.select().from(mikrotikDevices).where(eq(mikrotikDevices.id, id));
    return device;
  }

  async getMikrotikDevices(tenantId?: string): Promise<MikrotikDevice[]> {
    if (tenantId) {
      return db.select().from(mikrotikDevices).where(eq(mikrotikDevices.tenantId, tenantId)).orderBy(desc(mikrotikDevices.createdAt));
    }
    return db.select().from(mikrotikDevices).orderBy(desc(mikrotikDevices.createdAt));
  }

  async createMikrotikDevice(device: InsertMikrotikDevice): Promise<MikrotikDevice> {
    const [created] = await db.insert(mikrotikDevices).values(device).returning();
    return created;
  }

  async updateMikrotikDevice(id: string, device: Partial<MikrotikDevice>): Promise<MikrotikDevice | undefined> {
    const [updated] = await db
      .update(mikrotikDevices)
      .set({ ...device, updatedAt: new Date() })
      .where(eq(mikrotikDevices.id, id))
      .returning();
    return updated;
  }

  async deleteMikrotikDevice(id: string): Promise<boolean> {
    await db.delete(mikrotikDevices).where(eq(mikrotikDevices.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();

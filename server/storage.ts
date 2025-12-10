import {
  users,
  tenants,
  olts,
  onus,
  serviceProfiles,
  alerts,
  eventLogs,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
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
  updateOlt(id: string, olt: Partial<InsertOlt>): Promise<Olt | undefined>;
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

  async updateOlt(id: string, olt: Partial<InsertOlt>): Promise<Olt | undefined> {
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
}

export const storage = new DatabaseStorage();

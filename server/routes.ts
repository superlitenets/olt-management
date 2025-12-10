import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupLocalAuth } from "./localAuth";
import {
  insertOltSchema,
  insertOnuSchema,
  insertServiceProfileSchema,
  insertAlertSchema,
  insertTenantSchema,
  insertTr069DeviceSchema,
  insertTr069TaskSchema,
  insertTr069PresetSchema,
  insertTr069FirmwareSchema,
  insertVpnGatewaySchema,
  insertVpnTunnelSchema,
} from "@shared/schema";
import { z } from "zod";

// Helper to resolve tenant ID from authenticated user or create default tenant
async function resolveTenantId(req: any): Promise<string> {
  // Check if user has a tenant assigned
  if (req.user?.claims?.sub) {
    const user = await storage.getUser(req.user.claims.sub);
    if (user?.tenantId) {
      return user.tenantId;
    }
  }
  
  // Get or create default system tenant
  const tenants = await storage.getTenants();
  if (tenants.length > 0) {
    return tenants[0].id;
  }
  
  // Create default tenant if none exist
  const defaultTenant = await storage.createTenant({
    name: "Default Organization",
    description: "System default tenant",
    isActive: true,
  });
  
  return defaultTenant.id;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication (both Replit Auth and Local Auth)
  await setupAuth(app);
  setupLocalAuth(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    
    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  const broadcast = (event: string, data: any) => {
    const message = JSON.stringify({ event, data });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Tenant routes
  app.get("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const data = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(data);
      broadcast("tenant:created", tenant);
      res.status(201).json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating tenant:", error);
      res.status(500).json({ message: "Failed to create tenant" });
    }
  });

  // User routes
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const users = await storage.getUsers(tenantId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // OLT routes
  app.get("/api/olts", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const olts = await storage.getOlts(tenantId);
      res.json(olts);
    } catch (error) {
      console.error("Error fetching OLTs:", error);
      res.status(500).json({ message: "Failed to fetch OLTs" });
    }
  });

  app.get("/api/olts/:id", isAuthenticated, async (req, res) => {
    try {
      const olt = await storage.getOlt(req.params.id);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }
      res.json(olt);
    } catch (error) {
      console.error("Error fetching OLT:", error);
      res.status(500).json({ message: "Failed to fetch OLT" });
    }
  });

  app.post("/api/olts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Get tenant ID from user or use a default
      let tenantId = user?.tenantId;
      if (!tenantId) {
        // Create a default tenant if user doesn't have one
        const tenants = await storage.getTenants();
        if (tenants.length === 0) {
          const defaultTenant = await storage.createTenant({
            name: "Default Tenant",
            description: "Default organization",
          });
          tenantId = defaultTenant.id;
        } else {
          tenantId = tenants[0].id;
        }
      }

      const data = insertOltSchema.parse({ ...req.body, tenantId });
      const olt = await storage.createOlt(data);
      broadcast("olt:created", olt);
      res.status(201).json(olt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating OLT:", error);
      res.status(500).json({ message: "Failed to create OLT" });
    }
  });

  app.patch("/api/olts/:id", isAuthenticated, async (req, res) => {
    try {
      const olt = await storage.updateOlt(req.params.id, req.body);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }
      broadcast("olt:updated", olt);
      res.json(olt);
    } catch (error) {
      console.error("Error updating OLT:", error);
      res.status(500).json({ message: "Failed to update OLT" });
    }
  });

  app.delete("/api/olts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOlt(req.params.id);
      broadcast("olt:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting OLT:", error);
      res.status(500).json({ message: "Failed to delete OLT" });
    }
  });

  // ONU routes
  app.get("/api/onus", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const oltId = req.query.oltId as string | undefined;
      const onus = await storage.getOnus(tenantId, oltId);
      res.json(onus);
    } catch (error) {
      console.error("Error fetching ONUs:", error);
      res.status(500).json({ message: "Failed to fetch ONUs" });
    }
  });

  app.get("/api/onus/:id", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      res.json(onu);
    } catch (error) {
      console.error("Error fetching ONU:", error);
      res.status(500).json({ message: "Failed to fetch ONU" });
    }
  });

  app.post("/api/onus", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertOnuSchema.parse(req.body);
      const onu = await storage.createOnu(data);
      broadcast("onu:created", onu);
      res.status(201).json(onu);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating ONU:", error);
      res.status(500).json({ message: "Failed to create ONU" });
    }
  });

  app.patch("/api/onus/:id", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.updateOnu(req.params.id, req.body);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      broadcast("onu:updated", onu);
      res.json(onu);
    } catch (error) {
      console.error("Error updating ONU:", error);
      res.status(500).json({ message: "Failed to update ONU" });
    }
  });

  app.post("/api/onus/:id/restart", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      // In a real implementation, this would send a restart command to the ONU
      broadcast("onu:restarted", { id: req.params.id });
      res.json({ message: "Restart command sent" });
    } catch (error) {
      console.error("Error restarting ONU:", error);
      res.status(500).json({ message: "Failed to restart ONU" });
    }
  });

  app.delete("/api/onus/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOnu(req.params.id);
      broadcast("onu:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ONU:", error);
      res.status(500).json({ message: "Failed to delete ONU" });
    }
  });

  // ONU TR-069/ACS routes
  app.get("/api/onus/:id/tr069", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      const tr069Device = await storage.getTr069DeviceByOnuId(req.params.id);
      res.json(tr069Device || null);
    } catch (error) {
      console.error("Error fetching ONU TR-069 device:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 device" });
    }
  });

  app.post("/api/onus/:id/tr069/link", isAuthenticated, async (req: any, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      const { tr069DeviceId } = req.body;
      if (!tr069DeviceId) {
        return res.status(400).json({ message: "tr069DeviceId is required" });
      }
      const tr069Device = await storage.getTr069Device(tr069DeviceId);
      if (!tr069Device) {
        return res.status(404).json({ message: "TR-069 device not found" });
      }
      // Verify tenant ownership to prevent cross-tenant linkage
      const tenantId = await resolveTenantId(req);
      if (onu.tenantId !== tenantId || tr069Device.tenantId !== tenantId) {
        return res.status(403).json({ message: "Access denied: devices belong to different tenants" });
      }
      const linked = await storage.linkTr069DeviceToOnu(tr069DeviceId, req.params.id);
      broadcast("onu:tr069Linked", { onuId: req.params.id, tr069DeviceId });
      res.json(linked);
    } catch (error) {
      console.error("Error linking TR-069 device to ONU:", error);
      res.status(500).json({ message: "Failed to link TR-069 device" });
    }
  });

  app.post("/api/onus/:id/tr069/tasks", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      const tr069Device = await storage.getTr069DeviceByOnuId(req.params.id);
      if (!tr069Device) {
        return res.status(404).json({ message: "No TR-069 device linked to this ONU" });
      }
      const { taskType, parameters } = req.body;
      if (!taskType) {
        return res.status(400).json({ message: "taskType is required" });
      }
      const task = await storage.createTr069Task({
        deviceId: tr069Device.id,
        taskType,
        parameters: parameters || {},
        status: "pending",
      });
      broadcast("tr069Task:created", task);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating TR-069 task for ONU:", error);
      res.status(500).json({ message: "Failed to create TR-069 task" });
    }
  });

  app.get("/api/onus/:id/tr069/tasks", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      const tr069Device = await storage.getTr069DeviceByOnuId(req.params.id);
      if (!tr069Device) {
        return res.json([]);
      }
      const tasks = await storage.getTr069Tasks(tr069Device.id);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching TR-069 tasks for ONU:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 tasks" });
    }
  });

  // Provision ONU with TR-069/ACS config from parent OLT (uses OLT driver)
  app.post("/api/onus/:id/provision-tr069", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      
      if (!onu.oltId) {
        return res.status(400).json({ message: "ONU is not associated with an OLT" });
      }
      
      const olt = await storage.getOlt(onu.oltId);
      if (!olt) {
        return res.status(404).json({ message: "Parent OLT not found" });
      }
      
      if (!olt.acsEnabled) {
        return res.status(400).json({ message: "TR-069/ACS is not enabled on this OLT" });
      }
      
      if (!olt.acsUrl) {
        return res.status(400).json({ message: "ACS URL is not configured on the OLT" });
      }
      
      // Use OLT driver to generate and execute TR-069 provisioning commands
      const { createOltDriver } = await import("./drivers/olt-driver");
      const driver = createOltDriver(olt, true); // simulation mode
      
      const result = await driver.provisionTr069({
        onu,
        olt,
        acsUrl: olt.acsUrl,
        acsUsername: olt.acsUsername || undefined,
        acsPassword: olt.acsPassword || undefined,
        periodicInformInterval: olt.acsPeriodicInformInterval || 3600,
      });
      
      // Log the provisioning event
      broadcast("onu:tr069Provisioned", { 
        onuId: onu.id, 
        oltId: olt.id,
        acsUrl: olt.acsUrl,
        commands: result.commands,
        timestamp: new Date().toISOString()
      });
      
      // Update ONU status
      await storage.updateOnu(onu.id, {
        status: "online",
      });
      
      res.json({ 
        message: result.message,
        success: result.success,
        commands: result.commands,
        vendor: olt.vendor,
      });
    } catch (error) {
      console.error("Error provisioning ONU with TR-069:", error);
      res.status(500).json({ message: "Failed to provision ONU with TR-069 configuration" });
    }
  });

  // Provision ONU with full service profile (VLAN, bandwidth, etc.)
  app.post("/api/onus/:id/provision", isAuthenticated, async (req, res) => {
    try {
      const { vlan, gemPort, tcont } = req.body;
      
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      
      if (!onu.oltId) {
        return res.status(400).json({ message: "ONU is not associated with an OLT" });
      }
      
      const olt = await storage.getOlt(onu.oltId);
      if (!olt) {
        return res.status(404).json({ message: "Parent OLT not found" });
      }
      
      // Get service profile if assigned
      let serviceProfile = undefined;
      if (onu.serviceProfileId) {
        serviceProfile = await storage.getServiceProfile(onu.serviceProfileId);
      }
      
      // Use OLT driver to generate and execute provisioning commands
      const { createOltDriver } = await import("./drivers/olt-driver");
      const driver = createOltDriver(olt, true); // simulation mode
      
      const result = await driver.provisionOnu({
        onu,
        olt,
        serviceProfile,
        vlan: vlan || serviceProfile?.internetVlan || 100,
        gemPort: gemPort || 1,
        tcont: tcont || 1,
      });
      
      // Log the provisioning event
      broadcast("onu:provisioned", { 
        onuId: onu.id, 
        oltId: olt.id,
        serviceProfileId: onu.serviceProfileId,
        commands: result.commands,
        timestamp: new Date().toISOString()
      });
      
      // Update ONU status
      await storage.updateOnu(onu.id, {
        status: "online",
      });
      
      res.json({ 
        message: result.message,
        success: result.success,
        commands: result.commands,
        vendor: olt.vendor,
      });
    } catch (error) {
      console.error("Error provisioning ONU:", error);
      res.status(500).json({ message: "Failed to provision ONU" });
    }
  });

  // Deprovision (remove) ONU from OLT
  app.post("/api/onus/:id/deprovision", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      
      if (!onu.oltId) {
        return res.status(400).json({ message: "ONU is not associated with an OLT" });
      }
      
      const olt = await storage.getOlt(onu.oltId);
      if (!olt) {
        return res.status(404).json({ message: "Parent OLT not found" });
      }
      
      // Use OLT driver to generate and execute deprovisioning commands
      const { createOltDriver } = await import("./drivers/olt-driver");
      const driver = createOltDriver(olt, true); // simulation mode
      
      const result = await driver.deprovisionOnu(onu);
      
      // Log the deprovisioning event
      broadcast("onu:deprovisioned", { 
        onuId: onu.id, 
        oltId: olt.id,
        commands: result.commands,
        timestamp: new Date().toISOString()
      });
      
      // Update ONU status
      await storage.updateOnu(onu.id, {
        status: "offline",
      });
      
      res.json({ 
        message: result.message,
        success: result.success,
        commands: result.commands,
        vendor: olt.vendor,
      });
    } catch (error) {
      console.error("Error deprovisioning ONU:", error);
      res.status(500).json({ message: "Failed to deprovision ONU" });
    }
  });

  // Reboot ONU via OLT
  app.post("/api/onus/:id/reboot", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      
      if (!onu.oltId) {
        return res.status(400).json({ message: "ONU is not associated with an OLT" });
      }
      
      const olt = await storage.getOlt(onu.oltId);
      if (!olt) {
        return res.status(404).json({ message: "Parent OLT not found" });
      }
      
      // Use OLT driver to generate and execute reboot commands
      const { createOltDriver } = await import("./drivers/olt-driver");
      const driver = createOltDriver(olt, true); // simulation mode
      
      const result = await driver.rebootOnu(onu);
      
      // Log the reboot event
      broadcast("onu:rebooted", { 
        onuId: onu.id, 
        oltId: olt.id,
        commands: result.commands,
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        message: result.message,
        success: result.success,
        commands: result.commands,
        vendor: olt.vendor,
      });
    } catch (error) {
      console.error("Error rebooting ONU:", error);
      res.status(500).json({ message: "Failed to reboot ONU" });
    }
  });

  // Get OLT CLI commands preview (for viewing what would be sent)
  app.post("/api/onus/:id/preview-commands", isAuthenticated, async (req, res) => {
    try {
      const { action, vlan, gemPort, tcont } = req.body;
      
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }
      
      if (!onu.oltId) {
        return res.status(400).json({ message: "ONU is not associated with an OLT" });
      }
      
      const olt = await storage.getOlt(onu.oltId);
      if (!olt) {
        return res.status(404).json({ message: "Parent OLT not found" });
      }
      
      let serviceProfile = undefined;
      if (onu.serviceProfileId) {
        serviceProfile = await storage.getServiceProfile(onu.serviceProfileId);
      }
      
      const { createOltDriver } = await import("./drivers/olt-driver");
      const driver = createOltDriver(olt, true);
      
      let commands: string[] = [];
      
      switch (action) {
        case "provision":
          commands = [
            ...driver.buildAddOnuCommands({ onu, olt, serviceProfile, vlan, gemPort, tcont }),
            ...driver.buildServiceProfileCommands({ onu, olt, serviceProfile, vlan, gemPort, tcont }),
            ...driver.buildVlanCommands({ onu, olt, serviceProfile, vlan, gemPort, tcont }),
          ];
          break;
        case "deprovision":
          commands = driver.buildRemoveOnuCommands(onu);
          break;
        case "tr069":
          if (olt.acsEnabled && olt.acsUrl) {
            commands = driver.buildTr069Commands({
              onu,
              olt,
              acsUrl: olt.acsUrl,
              acsUsername: olt.acsUsername || undefined,
              acsPassword: olt.acsPassword || undefined,
              periodicInformInterval: olt.acsPeriodicInformInterval || 3600,
            });
          }
          break;
        case "reboot":
          commands = driver.buildRebootOnuCommands(onu);
          break;
        default:
          return res.status(400).json({ message: "Invalid action. Use: provision, deprovision, tr069, reboot" });
      }
      
      res.json({
        vendor: olt.vendor,
        oltName: olt.name,
        oltIp: olt.ipAddress,
        action,
        commands,
      });
    } catch (error) {
      console.error("Error previewing commands:", error);
      res.status(500).json({ message: "Failed to preview commands" });
    }
  });

  // Service Profile routes
  app.get("/api/service-profiles", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const profiles = await storage.getServiceProfiles(tenantId);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching service profiles:", error);
      res.status(500).json({ message: "Failed to fetch service profiles" });
    }
  });

  app.get("/api/service-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getServiceProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Service profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching service profile:", error);
      res.status(500).json({ message: "Failed to fetch service profile" });
    }
  });

  app.post("/api/service-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      let tenantId = user?.tenantId;
      if (!tenantId) {
        const tenants = await storage.getTenants();
        if (tenants.length > 0) {
          tenantId = tenants[0].id;
        } else {
          const defaultTenant = await storage.createTenant({
            name: "Default Tenant",
            description: "Default organization",
          });
          tenantId = defaultTenant.id;
        }
      }

      const data = insertServiceProfileSchema.parse({ ...req.body, tenantId });
      const profile = await storage.createServiceProfile(data);
      broadcast("serviceProfile:created", profile);
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating service profile:", error);
      res.status(500).json({ message: "Failed to create service profile" });
    }
  });

  app.patch("/api/service-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.updateServiceProfile(req.params.id, req.body);
      if (!profile) {
        return res.status(404).json({ message: "Service profile not found" });
      }
      broadcast("serviceProfile:updated", profile);
      res.json(profile);
    } catch (error) {
      console.error("Error updating service profile:", error);
      res.status(500).json({ message: "Failed to update service profile" });
    }
  });

  app.delete("/api/service-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteServiceProfile(req.params.id);
      broadcast("serviceProfile:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service profile:", error);
      res.status(500).json({ message: "Failed to delete service profile" });
    }
  });

  // Alert routes
  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const status = req.query.status as string | undefined;
      const alerts = await storage.getAlerts(tenantId, status);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const alert = await storage.getAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error fetching alert:", error);
      res.status(500).json({ message: "Failed to fetch alert" });
    }
  });

  app.post("/api/alerts/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alert = await storage.acknowledgeAlert(req.params.id, userId);
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      broadcast("alert:acknowledged", alert);
      res.json(alert);
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      res.status(500).json({ message: "Failed to acknowledge alert" });
    }
  });

  app.post("/api/alerts/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const alert = await storage.resolveAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      broadcast("alert:resolved", alert);
      res.json(alert);
    } catch (error) {
      console.error("Error resolving alert:", error);
      res.status(500).json({ message: "Failed to resolve alert" });
    }
  });

  // Event Log routes
  app.get("/api/event-logs", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getEventLogs(tenantId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching event logs:", error);
      res.status(500).json({ message: "Failed to fetch event logs" });
    }
  });

  // TR-069 Device routes
  app.get("/api/tr069/devices", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const devices = await storage.getTr069Devices(tenantId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching TR-069 devices:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 devices" });
    }
  });

  app.get("/api/tr069/devices/:id", isAuthenticated, async (req, res) => {
    try {
      const device = await storage.getTr069Device(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      console.error("Error fetching TR-069 device:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 device" });
    }
  });

  app.delete("/api/tr069/devices/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTr069Device(req.params.id);
      broadcast("tr069Device:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting TR-069 device:", error);
      res.status(500).json({ message: "Failed to delete TR-069 device" });
    }
  });

  // TR-069 Task routes
  app.get("/api/tr069/tasks", isAuthenticated, async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string | undefined;
      const tasks = await storage.getTr069Tasks(deviceId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching TR-069 tasks:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 tasks" });
    }
  });

  app.post("/api/tr069/tasks", isAuthenticated, async (req, res) => {
    try {
      const data = insertTr069TaskSchema.parse(req.body);
      const task = await storage.createTr069Task(data);
      broadcast("tr069Task:created", task);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating TR-069 task:", error);
      res.status(500).json({ message: "Failed to create TR-069 task" });
    }
  });

  app.delete("/api/tr069/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTr069Task(req.params.id);
      broadcast("tr069Task:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting TR-069 task:", error);
      res.status(500).json({ message: "Failed to delete TR-069 task" });
    }
  });

  // TR-069 Preset routes
  app.get("/api/tr069/presets", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const presets = await storage.getTr069Presets(tenantId);
      res.json(presets);
    } catch (error) {
      console.error("Error fetching TR-069 presets:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 presets" });
    }
  });

  app.post("/api/tr069/presets", isAuthenticated, async (req, res) => {
    try {
      const data = insertTr069PresetSchema.parse(req.body);
      const preset = await storage.createTr069Preset(data);
      broadcast("tr069Preset:created", preset);
      res.status(201).json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating TR-069 preset:", error);
      res.status(500).json({ message: "Failed to create TR-069 preset" });
    }
  });

  app.put("/api/tr069/presets/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertTr069PresetSchema.partial().parse(req.body);
      const preset = await storage.updateTr069Preset(req.params.id, data);
      if (!preset) {
        return res.status(404).json({ message: "Preset not found" });
      }
      broadcast("tr069Preset:updated", preset);
      res.json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating TR-069 preset:", error);
      res.status(500).json({ message: "Failed to update TR-069 preset" });
    }
  });

  app.delete("/api/tr069/presets/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTr069Preset(req.params.id);
      broadcast("tr069Preset:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting TR-069 preset:", error);
      res.status(500).json({ message: "Failed to delete TR-069 preset" });
    }
  });

  // TR-069 Firmware routes
  app.get("/api/tr069/firmware", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const firmware = await storage.getTr069FirmwareList(tenantId);
      res.json(firmware);
    } catch (error) {
      console.error("Error fetching TR-069 firmware:", error);
      res.status(500).json({ message: "Failed to fetch TR-069 firmware" });
    }
  });

  app.post("/api/tr069/firmware", isAuthenticated, async (req, res) => {
    try {
      const data = insertTr069FirmwareSchema.parse(req.body);
      const firmware = await storage.createTr069Firmware(data);
      broadcast("tr069Firmware:created", firmware);
      res.status(201).json(firmware);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating TR-069 firmware:", error);
      res.status(500).json({ message: "Failed to create TR-069 firmware" });
    }
  });

  app.delete("/api/tr069/firmware/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTr069Firmware(req.params.id);
      broadcast("tr069Firmware:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting TR-069 firmware:", error);
      res.status(500).json({ message: "Failed to delete TR-069 firmware" });
    }
  });

  // VPN Gateway routes
  app.get("/api/vpn/gateways", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const gateways = await storage.getVpnGateways(tenantId);
      res.json(gateways);
    } catch (error) {
      console.error("Error fetching VPN gateways:", error);
      res.status(500).json({ message: "Failed to fetch VPN gateways" });
    }
  });

  app.get("/api/vpn/gateways/:id", isAuthenticated, async (req, res) => {
    try {
      const gateway = await storage.getVpnGateway(req.params.id);
      if (!gateway) {
        return res.status(404).json({ message: "VPN gateway not found" });
      }
      res.json(gateway);
    } catch (error) {
      console.error("Error fetching VPN gateway:", error);
      res.status(500).json({ message: "Failed to fetch VPN gateway" });
    }
  });

  app.post("/api/vpn/gateways", isAuthenticated, async (req: any, res) => {
    try {
      // Resolve tenant from authenticated user context, not client payload
      const tenantId = await resolveTenantId(req);
      const { tenantId: _, ...bodyWithoutTenant } = req.body;
      const data = insertVpnGatewaySchema.parse({ ...bodyWithoutTenant, tenantId });
      const gateway = await storage.createVpnGateway(data);
      broadcast("vpnGateway:created", gateway);
      res.status(201).json(gateway);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating VPN gateway:", error);
      res.status(500).json({ message: "Failed to create VPN gateway" });
    }
  });

  app.put("/api/vpn/gateways/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertVpnGatewaySchema.partial().parse(req.body);
      const gateway = await storage.updateVpnGateway(req.params.id, data);
      if (!gateway) {
        return res.status(404).json({ message: "VPN gateway not found" });
      }
      broadcast("vpnGateway:updated", gateway);
      res.json(gateway);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating VPN gateway:", error);
      res.status(500).json({ message: "Failed to update VPN gateway" });
    }
  });

  app.delete("/api/vpn/gateways/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteVpnGateway(req.params.id);
      broadcast("vpnGateway:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting VPN gateway:", error);
      res.status(500).json({ message: "Failed to delete VPN gateway" });
    }
  });

  // VPN Tunnel routes
  app.get("/api/vpn/tunnels", isAuthenticated, async (req, res) => {
    try {
      const gatewayId = req.query.gatewayId as string | undefined;
      const tunnels = await storage.getVpnTunnels(gatewayId);
      res.json(tunnels);
    } catch (error) {
      console.error("Error fetching VPN tunnels:", error);
      res.status(500).json({ message: "Failed to fetch VPN tunnels" });
    }
  });

  app.get("/api/vpn/tunnels/:id", isAuthenticated, async (req, res) => {
    try {
      const tunnel = await storage.getVpnTunnel(req.params.id);
      if (!tunnel) {
        return res.status(404).json({ message: "VPN tunnel not found" });
      }
      res.json(tunnel);
    } catch (error) {
      console.error("Error fetching VPN tunnel:", error);
      res.status(500).json({ message: "Failed to fetch VPN tunnel" });
    }
  });

  app.post("/api/vpn/tunnels", isAuthenticated, async (req, res) => {
    try {
      const data = insertVpnTunnelSchema.parse(req.body);
      const tunnel = await storage.createVpnTunnel(data);
      broadcast("vpnTunnel:created", tunnel);
      res.status(201).json(tunnel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating VPN tunnel:", error);
      res.status(500).json({ message: "Failed to create VPN tunnel" });
    }
  });

  app.put("/api/vpn/tunnels/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertVpnTunnelSchema.partial().parse(req.body);
      const tunnel = await storage.updateVpnTunnel(req.params.id, data);
      if (!tunnel) {
        return res.status(404).json({ message: "VPN tunnel not found" });
      }
      broadcast("vpnTunnel:updated", tunnel);
      res.json(tunnel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating VPN tunnel:", error);
      res.status(500).json({ message: "Failed to update VPN tunnel" });
    }
  });

  app.delete("/api/vpn/tunnels/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteVpnTunnel(req.params.id);
      broadcast("vpnTunnel:deleted", { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting VPN tunnel:", error);
      res.status(500).json({ message: "Failed to delete VPN tunnel" });
    }
  });

  // Generate WireGuard config for a tunnel
  app.get("/api/vpn/tunnels/:id/config", isAuthenticated, async (req, res) => {
    try {
      const tunnel = await storage.getVpnTunnel(req.params.id);
      if (!tunnel) {
        return res.status(404).json({ message: "VPN tunnel not found" });
      }
      const gateway = await storage.getVpnGateway(tunnel.gatewayId);
      if (!gateway) {
        return res.status(404).json({ message: "VPN gateway not found" });
      }

      const config = `[Interface]
PrivateKey = ${gateway.privateKey || "<YOUR_PRIVATE_KEY>"}
Address = ${tunnel.localAddress || "10.0.0.1/24"}
${gateway.dns ? `DNS = ${gateway.dns}` : ""}
${gateway.mtu ? `MTU = ${gateway.mtu}` : ""}

[Peer]
PublicKey = ${tunnel.peerPublicKey || "<PEER_PUBLIC_KEY>"}
${tunnel.preSharedKey ? `PresharedKey = ${tunnel.preSharedKey}` : ""}
AllowedIPs = ${tunnel.allowedIps || "0.0.0.0/0"}
${tunnel.peerEndpoint ? `Endpoint = ${tunnel.peerEndpoint}:${tunnel.peerPort || 51820}` : ""}
${gateway.persistentKeepalive ? `PersistentKeepalive = ${gateway.persistentKeepalive}` : ""}`;

      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="${tunnel.name}.conf"`);
      res.send(config);
    } catch (error) {
      console.error("Error generating VPN config:", error);
      res.status(500).json({ message: "Failed to generate VPN config" });
    }
  });

  return httpServer;
}

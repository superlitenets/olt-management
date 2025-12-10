import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertOltSchema,
  insertOnuSchema,
  insertServiceProfileSchema,
  insertAlertSchema,
  insertTenantSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

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

  return httpServer;
}

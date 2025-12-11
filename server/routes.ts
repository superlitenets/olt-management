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

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const stats = await storage.getDashboardStats(tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Recent ONU events for dashboard
  app.get("/api/onu-events/recent", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getRecentOnuEvents(tenantId, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching recent ONU events:", error);
      res.status(500).json({ message: "Failed to fetch ONU events" });
    }
  });

  // ONU events for specific ONU
  app.get("/api/onus/:id/events", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getOnuEvents(req.params.id, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching ONU events:", error);
      res.status(500).json({ message: "Failed to fetch ONU events" });
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

  // Get detailed OLT information (boards, uplinks, VLANs, PON ports)
  app.get("/api/olts/:id/details", isAuthenticated, async (req, res) => {
    let snmpClient: any = null;
    
    try {
      const olt = await storage.getOlt(req.params.id);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }

      const { createSnmpClient } = await import("./drivers/snmp-client");
      const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
      
      if (normalizedVendor !== "huawei" && normalizedVendor !== "zte") {
        return res.status(400).json({ 
          message: `Unsupported vendor: ${olt.vendor}` 
        });
      }

      try {
        snmpClient = createSnmpClient(
          olt.ipAddress,
          olt.snmpCommunity || "public",
          normalizedVendor,
          olt.snmpPort || 161
        );
      } catch (connError) {
        console.error("Failed to create SNMP client:", connError);
        return res.status(502).json({
          message: "Failed to connect to OLT via SNMP",
          error: connError instanceof Error ? connError.message : "Connection failed"
        });
      }

      try {
        const details = await snmpClient.getDetailedInfo();
        res.json({
          olt,
          ...details,
        });
      } catch (snmpError) {
        console.error("SNMP query failed:", snmpError);
        return res.status(502).json({
          message: "SNMP query failed",
          error: snmpError instanceof Error ? snmpError.message : "Query failed"
        });
      }
    } catch (error) {
      console.error("Error fetching OLT details:", error);
      res.status(500).json({ 
        message: "Failed to fetch OLT details",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      if (snmpClient) {
        try {
          snmpClient.close();
        } catch (e) {
          // Ignore close errors
        }
      }
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

  // Test OLT connection endpoint
  app.post("/api/olts/:id/test-connection", isAuthenticated, async (req, res) => {
    try {
      const olt = await storage.getOlt(req.params.id);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }

      console.log(`[test-connection] Testing OLT: ${olt.name} (${olt.ipAddress}), vendor: ${olt.vendor}`);

      const results: { snmp: boolean; telnet: boolean; errors: string[] } = {
        snmp: false,
        telnet: false,
        errors: [],
      };

      // Test SNMP connection
      try {
        const { createSnmpClient } = await import("./drivers/snmp-client");
        const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
        console.log(`[test-connection] SNMP test - IP: ${olt.ipAddress}, community: ${olt.snmpCommunity || "public"}, port: ${olt.snmpPort || 161}`);
        
        if (normalizedVendor === "huawei" || normalizedVendor === "zte") {
          const snmpClient = createSnmpClient(
            olt.ipAddress,
            olt.snmpCommunity || "public",
            normalizedVendor,
            olt.snmpPort || 161
          );
          try {
            results.snmp = await snmpClient.testConnection();
            console.log(`[test-connection] SNMP result: ${results.snmp}`);
          } finally {
            snmpClient.close();
          }
        } else {
          console.log(`[test-connection] Unsupported vendor for SNMP: ${normalizedVendor}`);
          results.errors.push(`SNMP: Unsupported vendor "${olt.vendor}" - only huawei and zte are supported`);
        }
      } catch (error) {
        console.error(`[test-connection] SNMP error:`, error);
        results.errors.push(`SNMP: ${error instanceof Error ? error.message : "Connection failed"}`);
      }

      // Test Telnet connection (if credentials provided)
      if (olt.sshUsername && olt.sshPassword) {
        try {
          const { createOltDriver } = await import("./drivers/olt-driver");
          const driver = createOltDriver(olt);
          
          // Check if simulation mode is disabled for real connection test
          const simulationMode = process.env.OLT_SIMULATION_MODE !== "false";
          console.log(`[test-connection] Telnet test - simulation mode: ${simulationMode}, port: ${olt.sshPort || 23}`);
          
          if (simulationMode) {
            results.telnet = true; // In simulation mode, assume success
            console.log(`[test-connection] Telnet: Simulation mode enabled, returning success`);
          } else {
            // Try a simple command to test connection
            console.log(`[test-connection] Telnet: Attempting real connection to ${olt.ipAddress}:${olt.sshPort || 23}`);
            const testResult = await driver.executeCommands(["display version"]);
            results.telnet = testResult.success;
            console.log(`[test-connection] Telnet result: ${testResult.success}, output: ${testResult.output?.substring(0, 200)}`);
            if (!testResult.success && testResult.error) {
              results.errors.push(`Telnet: ${testResult.error}`);
            }
          }
        } catch (error) {
          console.error(`[test-connection] Telnet error:`, error);
          results.errors.push(`Telnet: ${error instanceof Error ? error.message : "Connection failed"}`);
        }
      } else {
        console.log(`[test-connection] Telnet: No credentials configured`);
        results.errors.push("Telnet: No credentials configured");
      }

      // Update OLT status based on results
      const newStatus = results.snmp || results.telnet ? "online" : "offline";
      const updatedOlt = await storage.updateOlt(olt.id, { 
        status: newStatus,
        lastPolled: new Date(),
      });

      res.json({
        message: results.snmp || results.telnet ? "Connection successful" : "Connection failed",
        results,
        olt: updatedOlt,
      });
    } catch (error) {
      console.error("Test connection error:", error);
      res.status(500).json({ 
        message: "Test connection failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // SNMP polling endpoint
  app.post("/api/olts/:id/poll", isAuthenticated, async (req, res) => {
    try {
      const olt = await storage.getOlt(req.params.id);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }

      const { createSnmpClient } = await import("./drivers/snmp-client");
      // Normalize vendor to lowercase for SNMP client
      const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
      if (normalizedVendor !== "huawei" && normalizedVendor !== "zte") {
        return res.status(400).json({ 
          message: `Unsupported vendor: ${olt.vendor}. SNMP polling supports Huawei and ZTE only.` 
        });
      }
      const snmpClient = createSnmpClient(
        olt.ipAddress,
        olt.snmpCommunity || "public",
        normalizedVendor,
        olt.snmpPort || 161
      );

      try {
        // Test connection first
        const isReachable = await snmpClient.testConnection();
        if (!isReachable) {
          return res.status(503).json({ 
            message: "OLT not reachable via SNMP",
            suggestion: "Check SNMP community string and network connectivity"
          });
        }

        // Get system info and ONU count in parallel
        const [systemInfo, onuCount] = await Promise.all([
          snmpClient.getSystemInfo(),
          snmpClient.getOnuCount(),
        ]);

        // Update OLT with polled data
        const updateData: any = {
          status: "online",
          lastPolled: new Date(),
          activeOnus: onuCount,
        };

        if (systemInfo.cpuUsage !== undefined) updateData.cpuUsage = systemInfo.cpuUsage;
        if (systemInfo.memoryUsage !== undefined) updateData.memoryUsage = systemInfo.memoryUsage;
        if (systemInfo.temperature !== undefined) updateData.temperature = systemInfo.temperature;
        if (systemInfo.sysUptime !== undefined) updateData.uptime = systemInfo.sysUptime;
        if (systemInfo.firmwareVersion) updateData.firmwareVersion = systemInfo.firmwareVersion;

        const updatedOlt = await storage.updateOlt(olt.id, updateData);
        broadcast("olt:updated", updatedOlt);

        res.json({
          message: "SNMP poll successful",
          data: {
            ...systemInfo,
            activeOnus: onuCount,
          },
          olt: updatedOlt,
        });
      } finally {
        snmpClient.close();
      }
    } catch (error) {
      console.error("SNMP poll error:", error);
      
      // Update OLT status to offline on error
      try {
        const olt = await storage.getOlt(req.params.id);
        if (olt) {
          const updatedOlt = await storage.updateOlt(req.params.id, { 
            status: "offline",
            lastPolled: new Date(),
          });
          broadcast("olt:updated", updatedOlt);
        }
      } catch (updateError) {
        console.error("Failed to update OLT status:", updateError);
      }
      
      res.status(500).json({ 
        message: "SNMP poll failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Discover ONUs on an OLT via SNMP
  app.post("/api/olts/:id/discover-onus", isAuthenticated, async (req: any, res) => {
    try {
      const olt = await storage.getOlt(req.params.id);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }

      console.log(`[discover-onus] Starting discovery on OLT: ${olt.name} (${olt.ipAddress})`);

      const { createSnmpClient } = await import("./drivers/snmp-client");
      const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
      if (normalizedVendor !== "huawei" && normalizedVendor !== "zte") {
        return res.status(400).json({ 
          message: `Unsupported vendor: ${olt.vendor}. ONU discovery supports Huawei and ZTE only.` 
        });
      }

      const snmpClient = createSnmpClient(
        olt.ipAddress,
        olt.snmpCommunity || "public",
        normalizedVendor,
        olt.snmpPort || 161
      );

      try {
        const discoveredOnus = await snmpClient.discoverOnus();
        
        // Get existing ONUs for this OLT (pass undefined for tenantId to get all, filter by oltId)
        const existingOnus = await storage.getOnus(undefined, olt.id);
        const existingSerials = new Set(existingOnus.map(o => o.serialNumber.toUpperCase()));
        
        console.log(`[discover-onus] Found ${existingOnus.length} existing ONUs for this OLT`);
        
        // Resolve tenant ID
        const tenantId = await resolveTenantId(req);
        
        // Create new ONUs that don't exist
        const created: any[] = [];
        const updated: any[] = [];
        const skipped: any[] = [];
        
        for (const discovered of discoveredOnus) {
          const serialUpper = discovered.serialNumber.toUpperCase();
          
          if (existingSerials.has(serialUpper)) {
            // Update existing ONU status, description, and position
            const existing = existingOnus.find(o => o.serialNumber.toUpperCase() === serialUpper);
            if (existing) {
              const updateData: any = {
                status: discovered.status as "online" | "offline" | "los",
                ponPort: discovered.ponPort,
                onuId: discovered.onuId,
              };
              // Update description if provided and different from name
              if (discovered.description) {
                updateData.description = discovered.description;
              }
              const updatedOnu = await storage.updateOnu(existing.id, updateData);
              updated.push(updatedOnu);
            }
          } else {
            // Create new ONU
            try {
              const newOnu = await storage.createOnu({
                tenantId,
                oltId: olt.id,
                name: discovered.description || `ONU-${discovered.serialNumber.slice(-8)}`,
                serialNumber: discovered.serialNumber,
                ponPort: discovered.ponPort,
                onuId: discovered.onuId,
                status: discovered.status as "online" | "offline" | "los",
                model: "Auto-discovered",
                description: discovered.description || undefined,
              });
              created.push(newOnu);
              broadcast("onu:created", newOnu);
            } catch (createError) {
              console.error(`Failed to create ONU ${discovered.serialNumber}:`, createError);
              skipped.push({ serial: discovered.serialNumber, error: String(createError) });
            }
          }
        }

        console.log(`[discover-onus] Complete: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped`);

        res.json({
          message: "ONU discovery complete",
          summary: {
            discovered: discoveredOnus.length,
            created: created.length,
            updated: updated.length,
            skipped: skipped.length,
          },
          created,
          updated,
          skipped,
        });
      } finally {
        snmpClient.close();
      }
    } catch (error) {
      console.error("[discover-onus] Error:", error);
      res.status(500).json({ 
        message: "ONU discovery failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Bulk poll all ONUs on an OLT for power levels
  app.post("/api/olts/:id/poll-onus", isAuthenticated, async (req, res) => {
    try {
      const olt = await storage.getOlt(req.params.id);
      if (!olt) {
        return res.status(404).json({ message: "OLT not found" });
      }

      console.log(`[poll-onus] Starting bulk poll on OLT: ${olt.name} (${olt.ipAddress})`);

      const { createSnmpClient } = await import("./drivers/snmp-client");
      const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
      if (normalizedVendor !== "huawei" && normalizedVendor !== "zte") {
        return res.status(400).json({ 
          message: `Unsupported vendor: ${olt.vendor}. SNMP polling supports Huawei and ZTE only.` 
        });
      }

      const snmpClient = createSnmpClient(
        olt.ipAddress,
        olt.snmpCommunity || "public",
        normalizedVendor,
        olt.snmpPort || 161
      );

      try {
        // Get all ONUs for this OLT
        const onus = await storage.getOnus(undefined, olt.id);
        console.log(`[poll-onus] Found ${onus.length} ONUs, starting bulk SNMP walk...`);

        const results: { updated: number; failed: number; errors: string[] } = {
          updated: 0,
          failed: 0,
          errors: [],
        };

        // Use bulk walk method for efficiency
        const opticalDataMap = await snmpClient.bulkPollOpticalPower();
        console.log(`[poll-onus] Got optical data for ${opticalDataMap.size} ONUs from SNMP`);

        // Match SNMP results to ONUs by ponPort.onuId key
        for (const onu of onus) {
          if (!onu.ponPort || !onu.onuId) {
            continue;
          }

          const key = `${onu.ponPort}.${onu.onuId}`;
          const opticalData = opticalDataMap.get(key);
          
          if (opticalData) {
            const updateData: any = {};
            if (opticalData.status !== undefined) updateData.status = opticalData.status;
            if (opticalData.rxPower !== undefined) updateData.rxPower = opticalData.rxPower;
            if (opticalData.txPower !== undefined) updateData.txPower = opticalData.txPower;
            if (opticalData.distance !== undefined) updateData.distance = opticalData.distance;

            if (Object.keys(updateData).length > 0) {
              try {
                await storage.updateOnu(onu.id, updateData);
                results.updated++;
              } catch (updateError) {
                results.failed++;
              }
            }
          } else {
            // No SNMP data means ONU is likely offline
            try {
              await storage.updateOnu(onu.id, { status: "offline" });
            } catch (e) {}
            results.failed++;
          }
        }

        console.log(`[poll-onus] Complete: ${results.updated} updated, ${results.failed} failed`);

        // Invalidate cache by broadcasting update
        broadcast("onus:refreshed", { oltId: olt.id, updated: results.updated });

        res.json({
          message: "Bulk ONU poll complete",
          summary: results,
        });
      } finally {
        snmpClient.close();
      }
    } catch (error) {
      console.error("[poll-onus] Error:", error);
      res.status(500).json({ 
        message: "Bulk ONU poll failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // SNMP poll ONU optical power
  app.post("/api/onus/:id/poll", isAuthenticated, async (req, res) => {
    try {
      const onu = await storage.getOnu(req.params.id);
      if (!onu) {
        return res.status(404).json({ message: "ONU not found" });
      }

      const olt = await storage.getOlt(onu.oltId);
      if (!olt) {
        return res.status(404).json({ message: "Parent OLT not found" });
      }

      if (!onu.ponPort || !onu.onuId) {
        return res.status(400).json({ 
          message: "ONU must have PON port and ONU ID configured for SNMP polling" 
        });
      }

      const { createSnmpClient } = await import("./drivers/snmp-client");
      // Normalize vendor to lowercase for SNMP client
      const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
      if (normalizedVendor !== "huawei" && normalizedVendor !== "zte") {
        return res.status(400).json({ 
          message: `Unsupported vendor: ${olt.vendor}. SNMP polling supports Huawei and ZTE only.` 
        });
      }
      const snmpClient = createSnmpClient(
        olt.ipAddress,
        olt.snmpCommunity || "public",
        normalizedVendor,
        olt.snmpPort || 161
      );

      try {
        const opticalData = await snmpClient.getOnuOpticalPower(onu.ponPort, onu.onuId);

        // Update ONU with polled data
        const updateData: any = {};
        if (opticalData.rxPower !== undefined) updateData.rxPower = opticalData.rxPower;
        if (opticalData.txPower !== undefined) updateData.txPower = opticalData.txPower;
        if (opticalData.distance !== undefined) updateData.distance = opticalData.distance;

        if (Object.keys(updateData).length > 0) {
          const updatedOnu = await storage.updateOnu(onu.id, updateData);
          broadcast("onu:updated", updatedOnu);
          res.json({
            message: "ONU SNMP poll successful",
            data: opticalData,
            onu: updatedOnu,
          });
        } else {
          res.json({
            message: "ONU SNMP poll completed but no data available",
            data: opticalData,
          });
        }
      } finally {
        snmpClient.close();
      }
    } catch (error) {
      console.error("ONU SNMP poll error:", error);
      res.status(500).json({ 
        message: "ONU SNMP poll failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
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

  // Batch ONU operations (SmartOLT-style)
  app.post("/api/onus/batch/poll", isAuthenticated, async (req, res) => {
    try {
      const { onuIds } = req.body;
      if (!Array.isArray(onuIds) || onuIds.length === 0) {
        return res.status(400).json({ message: "onuIds array is required" });
      }

      const results: { id: string; success: boolean; error?: string }[] = [];
      
      for (const onuId of onuIds) {
        try {
          const onu = await storage.getOnu(onuId);
          if (!onu || !onu.oltId) {
            results.push({ id: onuId, success: false, error: "ONU not found or not linked to OLT" });
            continue;
          }
          
          const olt = await storage.getOlt(onu.oltId);
          if (!olt) {
            results.push({ id: onuId, success: false, error: "Parent OLT not found" });
            continue;
          }

          // Poll optical power via SNMP
          const { createSnmpClient } = await import("./drivers/snmp-client");
          const normalizedVendor = olt.vendor.toLowerCase() as "huawei" | "zte";
          if (normalizedVendor !== "huawei" && normalizedVendor !== "zte") {
            results.push({ id: onuId, success: false, error: "Unsupported vendor" });
            continue;
          }

          const snmpClient = createSnmpClient(
            olt.ipAddress,
            olt.snmpCommunity || "public",
            normalizedVendor,
            olt.snmpPort || 161
          );

          try {
            const ponPort = onu.ponPort || 0;
            const onuIdNum = onu.onuId || 1;
            const data = await snmpClient.pollOnuOpticalPower(ponPort, onuIdNum);

            await storage.updateOnu(onuId, {
              status: data.status || onu.status,
              rxPower: data.rxPower ?? onu.rxPower,
              txPower: data.txPower ?? onu.txPower,
              distance: data.distance ?? onu.distance,
              lastSeen: new Date(),
            });

            results.push({ id: onuId, success: true });
          } finally {
            snmpClient.close();
          }
        } catch (e) {
          results.push({ id: onuId, success: false, error: e instanceof Error ? e.message : "Unknown error" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      broadcast("onus:batchPolled", { count: successCount });
      res.json({ results, successCount, totalCount: onuIds.length });
    } catch (error) {
      console.error("Batch poll error:", error);
      res.status(500).json({ message: "Failed to batch poll ONUs" });
    }
  });

  app.post("/api/onus/batch/reboot", isAuthenticated, async (req, res) => {
    try {
      const { onuIds } = req.body;
      if (!Array.isArray(onuIds) || onuIds.length === 0) {
        return res.status(400).json({ message: "onuIds array is required" });
      }

      const results: { id: string; success: boolean; error?: string }[] = [];
      const simulationMode = process.env.OLT_SIMULATION_MODE !== "false";

      for (const onuId of onuIds) {
        try {
          const onu = await storage.getOnu(onuId);
          if (!onu || !onu.oltId) {
            results.push({ id: onuId, success: false, error: "ONU not found or not linked to OLT" });
            continue;
          }

          const olt = await storage.getOlt(onu.oltId);
          if (!olt) {
            results.push({ id: onuId, success: false, error: "Parent OLT not found" });
            continue;
          }

          const { createOltDriver } = await import("./drivers/olt-driver");
          const driver = createOltDriver(olt, simulationMode);
          const result = await driver.rebootOnu(onu);

          if (result.success) {
            // Record reboot event
            await storage.createOnuEvent({
              onuId: onu.id,
              oltId: olt.id,
              tenantId: onu.tenantId,
              eventType: "rebooted",
              previousStatus: onu.status || "unknown",
              newStatus: onu.status || "unknown",
              details: `Batch reboot initiated`,
            });
          }

          results.push({ id: onuId, success: result.success, error: result.success ? undefined : result.message });
        } catch (e) {
          results.push({ id: onuId, success: false, error: e instanceof Error ? e.message : "Unknown error" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      broadcast("onus:batchRebooted", { count: successCount });
      res.json({ results, successCount, totalCount: onuIds.length });
    } catch (error) {
      console.error("Batch reboot error:", error);
      res.status(500).json({ message: "Failed to batch reboot ONUs" });
    }
  });

  app.post("/api/onus/batch/delete", isAuthenticated, async (req, res) => {
    try {
      const { onuIds } = req.body;
      if (!Array.isArray(onuIds) || onuIds.length === 0) {
        return res.status(400).json({ message: "onuIds array is required" });
      }

      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const onuId of onuIds) {
        try {
          await storage.deleteOnu(onuId);
          results.push({ id: onuId, success: true });
        } catch (e) {
          results.push({ id: onuId, success: false, error: e instanceof Error ? e.message : "Unknown error" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      broadcast("onus:batchDeleted", { count: successCount });
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      res.json({ results, successCount, totalCount: onuIds.length });
    } catch (error) {
      console.error("Batch delete error:", error);
      res.status(500).json({ message: "Failed to batch delete ONUs" });
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
      const simulationMode = process.env.OLT_SIMULATION_MODE !== "false";
      const driver = createOltDriver(olt, simulationMode);
      
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
      const simulationMode = process.env.OLT_SIMULATION_MODE !== "false";
      const driver = createOltDriver(olt, simulationMode);
      
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
      const simulationMode = process.env.OLT_SIMULATION_MODE !== "false";
      const driver = createOltDriver(olt, simulationMode);
      
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
      const simulationMode = process.env.OLT_SIMULATION_MODE !== "false";
      const driver = createOltDriver(olt, simulationMode);
      
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
      // Always use simulation mode for preview - we only want to see the commands
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

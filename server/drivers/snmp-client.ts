import * as snmp from "net-snmp";

export interface SnmpConfig {
  host: string;
  port?: number;
  community: string;
  version?: typeof snmp.Version1 | typeof snmp.Version2c;
  timeout?: number;
  retries?: number;
}

export interface OltSnmpData {
  sysName?: string;
  sysDescr?: string;
  sysUptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  temperature?: number;
  totalPorts?: number;
  activeOnus?: number;
  firmwareVersion?: string;
  serialNumber?: string;
}

export interface OnuSnmpData {
  status?: string;
  rxPower?: number;
  txPower?: number;
  distance?: number;
  uptime?: number;
}

export interface DiscoveredOnu {
  serialNumber: string;
  ponPort: number;
  onuId: number;
  status: string;
  description?: string;
  index: string;
}

export interface OltBoard {
  frame: number;
  slot: number;
  boardType: string;
  status: string;
  cpuUsage?: number;
  memoryUsage?: number;
  temperature?: number;
}

export interface OltUplink {
  port: string;
  name: string;
  status: string;
  speed?: string;
  inTraffic?: number;
  outTraffic?: number;
}

export interface OltVlan {
  vlanId: number;
  name: string;
  ports?: string[];
}

export interface OltDetailedInfo {
  sysName: string;
  sysDescr: string;
  sysUptime: number;
  sysLocation?: string;
  sysContact?: string;
  boards: OltBoard[];
  uplinks: OltUplink[];
  vlans: OltVlan[];
  ponPorts: { port: number; onuCount: number; status: string }[];
}

// Standard MIB-2 OIDs
const STANDARD_OIDS = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  sysUptime: "1.3.6.1.2.1.1.3.0",
  sysContact: "1.3.6.1.2.1.1.4.0",
  sysLocation: "1.3.6.1.2.1.1.6.0",
  ifNumber: "1.3.6.1.2.1.2.1.0",
};

// Huawei OLT specific OIDs (SmartAX MA5600/MA5683 series)
// Note: CPU, memory, temperature are per-board. We walk the table to get all boards.
const HUAWEI_OIDS = {
  // Board-level metrics (hwMusaBoardEntry) - walk these to get per-board values
  // Format: OID.<frameId>.<slotId>
  boardCpuUsage: "1.3.6.1.4.1.2011.6.3.3.2.1.6",      // hwBoardCpuRate
  boardMemoryUsage: "1.3.6.1.4.1.2011.6.3.3.2.1.8",   // hwBoardRamUseRate  
  boardTemperature: "1.3.6.1.4.1.2011.6.3.3.2.1.10",  // hwBoardTemperature
  boardType: "1.3.6.1.4.1.2011.6.3.3.2.1.1",          // hwBoardType
  boardStatus: "1.3.6.1.4.1.2011.6.3.3.2.1.5",        // hwBoardOperStatus
  
  // Alternative system-level OIDs (hwEntitySystemModel - may not exist on all models)
  cpuUsage: "1.3.6.1.4.1.2011.6.3.4.1.2.0",
  memoryUsage: "1.3.6.1.4.1.2011.6.3.4.1.3.0",
  temperature: "1.3.6.1.4.1.2011.6.3.4.1.4.0",
  
  // Interface/Port OIDs (IF-MIB)
  ifDescr: "1.3.6.1.2.1.2.2.1.2",                      // Interface description
  ifOperStatus: "1.3.6.1.2.1.2.2.1.8",                 // Interface operational status
  ifSpeed: "1.3.6.1.2.1.2.2.1.5",                      // Interface speed
  ifInOctets: "1.3.6.1.2.1.2.2.1.10",                  // Inbound traffic
  ifOutOctets: "1.3.6.1.2.1.2.2.1.16",                 // Outbound traffic
  ifAlias: "1.3.6.1.2.1.31.1.1.1.18",                  // Interface alias/name
  
  // VLAN OIDs
  vlanName: "1.3.6.1.4.1.2011.5.6.1.1.1.1.2",         // hwVlanName
  
  // PON port status
  ponPortStatus: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.7", // hwGponOltEthPortOperStatus
  
  // GPON ONU table base OIDs
  onuSerialNumber: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3",
  onuDescription: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9",  // hwGponDeviceOntDespt
  onuStatus: "1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15",      // hwGponDeviceOntState: 1=online, 2=offline, 3=los
  onuRxPower: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4",      // hwGponOltOpticsDnRx (OLT receive = ONU transmit)
  onuTxPower: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.6",      // hwGponOltOpticsUpTx 
  onuDistance: "1.3.6.1.4.1.2011.6.128.1.1.2.46.1.20",
  
  // PON port ONU count
  ponOnuCount: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.9",
};

// ZTE OLT specific OIDs (C300/C600 series)
const ZTE_OIDS = {
  // System info
  cpuUsage: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.8.1",
  memoryUsage: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.9.1",
  temperature: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.10.1",
  
  // Board info
  boardCpuUsage: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.8",
  boardMemoryUsage: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.9",
  boardTemperature: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.10",
  boardType: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.2",
  boardStatus: "1.3.6.1.4.1.3902.1082.500.10.2.2.1.1.3",
  
  // Interface/Port OIDs (IF-MIB)
  ifDescr: "1.3.6.1.2.1.2.2.1.2",
  ifOperStatus: "1.3.6.1.2.1.2.2.1.8",
  ifSpeed: "1.3.6.1.2.1.2.2.1.5",
  ifInOctets: "1.3.6.1.2.1.2.2.1.10",
  ifOutOctets: "1.3.6.1.2.1.2.2.1.16",
  ifAlias: "1.3.6.1.2.1.31.1.1.1.18",
  
  // VLAN OIDs
  vlanName: "1.3.6.1.4.1.3902.1082.500.6.1.1.1.2",
  
  // PON port status
  ponPortStatus: "1.3.6.1.4.1.3902.1082.500.20.2.2.1.4",
  
  // GPON ONU table base OIDs
  onuSerialNumber: "1.3.6.1.4.1.3902.1082.500.20.2.3.1.3",
  onuDescription: "1.3.6.1.4.1.3902.1082.500.20.2.3.1.6",  // ZTE ONU description/name
  onuStatus: "1.3.6.1.4.1.3902.1082.500.20.2.3.1.5",
  onuRxPower: "1.3.6.1.4.1.3902.1082.500.20.2.4.1.3",
  onuTxPower: "1.3.6.1.4.1.3902.1082.500.20.2.4.1.4",
  onuDistance: "1.3.6.1.4.1.3902.1082.500.20.2.3.1.12",
  
  // PON port ONU count
  ponOnuCount: "1.3.6.1.4.1.3902.1082.500.20.2.2.1.8",
};

export class SnmpClient {
  private config: SnmpConfig;
  private session: snmp.Session | null = null;

  constructor(config: SnmpConfig) {
    this.config = {
      version: snmp.Version1,
      timeout: 5000,
      retries: 1,
      ...config,
      port: config.port || 161,
    };
  }

  private createSession(): snmp.Session {
    const options: snmp.SessionOptions = {
      port: this.config.port,
      version: this.config.version,
      timeout: this.config.timeout,
      retries: this.config.retries,
    };
    
    return snmp.createSession(this.config.host, this.config.community, options);
  }

  async get(oids: string[]): Promise<Map<string, any>> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      const results = new Map<string, any>();

      session.get(oids, (error, varbinds) => {
        session.close();
        
        if (error) {
          reject(error);
          return;
        }

        if (varbinds) {
          for (const varbind of varbinds) {
            if (snmp.isVarbindError(varbind)) {
              console.warn(`SNMP error for OID ${varbind.oid}: ${snmp.varbindError(varbind)}`);
            } else {
              results.set(varbind.oid, this.parseValue(varbind));
            }
          }
        }

        resolve(results);
      });
    });
  }

  async walk(oid: string): Promise<Map<string, any>> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      const results = new Map<string, any>();

      session.subtree(
        oid,
        (varbinds: snmp.Varbind[]) => {
          for (const varbind of varbinds) {
            if (!snmp.isVarbindError(varbind)) {
              results.set(varbind.oid, this.parseValue(varbind));
            }
          }
        },
        (error: Error | null) => {
          session.close();
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        }
      );
    });
  }

  private parseValue(varbind: snmp.Varbind): any {
    const value = varbind.value;
    
    if (Buffer.isBuffer(value)) {
      // Try to convert to string if it looks like text
      const str = value.toString("utf8");
      if (/^[\x20-\x7E\s]*$/.test(str)) {
        return str.trim();
      }
      // Return hex string for binary data
      return value.toString("hex");
    }
    
    return value;
  }

  close(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

export class OltSnmpClient {
  private snmpClient: SnmpClient;
  private vendor: "huawei" | "zte";
  private oids: typeof HUAWEI_OIDS | typeof ZTE_OIDS;

  constructor(
    host: string,
    community: string,
    vendor: "huawei" | "zte",
    port: number = 161
  ) {
    this.snmpClient = new SnmpClient({
      host,
      port,
      community,
      version: snmp.Version2c,
      timeout: 10000,
      retries: 2,
    });
    this.vendor = vendor;
    this.oids = vendor === "huawei" ? HUAWEI_OIDS : ZTE_OIDS;
  }

  async getSystemInfo(): Promise<OltSnmpData> {
    try {
      const standardOids = [
        STANDARD_OIDS.sysDescr,
        STANDARD_OIDS.sysName,
        STANDARD_OIDS.sysUptime,
      ];

      console.log(`[SNMP] Querying standard OIDs: ${standardOids.join(", ")}`);

      // Get standard MIB data first
      const standardResults = await this.snmpClient.get(standardOids).catch((err) => {
        console.error(`[SNMP] Standard OID query failed:`, err.message);
        return new Map();
      });

      console.log(`[SNMP] Standard results: ${standardResults.size} values`);
      standardResults.forEach((value, oid) => {
        console.log(`[SNMP] Standard ${oid}: ${value}`);
      });

      const data: OltSnmpData = {};

      // Parse standard MIB data
      if (standardResults.has(STANDARD_OIDS.sysDescr)) {
        data.sysDescr = standardResults.get(STANDARD_OIDS.sysDescr);
        const fwMatch = data.sysDescr?.match(/Version\s+([\d.]+)/i);
        if (fwMatch) {
          data.firmwareVersion = fwMatch[1];
        }
      }
      
      if (standardResults.has(STANDARD_OIDS.sysName)) {
        data.sysName = standardResults.get(STANDARD_OIDS.sysName);
      }
      
      if (standardResults.has(STANDARD_OIDS.sysUptime)) {
        data.sysUptime = Math.floor(standardResults.get(STANDARD_OIDS.sysUptime) / 100);
      }

      // For Huawei SmartAX (MA5600/MA5683 series), use board-level metrics via SNMP walk
      if (this.vendor === "huawei") {
        await this.getHuaweiBoardMetrics(data);
      } else {
        // ZTE and others - try direct OID get
        const vendorOids = [
          this.oids.cpuUsage,
          this.oids.memoryUsage,
          this.oids.temperature,
        ];
        
        console.log(`[SNMP] Querying vendor OIDs (${this.vendor}): ${vendorOids.join(", ")}`);
        
        const vendorResults = await this.snmpClient.get(vendorOids).catch((err) => {
          console.error(`[SNMP] Vendor OID query failed:`, err.message);
          return new Map();
        });

        console.log(`[SNMP] Vendor results: ${vendorResults.size} values`);
        vendorResults.forEach((value, oid) => {
          console.log(`[SNMP] Vendor ${oid}: ${value}`);
        });

        if (vendorResults.has(this.oids.cpuUsage)) {
          data.cpuUsage = Number(vendorResults.get(this.oids.cpuUsage));
        }
        if (vendorResults.has(this.oids.memoryUsage)) {
          data.memoryUsage = Number(vendorResults.get(this.oids.memoryUsage));
        }
        if (vendorResults.has(this.oids.temperature)) {
          data.temperature = Number(vendorResults.get(this.oids.temperature));
        }
      }

      console.log(`[SNMP] Final data:`, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("SNMP getSystemInfo error:", error);
      throw error;
    }
  }

  private async getHuaweiBoardMetrics(data: OltSnmpData): Promise<void> {
    const huaweiOids = this.oids as typeof HUAWEI_OIDS;
    
    console.log(`[SNMP] Walking Huawei board metrics tables...`);
    
    // Huawei uses 255 (0xFF) as "not applicable" for boards without monitoring
    const INVALID_VALUE = 255;
    
    try {
      // Walk board CPU usage table
      const cpuResults = await this.snmpClient.walk(huaweiOids.boardCpuUsage).catch((err) => {
        console.log(`[SNMP] Board CPU walk failed: ${err.message}`);
        return new Map();
      });
      
      console.log(`[SNMP] Board CPU results: ${cpuResults.size} entries`);
      if (cpuResults.size > 0) {
        // Get the highest valid CPU usage (filter out 255 = not applicable)
        let maxCpu = -1;
        cpuResults.forEach((value, oid) => {
          const cpu = Number(value);
          const isValid = cpu >= 0 && cpu <= 100;
          console.log(`[SNMP] Board CPU ${oid}: ${cpu}%${isValid ? "" : " (invalid)"}`);
          if (isValid && cpu > maxCpu) maxCpu = cpu;
        });
        if (maxCpu >= 0) {
          data.cpuUsage = maxCpu;
        }
      }

      // Walk board memory usage table
      const memResults = await this.snmpClient.walk(huaweiOids.boardMemoryUsage).catch((err) => {
        console.log(`[SNMP] Board memory walk failed: ${err.message}`);
        return new Map();
      });
      
      console.log(`[SNMP] Board memory results: ${memResults.size} entries`);
      if (memResults.size > 0) {
        let maxMem = -1;
        memResults.forEach((value, oid) => {
          const mem = Number(value);
          const isValid = mem >= 0 && mem <= 100;
          console.log(`[SNMP] Board memory ${oid}: ${mem}%${isValid ? "" : " (invalid)"}`);
          if (isValid && mem > maxMem) maxMem = mem;
        });
        if (maxMem >= 0) {
          data.memoryUsage = maxMem;
        }
      }

      // Walk board temperature table
      const tempResults = await this.snmpClient.walk(huaweiOids.boardTemperature).catch((err) => {
        console.log(`[SNMP] Board temperature walk failed: ${err.message}`);
        return new Map();
      });
      
      console.log(`[SNMP] Board temperature results: ${tempResults.size} entries`);
      if (tempResults.size > 0) {
        // Temperature: filter out 0, 1 (not available) and values > 100 (invalid)
        let maxTemp = -1;
        tempResults.forEach((value, oid) => {
          const temp = Number(value);
          // Valid temps are typically 20-80°C for OLT boards
          const isValid = temp > 10 && temp < 100;
          console.log(`[SNMP] Board temp ${oid}: ${temp}°C${isValid ? "" : " (likely invalid)"}`);
          if (isValid && temp > maxTemp) maxTemp = temp;
        });
        if (maxTemp > 0) {
          data.temperature = maxTemp;
        }
      }
    } catch (error) {
      console.error(`[SNMP] Huawei board metrics error:`, error);
    }
  }

  async getOnuCount(): Promise<number> {
    try {
      const results = await this.snmpClient.walk(this.oids.ponOnuCount);
      let totalOnus = 0;
      
      results.forEach((value) => {
        totalOnus += Number(value) || 0;
      });
      
      return totalOnus;
    } catch (error) {
      console.error("SNMP getOnuCount error:", error);
      return 0;
    }
  }

  // Discover all ONUs on this OLT
  async discoverOnus(): Promise<DiscoveredOnu[]> {
    console.log(`[SNMP] Starting ONU discovery for ${this.vendor} OLT...`);
    const discoveredOnus: DiscoveredOnu[] = [];

    try {
      // Walk the ONU serial number table
      console.log(`[SNMP] Walking ONU serial number table: ${this.oids.onuSerialNumber}`);
      const serialResults = await this.snmpClient.walk(this.oids.onuSerialNumber).catch((err) => {
        console.log(`[SNMP] ONU serial walk failed: ${err.message}`);
        return new Map();
      });

      console.log(`[SNMP] Found ${serialResults.size} ONUs`);

      // Walk the ONU status table
      const statusResults = await this.snmpClient.walk(this.oids.onuStatus).catch((err) => {
        console.log(`[SNMP] ONU status walk failed: ${err.message}`);
        return new Map();
      });
      console.log(`[SNMP] Found ${statusResults.size} status entries`);

      // Walk the ONU description table
      let descResults = new Map<string, any>();
      if (this.oids.onuDescription) {
        descResults = await this.snmpClient.walk(this.oids.onuDescription).catch((err) => {
          console.log(`[SNMP] ONU description walk failed: ${err.message}`);
          return new Map();
        });
        console.log(`[SNMP] Found ${descResults.size} description entries`);
      }

      // Parse discovered ONUs
      let parseCount = 0;
      serialResults.forEach((serialValue, oid) => {
        try {
          // Extract index from OID (e.g., 1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3.X.Y)
          const oidParts = oid.split(".");
          const baseOidLength = this.oids.onuSerialNumber.split(".").length;
          const indexParts = oidParts.slice(baseOidLength);
          
          // Log first few for debugging
          if (parseCount < 3) {
            console.log(`[SNMP] ONU OID index parts: ${indexParts.join(".")}`);
          }
          parseCount++;
          
          let ponPort = 0;
          let onuId = 0;
          
          if (this.vendor === "huawei") {
            // Huawei MA5600 series uses: <ifIndex>.<onuIndex>
            // ifIndex is encoded as: 4194304000 + (slot * 65536) + (port * 256)
            // Or sometimes: <frame>.<slot>.<port>.<onuId>
            
            if (indexParts.length === 2) {
              // Format: <ifIndex>.<onuId>
              const ifIndex = parseInt(indexParts[0]) || 0;
              onuId = parseInt(indexParts[1]) || 0;
              
              // Decode ifIndex: 4194304000 is base for GPON interfaces
              // ifIndex = 4194304000 + (slot << 13) + (port << 8) for some models
              // Or ifIndex = 4194304000 + (slot * 8 + port) * 256 for others
              const baseIndex = 4194304000;
              if (ifIndex >= baseIndex) {
                const offset = ifIndex - baseIndex;
                // Try to extract slot and port from offset
                const slot = Math.floor(offset / 65536) & 0xFF;
                const port = Math.floor((offset % 65536) / 256) & 0xFF;
                ponPort = slot * 8 + port; // Combine slot and port
              } else {
                ponPort = Math.floor(ifIndex / 256) & 0xFF;
              }
            } else if (indexParts.length >= 4) {
              // Format: <frame>.<slot>.<port>.<onuId>
              const slot = parseInt(indexParts[1]) || 0;
              const port = parseInt(indexParts[2]) || 0;
              onuId = parseInt(indexParts[3]) || 0;
              ponPort = slot * 8 + port;
            } else if (indexParts.length >= 1) {
              // Single index or unknown format
              const idx = parseInt(indexParts[0]) || 0;
              ponPort = 1;
              onuId = idx & 0xFF;
            }
          } else {
            // ZTE: typically <slotPort>.<onuId>
            if (indexParts.length >= 2) {
              ponPort = parseInt(indexParts[0]) || 0;
              onuId = parseInt(indexParts[1]) || 0;
            }
          }
          
          // Ensure values fit in database integer columns (reasonable ranges)
          ponPort = Math.max(0, Math.min(ponPort, 255));
          onuId = Math.max(1, Math.min(onuId, 255));

          // Parse serial number (may be hex or ASCII)
          let serialNumber = "";
          if (typeof serialValue === "string") {
            serialNumber = serialValue;
          } else if (Buffer.isBuffer(serialValue)) {
            // Convert buffer to hex string
            serialNumber = serialValue.toString("hex").toUpperCase();
          } else {
            serialNumber = String(serialValue);
          }

          // Get status from status results
          let status = "offline";
          const statusOid = oid.replace(this.oids.onuSerialNumber, this.oids.onuStatus);
          if (statusResults.has(statusOid)) {
            const statusVal = Number(statusResults.get(statusOid));
            // Huawei status: 1=online, 2=offline, 3=los
            // ZTE status: 1=online, 2=los, others=offline
            if (this.vendor === "huawei") {
              switch (statusVal) {
                case 1: status = "online"; break;
                case 2: status = "offline"; break;
                case 3: status = "los"; break;
                default: status = "offline";
              }
            } else {
              switch (statusVal) {
                case 1: status = "online"; break;
                case 2: status = "los"; break;
                default: status = "offline";
              }
            }
          }

          // Get description from description results
          let description: string | undefined;
          const descOid = oid.replace(this.oids.onuSerialNumber, this.oids.onuDescription || "");
          if (descResults.has(descOid)) {
            const descValue = descResults.get(descOid);
            if (typeof descValue === "string") {
              description = descValue.trim();
            } else if (Buffer.isBuffer(descValue)) {
              description = descValue.toString("utf8").trim();
            } else if (descValue) {
              description = String(descValue).trim();
            }
            // Remove empty descriptions
            if (!description || description === "") {
              description = undefined;
            }
          }

          console.log(`[SNMP] Discovered ONU: SN=${serialNumber}, PON=${ponPort}, ID=${onuId}, Status=${status}, Desc=${description || "N/A"}`);

          discoveredOnus.push({
            serialNumber,
            ponPort,
            onuId,
            status,
            description,
            index: indexParts.join("."),
          });
        } catch (parseError) {
          console.error(`[SNMP] Error parsing ONU OID ${oid}:`, parseError);
        }
      });

      console.log(`[SNMP] Discovery complete: ${discoveredOnus.length} ONUs found`);
      return discoveredOnus;
    } catch (error) {
      console.error("[SNMP] ONU discovery error:", error);
      return [];
    }
  }

  async getOnuOpticalPower(ponPort: number, onuId: number): Promise<OnuSnmpData> {
    // Individual ONU poll - not efficient for Huawei, use bulkPollOpticalPower instead
    return {};
  }

  // Bulk poll all ONU optical power levels and status via SNMP walk
  async bulkPollOpticalPower(): Promise<Map<string, OnuSnmpData>> {
    const results = new Map<string, OnuSnmpData>();
    
    try {
      console.log(`[SNMP] Walking ONU status and optical power tables...`);
      
      // Walk status table first
      const statusResults = await this.snmpClient.walk(this.oids.onuStatus).catch((err) => {
        console.log(`[SNMP] Status walk failed: ${err.message}`);
        return new Map();
      });
      console.log(`[SNMP] Found ${statusResults.size} status entries`);
      
      // Walk RX power table
      const rxResults = await this.snmpClient.walk(this.oids.onuRxPower).catch((err) => {
        console.log(`[SNMP] RX power walk failed: ${err.message}`);
        return new Map();
      });
      console.log(`[SNMP] Found ${rxResults.size} RX power entries`);
      
      // Walk TX power table
      const txResults = await this.snmpClient.walk(this.oids.onuTxPower).catch((err) => {
        console.log(`[SNMP] TX power walk failed: ${err.message}`);
        return new Map();
      });
      console.log(`[SNMP] Found ${txResults.size} TX power entries`);
      
      // Walk distance table  
      const distResults = await this.snmpClient.walk(this.oids.onuDistance).catch((err) => {
        console.log(`[SNMP] Distance walk failed: ${err.message}`);
        return new Map();
      });
      console.log(`[SNMP] Found ${distResults.size} distance entries`);
      
      // Parse status results first
      statusResults.forEach((value, oid) => {
        try {
          const { ponPort, onuId } = this.parseOltOidIndex(oid, this.oids.onuStatus);
          const key = `${ponPort}.${onuId}`;
          
          if (!results.has(key)) {
            results.set(key, {});
          }
          
          // Huawei status values: 1=online, 2=offline, 3=los
          // ZTE status values may differ
          const statusValue = Number(value);
          let status: string;
          if (this.vendor === "huawei") {
            switch (statusValue) {
              case 1: status = "online"; break;
              case 2: status = "offline"; break;
              case 3: status = "los"; break;
              default: status = "offline";
            }
          } else {
            // ZTE status mapping
            switch (statusValue) {
              case 1: status = "online"; break;
              case 2: status = "los"; break;
              default: status = "offline";
            }
          }
          results.get(key)!.status = status;
        } catch (e) {
          // Skip invalid entries
        }
      });
      
      // Parse RX power results and build result map keyed by ponPort.onuId
      rxResults.forEach((value, oid) => {
        try {
          const { ponPort, onuId } = this.parseOltOidIndex(oid, this.oids.onuRxPower);
          const key = `${ponPort}.${onuId}`;
          
          if (!results.has(key)) {
            results.set(key, {});
          }
          
          // Power is typically in 0.01 dBm units
          const rxPower = Number(value) / 100;
          if (rxPower > -50 && rxPower < 10) { // Valid range check
            results.get(key)!.rxPower = rxPower;
          }
        } catch (e) {
          // Skip invalid entries
        }
      });
      
      // Add TX power to results
      txResults.forEach((value, oid) => {
        try {
          const { ponPort, onuId } = this.parseOltOidIndex(oid, this.oids.onuTxPower);
          const key = `${ponPort}.${onuId}`;
          
          if (!results.has(key)) {
            results.set(key, {});
          }
          
          const txPower = Number(value) / 100;
          if (txPower > -50 && txPower < 10) { // Valid range check
            results.get(key)!.txPower = txPower;
          }
        } catch (e) {
          // Skip invalid entries
        }
      });
      
      // Add distance to results
      distResults.forEach((value, oid) => {
        try {
          const { ponPort, onuId } = this.parseOltOidIndex(oid, this.oids.onuDistance);
          const key = `${ponPort}.${onuId}`;
          
          if (!results.has(key)) {
            results.set(key, {});
          }
          
          const distance = Number(value);
          if (distance > 0 && distance < 100000) { // Valid range check (up to 100km)
            results.get(key)!.distance = distance;
          }
        } catch (e) {
          // Skip invalid entries
        }
      });
      
      console.log(`[SNMP] Parsed optical data for ${results.size} ONUs`);
      return results;
    } catch (error) {
      console.error("SNMP bulkPollOpticalPower error:", error);
      return results;
    }
  }
  
  // Parse OID index to extract ponPort and onuId
  private parseOltOidIndex(oid: string, baseOid: string): { ponPort: number; onuId: number } {
    const oidParts = oid.split(".");
    const baseLength = baseOid.split(".").length;
    const indexParts = oidParts.slice(baseLength);
    
    let ponPort = 0;
    let onuId = 0;
    
    if (this.vendor === "huawei") {
      // Huawei format: <ifIndex>.<onuId>
      if (indexParts.length >= 2) {
        const ifIndex = parseInt(indexParts[0]) || 0;
        onuId = parseInt(indexParts[1]) || 0;
        
        // Decode ifIndex to get slot/port
        const baseIndex = 4194304000;
        if (ifIndex >= baseIndex) {
          const offset = ifIndex - baseIndex;
          const slot = Math.floor(offset / 65536) & 0xFF;
          const port = Math.floor((offset % 65536) / 256) & 0xFF;
          ponPort = slot * 8 + port;
        }
      }
    } else {
      // ZTE format: <slotPort>.<onuId>
      if (indexParts.length >= 2) {
        ponPort = parseInt(indexParts[0]) || 0;
        onuId = parseInt(indexParts[1]) || 0;
      }
    }
    
    ponPort = Math.max(0, Math.min(ponPort, 255));
    onuId = Math.max(1, Math.min(onuId, 255));
    
    return { ponPort, onuId };
  }

  async testConnection(): Promise<boolean> {
    try {
      const results = await this.snmpClient.get([STANDARD_OIDS.sysDescr]);
      return results.size > 0;
    } catch (error) {
      return false;
    }
  }

  // Get detailed OLT information including boards, uplinks, VLANs
  async getDetailedInfo(): Promise<OltDetailedInfo> {
    console.log(`[SNMP] Fetching detailed OLT info...`);
    
    const info: OltDetailedInfo = {
      sysName: "",
      sysDescr: "",
      sysUptime: 0,
      boards: [],
      uplinks: [],
      vlans: [],
      ponPorts: [],
    };

    try {
      // Get basic system info
      const sysResults = await this.snmpClient.get([
        STANDARD_OIDS.sysDescr,
        STANDARD_OIDS.sysName,
        STANDARD_OIDS.sysUptime,
        STANDARD_OIDS.sysLocation,
        STANDARD_OIDS.sysContact,
      ]);
      
      info.sysDescr = String(sysResults.get(STANDARD_OIDS.sysDescr) || "");
      info.sysName = String(sysResults.get(STANDARD_OIDS.sysName) || "");
      info.sysUptime = Number(sysResults.get(STANDARD_OIDS.sysUptime) || 0);
      info.sysLocation = String(sysResults.get(STANDARD_OIDS.sysLocation) || "");
      info.sysContact = String(sysResults.get(STANDARD_OIDS.sysContact) || "");

      // Get board information
      console.log(`[SNMP] Walking board tables...`);
      const boardTypes = await this.snmpClient.walk(this.oids.boardType).catch(() => new Map());
      const boardStatuses = await this.snmpClient.walk(this.oids.boardStatus).catch(() => new Map());
      const boardCpus = await this.snmpClient.walk(this.oids.boardCpuUsage).catch(() => new Map());
      const boardMems = await this.snmpClient.walk(this.oids.boardMemoryUsage).catch(() => new Map());
      const boardTemps = await this.snmpClient.walk(this.oids.boardTemperature).catch(() => new Map());

      // Parse boards
      const boardMap = new Map<string, OltBoard>();
      boardTypes.forEach((value, oid) => {
        const parts = oid.split(".");
        const frame = parseInt(parts[parts.length - 2]) || 0;
        const slot = parseInt(parts[parts.length - 1]) || 0;
        const key = `${frame}.${slot}`;
        
        let boardType = "";
        if (Buffer.isBuffer(value)) {
          boardType = value.toString("utf8").trim();
        } else {
          boardType = String(value);
        }
        
        boardMap.set(key, {
          frame,
          slot,
          boardType,
          status: "unknown",
        });
      });

      // Add status to boards
      boardStatuses.forEach((value, oid) => {
        const parts = oid.split(".");
        const frame = parseInt(parts[parts.length - 2]) || 0;
        const slot = parseInt(parts[parts.length - 1]) || 0;
        const key = `${frame}.${slot}`;
        
        if (boardMap.has(key)) {
          const statusVal = Number(value);
          boardMap.get(key)!.status = statusVal === 1 ? "normal" : statusVal === 2 ? "fault" : "unknown";
        }
      });

      // Add CPU/Memory/Temp to boards
      boardCpus.forEach((value, oid) => {
        const parts = oid.split(".");
        const frame = parseInt(parts[parts.length - 2]) || 0;
        const slot = parseInt(parts[parts.length - 1]) || 0;
        const key = `${frame}.${slot}`;
        if (boardMap.has(key)) {
          boardMap.get(key)!.cpuUsage = Number(value);
        }
      });

      boardMems.forEach((value, oid) => {
        const parts = oid.split(".");
        const frame = parseInt(parts[parts.length - 2]) || 0;
        const slot = parseInt(parts[parts.length - 1]) || 0;
        const key = `${frame}.${slot}`;
        if (boardMap.has(key)) {
          boardMap.get(key)!.memoryUsage = Number(value);
        }
      });

      boardTemps.forEach((value, oid) => {
        const parts = oid.split(".");
        const frame = parseInt(parts[parts.length - 2]) || 0;
        const slot = parseInt(parts[parts.length - 1]) || 0;
        const key = `${frame}.${slot}`;
        if (boardMap.has(key)) {
          boardMap.get(key)!.temperature = Number(value);
        }
      });

      info.boards = Array.from(boardMap.values()).sort((a, b) => 
        a.frame - b.frame || a.slot - b.slot
      );
      console.log(`[SNMP] Found ${info.boards.length} boards`);

      // Get interface/uplink information
      console.log(`[SNMP] Walking interface tables...`);
      const ifDescrs = await this.snmpClient.walk(this.oids.ifDescr).catch(() => new Map());
      const ifStatuses = await this.snmpClient.walk(this.oids.ifOperStatus).catch(() => new Map());
      const ifSpeeds = await this.snmpClient.walk(this.oids.ifSpeed).catch(() => new Map());
      const ifAliases = await this.snmpClient.walk(this.oids.ifAlias).catch(() => new Map());

      // Parse interfaces - filter for uplinks (GE/XGE/Eth ports)
      ifDescrs.forEach((value, oid) => {
        const ifIndex = oid.split(".").pop() || "";
        let descr = "";
        if (Buffer.isBuffer(value)) {
          descr = value.toString("utf8").trim();
        } else {
          descr = String(value);
        }
        
        // Filter for uplink ports (GigabitEthernet, XGigabitEthernet, Eth)
        if (descr.match(/^(GigabitEthernet|XGigabitEthernet|Eth|eth|ge|xge)/i)) {
          const statusOid = `${this.oids.ifOperStatus}.${ifIndex}`;
          const speedOid = `${this.oids.ifSpeed}.${ifIndex}`;
          const aliasOid = `${this.oids.ifAlias}.${ifIndex}`;
          
          const statusVal = Number(ifStatuses.get(statusOid) || 2);
          const speedVal = Number(ifSpeeds.get(speedOid) || 0);
          let alias = "";
          const aliasVal = ifAliases.get(aliasOid);
          if (Buffer.isBuffer(aliasVal)) {
            alias = aliasVal.toString("utf8").trim();
          } else if (aliasVal) {
            alias = String(aliasVal);
          }

          info.uplinks.push({
            port: descr,
            name: alias || descr,
            status: statusVal === 1 ? "up" : "down",
            speed: speedVal > 0 ? `${speedVal / 1000000}Mbps` : undefined,
          });
        }
      });
      console.log(`[SNMP] Found ${info.uplinks.length} uplink ports`);

      // Get VLAN information
      console.log(`[SNMP] Walking VLAN table...`);
      const vlanNames = await this.snmpClient.walk(this.oids.vlanName).catch(() => new Map());
      
      vlanNames.forEach((value, oid) => {
        const vlanId = parseInt(oid.split(".").pop() || "0");
        let name = "";
        if (Buffer.isBuffer(value)) {
          name = value.toString("utf8").trim();
        } else {
          name = String(value);
        }
        
        if (vlanId > 0 && vlanId < 4095) {
          info.vlans.push({ vlanId, name: name || `VLAN${vlanId}` });
        }
      });
      
      info.vlans.sort((a, b) => a.vlanId - b.vlanId);
      console.log(`[SNMP] Found ${info.vlans.length} VLANs`);

      // Get PON port info
      console.log(`[SNMP] Walking PON port tables...`);
      const ponCounts = await this.snmpClient.walk(this.oids.ponOnuCount).catch(() => new Map());
      const ponStatuses = await this.snmpClient.walk(this.oids.ponPortStatus).catch(() => new Map());

      ponCounts.forEach((value, oid) => {
        const parts = oid.split(".");
        const baseLen = this.oids.ponOnuCount.split(".").length;
        const indexParts = parts.slice(baseLen);
        
        let port = 0;
        if (this.vendor === "huawei" && indexParts.length >= 1) {
          const ifIndex = parseInt(indexParts[0]) || 0;
          const baseIndex = 4194304000;
          if (ifIndex >= baseIndex) {
            const offset = ifIndex - baseIndex;
            const slot = Math.floor(offset / 65536) & 0xFF;
            const portNum = Math.floor((offset % 65536) / 256) & 0xFF;
            port = slot * 8 + portNum;
          }
        } else {
          port = parseInt(indexParts[0]) || 0;
        }

        const statusOid = oid.replace(this.oids.ponOnuCount, this.oids.ponPortStatus);
        const statusVal = Number(ponStatuses.get(statusOid) || 1);

        info.ponPorts.push({
          port,
          onuCount: Number(value) || 0,
          status: statusVal === 1 ? "up" : "down",
        });
      });
      
      info.ponPorts.sort((a, b) => a.port - b.port);
      console.log(`[SNMP] Found ${info.ponPorts.length} PON ports`);

      return info;
    } catch (error) {
      console.error("[SNMP] getDetailedInfo error:", error);
      return info;
    }
  }

  close(): void {
    this.snmpClient.close();
  }
}

// Factory function
export function createSnmpClient(
  host: string,
  community: string,
  vendor: "huawei" | "zte",
  port: number = 161
): OltSnmpClient {
  return new OltSnmpClient(host, community, vendor, port);
}

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
  
  // Alternative system-level OIDs (hwEntitySystemModel - may not exist on all models)
  cpuUsage: "1.3.6.1.4.1.2011.6.3.4.1.2.0",
  memoryUsage: "1.3.6.1.4.1.2011.6.3.4.1.3.0",
  temperature: "1.3.6.1.4.1.2011.6.3.4.1.4.0",
  
  // GPON ONU table base OIDs
  onuSerialNumber: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3",
  onuStatus: "1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15",
  onuRxPower: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4",
  onuTxPower: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.6",
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
  
  // GPON ONU table base OIDs
  onuSerialNumber: "1.3.6.1.4.1.3902.1082.500.20.2.3.1.3",
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
    
    try {
      // Walk board CPU usage table
      const cpuResults = await this.snmpClient.walk(huaweiOids.boardCpuUsage).catch((err) => {
        console.log(`[SNMP] Board CPU walk failed: ${err.message}`);
        return new Map();
      });
      
      console.log(`[SNMP] Board CPU results: ${cpuResults.size} entries`);
      if (cpuResults.size > 0) {
        // Get the highest CPU usage across all boards (usually control board has highest)
        let maxCpu = 0;
        cpuResults.forEach((value, oid) => {
          const cpu = Number(value);
          console.log(`[SNMP] Board CPU ${oid}: ${cpu}%`);
          if (cpu > maxCpu) maxCpu = cpu;
        });
        data.cpuUsage = maxCpu;
      }

      // Walk board memory usage table
      const memResults = await this.snmpClient.walk(huaweiOids.boardMemoryUsage).catch((err) => {
        console.log(`[SNMP] Board memory walk failed: ${err.message}`);
        return new Map();
      });
      
      console.log(`[SNMP] Board memory results: ${memResults.size} entries`);
      if (memResults.size > 0) {
        let maxMem = 0;
        memResults.forEach((value, oid) => {
          const mem = Number(value);
          console.log(`[SNMP] Board memory ${oid}: ${mem}%`);
          if (mem > maxMem) maxMem = mem;
        });
        data.memoryUsage = maxMem;
      }

      // Walk board temperature table
      const tempResults = await this.snmpClient.walk(huaweiOids.boardTemperature).catch((err) => {
        console.log(`[SNMP] Board temperature walk failed: ${err.message}`);
        return new Map();
      });
      
      console.log(`[SNMP] Board temperature results: ${tempResults.size} entries`);
      if (tempResults.size > 0) {
        let maxTemp = 0;
        tempResults.forEach((value, oid) => {
          const temp = Number(value);
          console.log(`[SNMP] Board temp ${oid}: ${temp}°C`);
          if (temp > maxTemp) maxTemp = temp;
        });
        data.temperature = maxTemp;
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

  async getOnuOpticalPower(ponPort: number, onuId: number): Promise<OnuSnmpData> {
    try {
      // Build ONU-specific OIDs based on vendor indexing scheme
      let rxOid: string;
      let txOid: string;
      let distOid: string;
      
      if (this.vendor === "huawei") {
        // Huawei uses frame/slot/port/onuid index
        // Simplified: assuming frame 0, slot 0
        const index = `${ponPort}.${onuId}`;
        rxOid = `${this.oids.onuRxPower}.${index}`;
        txOid = `${this.oids.onuTxPower}.${index}`;
        distOid = `${this.oids.onuDistance}.${index}`;
      } else {
        // ZTE uses gpon-onu_slotId/portId:onuId format index
        const index = `${ponPort}.${onuId}`;
        rxOid = `${this.oids.onuRxPower}.${index}`;
        txOid = `${this.oids.onuTxPower}.${index}`;
        distOid = `${this.oids.onuDistance}.${index}`;
      }

      const results = await this.snmpClient.get([rxOid, txOid, distOid]);
      
      const data: OnuSnmpData = {};
      
      if (results.has(rxOid)) {
        // Power is typically in 0.01 dBm units
        data.rxPower = Number(results.get(rxOid)) / 100;
      }
      
      if (results.has(txOid)) {
        data.txPower = Number(results.get(txOid)) / 100;
      }
      
      if (results.has(distOid)) {
        // Distance in meters
        data.distance = Number(results.get(distOid));
      }

      return data;
    } catch (error) {
      console.error("SNMP getOnuOpticalPower error:", error);
      return {};
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const results = await this.snmpClient.get([STANDARD_OIDS.sysDescr]);
      return results.size > 0;
    } catch (error) {
      return false;
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

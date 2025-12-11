import type { Olt, Onu, ServiceProfile } from "@shared/schema";
import { HuaweiTelnetClient, ZteTelnetClient, OltTelnetClient } from "./telnet-client";

export interface OltDriverResult {
  success: boolean;
  message: string;
  commands?: string[];
  error?: string;
  timestamp: Date;
}

export interface OnuProvisioningConfig {
  onu: Onu;
  olt: Olt;
  serviceProfile?: ServiceProfile;
  vlan?: number;
  gemPort?: number;
  tcont?: number;
}

export interface Tr069ProvisioningConfig {
  onu: Onu;
  olt: Olt;
  acsUrl: string;
  acsUsername?: string;
  acsPassword?: string;
  periodicInformInterval?: number;
}

export interface VlanConfig {
  vlanId: number;
  name?: string;
  description?: string;
}

export interface VlanTrunkConfig {
  port: string;       // e.g., "0/0/1" for Huawei, "gei_1/1/1" for ZTE
  vlanList: number[]; // List of VLAN IDs to allow on the trunk
  nativeVlan?: number; // PVID/native VLAN
  mode?: "trunk" | "access" | "hybrid"; // Port mode
}

export abstract class OltDriver {
  protected olt: Olt;
  protected simulationMode: boolean;

  constructor(olt: Olt, simulationMode: boolean = true) {
    this.olt = olt;
    this.simulationMode = simulationMode;
  }

  abstract getVendor(): string;
  abstract buildAddOnuCommands(config: OnuProvisioningConfig): string[];
  abstract buildRemoveOnuCommands(onu: Onu): string[];
  abstract buildServiceProfileCommands(config: OnuProvisioningConfig): string[];
  abstract buildTr069Commands(config: Tr069ProvisioningConfig): string[];
  abstract buildVlanCommands(config: OnuProvisioningConfig): string[];
  abstract buildRebootOnuCommands(onu: Onu): string[];
  abstract buildCreateVlanCommands(vlan: VlanConfig): string[];
  abstract buildDeleteVlanCommands(vlanId: number): string[];
  abstract buildSaveConfigCommands(): string[];
  abstract buildTrunkVlanCommands(config: VlanTrunkConfig): string[];

  async executeCommands(commands: string[]): Promise<OltDriverResult> {
    if (this.simulationMode) {
      return this.simulateExecution(commands);
    }
    return this.realExecution(commands);
  }

  protected simulateExecution(commands: string[]): OltDriverResult {
    console.log(`[${this.getVendor()} OLT Driver] Simulation mode - Commands that would be sent to ${this.olt.ipAddress}:`);
    commands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
    
    return {
      success: true,
      message: `Simulated execution of ${commands.length} commands on ${this.olt.name} (${this.olt.ipAddress})`,
      commands,
      timestamp: new Date(),
    };
  }

  protected abstract createTelnetClient(): OltTelnetClient;

  protected async realExecution(commands: string[]): Promise<OltDriverResult> {
    const client = this.createTelnetClient();
    const outputs: string[] = [];
    
    try {
      // Connect and authenticate
      const connectResult = await client.connect();
      if (!connectResult.success) {
        return {
          success: false,
          message: `Failed to connect to OLT ${this.olt.name} (${this.olt.ipAddress})`,
          commands,
          error: connectResult.error,
          timestamp: new Date(),
        };
      }
      outputs.push(connectResult.output);

      console.log(`[${this.getVendor()} OLT Driver] Executing ${commands.length} commands on ${this.olt.ipAddress}`);

      // Execute each command
      for (const command of commands) {
        const result = await client.executeCommand(command);
        outputs.push(`${command}: ${result.output}`);
        
        if (!result.success) {
          await client.disconnect();
          return {
            success: false,
            message: `Command failed: ${command}`,
            commands,
            error: result.error,
            timestamp: new Date(),
          };
        }
      }

      // Disconnect
      await client.disconnect();

      return {
        success: true,
        message: `Successfully executed ${commands.length} commands on ${this.olt.name} (${this.olt.ipAddress})`,
        commands,
        timestamp: new Date(),
      };
    } catch (error) {
      await client.disconnect();
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Error executing commands on ${this.olt.name}`,
        commands,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  async provisionOnu(config: OnuProvisioningConfig): Promise<OltDriverResult> {
    const commands = [
      ...this.buildAddOnuCommands(config),
      ...this.buildServiceProfileCommands(config),
      ...this.buildVlanCommands(config),
    ];
    return this.executeCommands(commands);
  }

  async deprovisionOnu(onu: Onu): Promise<OltDriverResult> {
    const commands = this.buildRemoveOnuCommands(onu);
    return this.executeCommands(commands);
  }

  async provisionTr069(config: Tr069ProvisioningConfig): Promise<OltDriverResult> {
    const commands = this.buildTr069Commands(config);
    return this.executeCommands(commands);
  }

  async rebootOnu(onu: Onu): Promise<OltDriverResult> {
    const commands = this.buildRebootOnuCommands(onu);
    return this.executeCommands(commands);
  }

  async createVlan(vlan: VlanConfig): Promise<OltDriverResult> {
    const commands = this.buildCreateVlanCommands(vlan);
    return this.executeCommands(commands);
  }

  async deleteVlan(vlanId: number): Promise<OltDriverResult> {
    const commands = this.buildDeleteVlanCommands(vlanId);
    return this.executeCommands(commands);
  }

  async saveConfig(): Promise<OltDriverResult> {
    const commands = this.buildSaveConfigCommands();
    return this.executeCommands(commands);
  }

  async configureVlanTrunk(config: VlanTrunkConfig): Promise<OltDriverResult> {
    const commands = this.buildTrunkVlanCommands(config);
    return this.executeCommands(commands);
  }
}

export class HuaweiOltDriver extends OltDriver {
  getVendor(): string {
    return "Huawei";
  }

  protected createTelnetClient(): OltTelnetClient {
    // Use sshPort if explicitly set, otherwise default to standard telnet port 23
    // Note: sshPort defaults to 22 in schema, so we check if it's set to a non-SSH value
    const port = (this.olt.sshPort && this.olt.sshPort !== 22) ? this.olt.sshPort : 23;
    return new HuaweiTelnetClient(
      this.olt.ipAddress,
      port,
      this.olt.sshUsername || "",
      this.olt.sshPassword || ""
    );
  }

  buildAddOnuCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    const profileName = serviceProfile?.name || "default";
    
    return [
      "enable",
      "config",
      `interface gpon 0/${ponPort}`,
      `ont add ${ponPort} ${onuId} sn-auth "${onu.serialNumber}" omci ont-lineprofile-id 1 ont-srvprofile-id 1 desc "${onu.name || onu.serialNumber}"`,
      `ont port native-vlan ${ponPort} ${onuId} eth 1 vlan ${config.vlan || 100} priority 0`,
      "quit",
    ];
  }

  buildRemoveOnuCommands(onu: Onu): string[] {
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    
    return [
      "enable",
      "config",
      `interface gpon 0/${ponPort}`,
      `ont delete ${ponPort} ${onuId}`,
      "quit",
    ];
  }

  buildServiceProfileCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    if (!serviceProfile) return [];
    
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    const tcont = config.tcont || 1;
    const gemPort = config.gemPort || 1;
    
    return [
      `interface gpon 0/${ponPort}`,
      `ont ipconfig ${ponPort} ${onuId} dhcp`,
      `ont service-port ${ponPort} ${onuId} gemport ${gemPort} vlan ${serviceProfile.internetVlan || 100}`,
      `ont traffic-profile-id ${ponPort} ${onuId} profile-id 1`,
      "quit",
    ];
  }

  buildVlanCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    const vlan = serviceProfile?.internetVlan || config.vlan || 100;
    
    return [
      `service-port vlan ${vlan} gpon 0/${ponPort} ont ${onuId} gemport 1 multi-service user-vlan ${vlan}`,
    ];
  }

  buildTr069Commands(config: Tr069ProvisioningConfig): string[] {
    const { onu, acsUrl, acsUsername, acsPassword, periodicInformInterval } = config;
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    
    const commands = [
      "enable",
      "config",
      `interface gpon 0/${ponPort}`,
      `ont tr069-server-config ${ponPort} ${onuId} acs-url "${acsUrl}"`,
    ];
    
    if (acsUsername) {
      commands.push(`ont tr069-server-config ${ponPort} ${onuId} username "${acsUsername}"`);
    }
    if (acsPassword) {
      commands.push(`ont tr069-server-config ${ponPort} ${onuId} password "${acsPassword}"`);
    }
    if (periodicInformInterval) {
      commands.push(`ont tr069-server-config ${ponPort} ${onuId} periodic-inform-interval ${periodicInformInterval}`);
    }
    
    commands.push(
      `ont tr069-server-config ${ponPort} ${onuId} enable`,
      "quit",
      "quit"
    );
    
    return commands;
  }

  buildRebootOnuCommands(onu: Onu): string[] {
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    
    return [
      "enable",
      "config",
      `interface gpon 0/${ponPort}`,
      `ont reset ${ponPort} ${onuId}`,
      "quit",
    ];
  }

  buildBandwidthCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    if (!serviceProfile) return [];
    
    const ponPort = onu.ponPort || 0;
    const onuId = onu.onuId || 1;
    const downloadKbps = serviceProfile.downloadSpeed * 1000;
    const uploadKbps = serviceProfile.uploadSpeed * 1000;
    
    return [
      "enable",
      "config",
      `dba-profile add profile-id 1 type4 max ${uploadKbps}`,
      `interface gpon 0/${ponPort}`,
      `ont modify ${ponPort} ${onuId} dba-profile-id 1`,
      "quit",
      `traffic-profile ip index 1`,
      `car cir ${downloadKbps} pir ${downloadKbps} cbs 0 pbs 0`,
      "quit",
    ];
  }

  buildCreateVlanCommands(vlan: VlanConfig): string[] {
    const commands = [
      "enable",
      "config",
      `vlan ${vlan.vlanId} smart`,
    ];
    if (vlan.name) {
      commands.push(`vlan name ${vlan.vlanId} name ${vlan.name}`);
    }
    if (vlan.description) {
      commands.push(`vlan desc ${vlan.vlanId} description ${vlan.description}`);
    }
    commands.push("quit");
    return commands;
  }

  buildDeleteVlanCommands(vlanId: number): string[] {
    return [
      "enable",
      "config",
      `undo vlan ${vlanId}`,
      "quit",
    ];
  }

  buildSaveConfigCommands(): string[] {
    return [
      "enable",
      "save",
      "y",
    ];
  }

  buildTrunkVlanCommands(config: VlanTrunkConfig): string[] {
    const commands = [
      "enable",
      "config",
      `interface ${config.port}`,
    ];
    
    // Set port mode
    if (config.mode === "trunk") {
      commands.push("port link-type trunk");
      if (config.vlanList.length > 0) {
        commands.push(`port trunk allow-pass vlan ${config.vlanList.join(" ")}`);
      }
      if (config.nativeVlan) {
        commands.push(`port trunk pvid vlan ${config.nativeVlan}`);
      }
    } else if (config.mode === "hybrid") {
      commands.push("port link-type hybrid");
      if (config.vlanList.length > 0) {
        commands.push(`port hybrid tagged vlan ${config.vlanList.join(" ")}`);
      }
      if (config.nativeVlan) {
        commands.push(`port hybrid untagged vlan ${config.nativeVlan}`);
        commands.push(`port hybrid pvid vlan ${config.nativeVlan}`);
      }
    } else if (config.mode === "access") {
      commands.push("port link-type access");
      if (config.nativeVlan) {
        commands.push(`port default vlan ${config.nativeVlan}`);
      }
    }
    
    commands.push("quit", "quit");
    return commands;
  }
}

export class ZteOltDriver extends OltDriver {
  getVendor(): string {
    return "ZTE";
  }

  protected createTelnetClient(): OltTelnetClient {
    // Use sshPort if explicitly set, otherwise default to standard telnet port 23
    // Note: sshPort defaults to 22 in schema, so we check if it's set to a non-SSH value
    const port = (this.olt.sshPort && this.olt.sshPort !== 22) ? this.olt.sshPort : 23;
    return new ZteTelnetClient(
      this.olt.ipAddress,
      port,
      this.olt.sshUsername || "",
      this.olt.sshPassword || ""
    );
  }

  buildAddOnuCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    
    return [
      "enable",
      "configure terminal",
      `interface gpon-olt_1/${ponPort}`,
      `onu ${onuId} type auto sn ${onu.serialNumber}`,
      "exit",
      `interface gpon-onu_1/${ponPort}:${onuId}`,
      `name "${onu.name || onu.serialNumber}"`,
      "exit",
    ];
  }

  buildRemoveOnuCommands(onu: Onu): string[] {
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    
    return [
      "enable",
      "configure terminal",
      `interface gpon-olt_1/${ponPort}`,
      `no onu ${onuId}`,
      "exit",
    ];
  }

  buildServiceProfileCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    if (!serviceProfile) return [];
    
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    const vlan = serviceProfile.internetVlan || 100;
    
    return [
      `interface gpon-onu_1/${ponPort}:${onuId}`,
      `tcont 1 profile ${serviceProfile.name || "default"}`,
      `gemport 1 tcont 1`,
      `service-port 1 vport 1 user-vlan ${vlan} vlan ${vlan}`,
      "exit",
      `pon-onu-mng gpon-onu_1/${ponPort}:${onuId}`,
      `service 1 gemport 1 vlan ${vlan}`,
      `vlan port eth_0/1 mode tag vlan ${vlan}`,
      "exit",
    ];
  }

  buildVlanCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    const vlan = serviceProfile?.internetVlan || config.vlan || 100;
    
    return [
      `interface gpon-onu_1/${ponPort}:${onuId}`,
      `switchport mode hybrid vport 1`,
      `service-port 1 vport 1 user-vlan ${vlan} vlan ${vlan}`,
      "exit",
    ];
  }

  buildTr069Commands(config: Tr069ProvisioningConfig): string[] {
    const { onu, acsUrl, acsUsername, acsPassword, periodicInformInterval } = config;
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    
    const commands = [
      "enable",
      "configure terminal",
      `pon-onu-mng gpon-onu_1/${ponPort}:${onuId}`,
      `tr069-mgmt enable`,
      `tr069-mgmt acs-url "${acsUrl}"`,
    ];
    
    if (acsUsername) {
      commands.push(`tr069-mgmt acs-username "${acsUsername}"`);
    }
    if (acsPassword) {
      commands.push(`tr069-mgmt acs-password "${acsPassword}"`);
    }
    if (periodicInformInterval) {
      commands.push(`tr069-mgmt periodic-inform-interval ${periodicInformInterval}`);
    }
    
    commands.push("exit");
    
    return commands;
  }

  buildRebootOnuCommands(onu: Onu): string[] {
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    
    return [
      "enable",
      "configure terminal",
      `pon-onu-mng gpon-onu_1/${ponPort}:${onuId}`,
      "reboot",
      "exit",
    ];
  }

  buildBandwidthCommands(config: OnuProvisioningConfig): string[] {
    const { onu, serviceProfile } = config;
    if (!serviceProfile) return [];
    
    const ponPort = onu.ponPort || 1;
    const onuId = onu.onuId || 1;
    const downloadKbps = serviceProfile.downloadSpeed * 1000;
    const uploadKbps = serviceProfile.uploadSpeed * 1000;
    
    return [
      "enable",
      "configure terminal",
      `gpon-onu-profile-tcont 1 type4 maximum ${uploadKbps}`,
      `interface gpon-onu_1/${ponPort}:${onuId}`,
      `tcont 1 profile 1`,
      "exit",
      `traffic-profile 1`,
      `cir ${downloadKbps}`,
      `pir ${downloadKbps}`,
      "exit",
    ];
  }

  buildCreateVlanCommands(vlan: VlanConfig): string[] {
    const commands = [
      "enable",
      "configure terminal",
      `vlan ${vlan.vlanId}`,
    ];
    if (vlan.name) {
      commands.push(`name ${vlan.name}`);
    }
    commands.push("exit");
    return commands;
  }

  buildDeleteVlanCommands(vlanId: number): string[] {
    return [
      "enable",
      "configure terminal",
      `no vlan ${vlanId}`,
      "exit",
    ];
  }

  buildSaveConfigCommands(): string[] {
    return [
      "enable",
      "write",
    ];
  }

  buildTrunkVlanCommands(config: VlanTrunkConfig): string[] {
    const commands = [
      "enable",
      "configure terminal",
      `interface ${config.port}`,
    ];
    
    // Set port mode
    if (config.mode === "trunk") {
      commands.push("switchport mode trunk");
      if (config.vlanList.length > 0) {
        commands.push(`switchport trunk vlan-allowed add ${config.vlanList.join(",")}`);
      }
      if (config.nativeVlan) {
        commands.push(`switchport trunk native vlan ${config.nativeVlan}`);
      }
    } else if (config.mode === "hybrid") {
      commands.push("switchport mode hybrid");
      if (config.vlanList.length > 0) {
        commands.push(`switchport hybrid vlan-allowed add ${config.vlanList.join(",")} tagged`);
      }
      if (config.nativeVlan) {
        commands.push(`switchport hybrid native vlan ${config.nativeVlan}`);
      }
    } else if (config.mode === "access") {
      commands.push("switchport mode access");
      if (config.nativeVlan) {
        commands.push(`switchport access vlan ${config.nativeVlan}`);
      }
    }
    
    commands.push("exit", "exit");
    return commands;
  }
}

export function createOltDriver(olt: Olt, simulationMode: boolean = true): OltDriver {
  switch (olt.vendor) {
    case "huawei":
      return new HuaweiOltDriver(olt, simulationMode);
    case "zte":
      return new ZteOltDriver(olt, simulationMode);
    default:
      throw new Error(`Unsupported OLT vendor: ${olt.vendor}`);
  }
}

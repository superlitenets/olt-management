import { spawn } from "child_process";
import { writeFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import type { VpnProfile } from "@shared/schema";

export type ProvisioningStatus = "pending" | "running" | "success" | "failed";

export interface ProvisioningResult {
  status: ProvisioningStatus;
  message: string;
  firewallApplied: boolean;
  openvpnConfigured: boolean;
  errors: string[];
  timestamp: Date;
}

interface OpenVpnServerConfig {
  port?: number;
  proto?: "udp" | "tcp";
  dev?: string;
  subnet?: string;
  subnetMask?: string;
}

class VpsProvisioner {
  private openvpnConfigDir: string;
  private provisioningResults: Map<string, ProvisioningResult> = new Map();

  constructor() {
    this.openvpnConfigDir = "/etc/openvpn/server";
  }

  private async executeCommand(command: string, args: string[] = []): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      proc.on("error", (error) => {
        resolve({
          success: false,
          stdout: "",
          stderr: error.message,
        });
      });
    });
  }

  private async checkSudoAccess(): Promise<boolean> {
    const result = await this.executeCommand("sudo", ["-n", "true"]);
    return result.success;
  }

  private async checkIptablesAvailable(): Promise<boolean> {
    const result = await this.executeCommand("which", ["iptables"]);
    return result.success;
  }

  private async checkOpenvpnAvailable(): Promise<boolean> {
    const result = await this.executeCommand("which", ["openvpn"]);
    return result.success;
  }

  async getEnvironmentCapabilities(): Promise<{
    canProvision: boolean;
    hasSudo: boolean;
    hasIptables: boolean;
    hasOpenvpn: boolean;
    isReplit: boolean;
    reason?: string;
  }> {
    const isReplit = !!(
      process.env.REPLIT_DEPLOYMENT_ID ||
      process.env.REPL_ID ||
      process.env.REPL_SLUG ||
      process.env.REPLIT_CLUSTER
    );

    if (isReplit) {
      return {
        canProvision: false,
        hasSudo: false,
        hasIptables: false,
        hasOpenvpn: false,
        isReplit: true,
        reason: "Automatic VPS provisioning is not available in Replit environment. Deploy with Docker for full VPN server capabilities.",
      };
    }

    const [hasSudo, hasIptables, hasOpenvpn] = await Promise.all([
      this.checkSudoAccess(),
      this.checkIptablesAvailable(),
      this.checkOpenvpnAvailable(),
    ]);

    const canProvision = hasSudo && hasIptables;
    let reason: string | undefined;

    if (!hasSudo) {
      reason = "Passwordless sudo access required for firewall configuration";
    } else if (!hasIptables) {
      reason = "iptables not found. Install iptables package.";
    }

    return {
      canProvision,
      hasSudo,
      hasIptables,
      hasOpenvpn,
      isReplit: false,
      reason,
    };
  }

  async applyFirewallRules(vpnProfile: VpnProfile, options: { vpnInterface?: string; vpnSubnet?: string } = {}): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const vpnInterface = options.vpnInterface || "tun0";
    const vpnSubnet = options.vpnSubnet || "10.8.0.0/24";
    const sanitizedName = vpnProfile.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    const tr069Ips = vpnProfile.tr069Ips || [];
    const managementIps = vpnProfile.managementIps || [];
    const allIps = [...tr069Ips, ...managementIps];

    console.log(`[VPS Provisioner] Applying firewall rules for VPN tunnel: ${vpnProfile.name}`);
    console.log(`[VPS Provisioner] TR-069 IPs: ${tr069Ips.join(", ") || "none"}`);
    console.log(`[VPS Provisioner] Management IPs: ${managementIps.join(", ") || "none"}`);

    const enableIpForward = await this.executeCommand("sudo", ["sysctl", "-w", "net.ipv4.ip_forward=1"]);
    if (!enableIpForward.success) {
      errors.push(`Failed to enable IP forwarding: ${enableIpForward.stderr}`);
    }

    const persistIpForward = await this.executeCommand("sudo", ["sh", "-c", "grep -q 'net.ipv4.ip_forward' /etc/sysctl.conf || echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.conf"]);
    if (!persistIpForward.success) {
      console.warn(`[VPS Provisioner] Warning: Could not persist IP forwarding: ${persistIpForward.stderr}`);
    }

    const cleanupResult = await this.cleanupFirewallRules(vpnProfile);
    if (!cleanupResult.success) {
      errors.push(...cleanupResult.errors);
    }

    const establishedRule = await this.executeCommand("sudo", [
      "iptables", "-A", "FORWARD",
      "-m", "state", "--state", "ESTABLISHED,RELATED",
      "-j", "ACCEPT",
      "-m", "comment", "--comment", `VPN-${sanitizedName}-established`
    ]);
    if (!establishedRule.success) {
      errors.push(`Failed to add established connections rule: ${establishedRule.stderr}`);
    }

    for (const ip of allIps) {
      const addr = ip.includes("/") ? ip : `${ip}/32`;

      const forwardIn = await this.executeCommand("sudo", [
        "iptables", "-A", "FORWARD",
        "-i", vpnInterface, "-d", addr,
        "-j", "ACCEPT",
        "-m", "comment", "--comment", `VPN-${sanitizedName}-fwd-in`
      ]);
      if (!forwardIn.success) {
        errors.push(`Failed to add forward rule for ${addr}: ${forwardIn.stderr}`);
      }

      const forwardOut = await this.executeCommand("sudo", [
        "iptables", "-A", "FORWARD",
        "-o", vpnInterface, "-s", addr,
        "-j", "ACCEPT",
        "-m", "comment", "--comment", `VPN-${sanitizedName}-fwd-out`
      ]);
      if (!forwardOut.success) {
        errors.push(`Failed to add forward rule for ${addr}: ${forwardOut.stderr}`);
      }

      const nat = await this.executeCommand("sudo", [
        "iptables", "-t", "nat", "-A", "POSTROUTING",
        "-s", vpnSubnet, "-d", addr, "-o", "eth0",
        "-j", "MASQUERADE",
        "-m", "comment", "--comment", `VPN-${sanitizedName}-nat`
      ]);
      if (!nat.success) {
        errors.push(`Failed to add NAT rule for ${addr}: ${nat.stderr}`);
      }
    }

    const masquerade = await this.executeCommand("sudo", [
      "iptables", "-t", "nat", "-A", "POSTROUTING",
      "-s", vpnSubnet, "-o", "eth0",
      "-j", "MASQUERADE",
      "-m", "comment", "--comment", `VPN-${sanitizedName}-masq`
    ]);
    if (!masquerade.success) {
      errors.push(`Failed to add masquerade rule: ${masquerade.stderr}`);
    }

    const openvpnUdp = await this.executeCommand("sudo", [
      "iptables", "-A", "INPUT",
      "-p", "udp", "--dport", "1194",
      "-j", "ACCEPT",
      "-m", "comment", "--comment", `VPN-${sanitizedName}-openvpn-udp`
    ]);
    if (!openvpnUdp.success) {
      errors.push(`Failed to add OpenVPN UDP rule: ${openvpnUdp.stderr}`);
    }

    const openvpnTcp = await this.executeCommand("sudo", [
      "iptables", "-A", "INPUT",
      "-p", "tcp", "--dport", "1194",
      "-j", "ACCEPT",
      "-m", "comment", "--comment", `VPN-${sanitizedName}-openvpn-tcp`
    ]);
    if (!openvpnTcp.success) {
      errors.push(`Failed to add OpenVPN TCP rule: ${openvpnTcp.stderr}`);
    }

    const vpnInput = await this.executeCommand("sudo", [
      "iptables", "-A", "INPUT",
      "-i", vpnInterface,
      "-j", "ACCEPT",
      "-m", "comment", "--comment", `VPN-${sanitizedName}-input`
    ]);
    if (!vpnInput.success) {
      errors.push(`Failed to add VPN input rule: ${vpnInput.stderr}`);
    }

    const saveIptables = await this.executeCommand("sudo", ["sh", "-c", "command -v netfilter-persistent && netfilter-persistent save || (command -v iptables-save && iptables-save > /etc/iptables/rules.v4) || true"]);
    if (!saveIptables.success) {
      console.warn(`[VPS Provisioner] Warning: Could not persist iptables rules: ${saveIptables.stderr}`);
    }

    console.log(`[VPS Provisioner] Firewall rules applied. Errors: ${errors.length}`);
    return { success: errors.length === 0, errors };
  }

  async cleanupFirewallRules(vpnProfile: VpnProfile): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const sanitizedName = vpnProfile.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    console.log(`[VPS Provisioner] Cleaning up firewall rules for: ${vpnProfile.name}`);

    const listFilter = await this.executeCommand("sudo", ["iptables", "-S"]);
    if (listFilter.success) {
      const lines = listFilter.stdout.split("\n");
      for (const line of lines) {
        if (line.includes(`VPN-${sanitizedName}`)) {
          const deleteRule = line.replace(/^-A/, "-D");
          await this.executeCommand("sudo", ["iptables", ...deleteRule.split(" ").filter(Boolean)]);
        }
      }
    }

    const listNat = await this.executeCommand("sudo", ["iptables", "-t", "nat", "-S"]);
    if (listNat.success) {
      const lines = listNat.stdout.split("\n");
      for (const line of lines) {
        if (line.includes(`VPN-${sanitizedName}`)) {
          const deleteRule = line.replace(/^-A/, "-D");
          await this.executeCommand("sudo", ["iptables", "-t", "nat", ...deleteRule.split(" ").filter(Boolean)]);
        }
      }
    }

    return { success: true, errors };
  }

  async configureOpenvpnServer(vpnProfile: VpnProfile, config: OpenVpnServerConfig = {}): Promise<{ success: boolean; errors: string[]; configPath?: string }> {
    const errors: string[] = [];
    const sanitizedName = vpnProfile.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    const port = config.port || 1194;
    const proto = config.proto || "udp";
    const dev = config.dev || "tun";
    const subnet = config.subnet || "10.8.0.0";
    const subnetMask = config.subnetMask || "255.255.255.0";

    console.log(`[VPS Provisioner] Configuring OpenVPN server for: ${vpnProfile.name}`);

    const tr069Ips = vpnProfile.tr069Ips || [];
    const managementIps = vpnProfile.managementIps || [];
    const allIps = [...tr069Ips, ...managementIps];

    const pushRoutes = allIps.map(ip => {
      const addr = ip.includes("/") ? ip.split("/")[0] : ip;
      const cidr = ip.includes("/") ? parseInt(ip.split("/")[1]) : 32;
      const mask = cidrToMask(cidr);
      return `push "route ${addr} ${mask}"`;
    }).join("\n");

    const serverConfig = `# OpenVPN Server Configuration
# Generated by OLT Management System
# VPN Tunnel: ${vpnProfile.name}
# Generated: ${new Date().toISOString()}

port ${port}
proto ${proto}
dev ${dev}

ca /etc/openvpn/server/ca.crt
cert /etc/openvpn/server/server.crt
key /etc/openvpn/server/server.key
dh /etc/openvpn/server/dh.pem

server ${subnet} ${subnetMask}
ifconfig-pool-persist /var/log/openvpn/ipp-${sanitizedName}.txt

# Push routes to clients for TR-069 and management networks
${pushRoutes || "# No routes configured"}

keepalive 10 120
cipher AES-256-GCM
auth SHA256

user nobody
group nogroup

persist-key
persist-tun

status /var/log/openvpn/openvpn-status-${sanitizedName}.log
log-append /var/log/openvpn/openvpn-${sanitizedName}.log
verb 3

# Client-to-client communication (disable for security)
;client-to-client

# Duplicate CN (allow same certificate to connect multiple times)
;duplicate-cn

# Maximum clients
max-clients 100
`;

    const configPath = join(this.openvpnConfigDir, `server-${sanitizedName}.conf`);
    const tempPath = `/tmp/openvpn-${sanitizedName}.conf`;

    try {
      writeFileSync(tempPath, serverConfig, { mode: 0o600 });
    } catch (error) {
      errors.push(`Failed to write temp config: ${error}`);
      return { success: false, errors };
    }

    const mkdirResult = await this.executeCommand("sudo", ["mkdir", "-p", this.openvpnConfigDir]);
    if (!mkdirResult.success) {
      errors.push(`Failed to create OpenVPN config directory: ${mkdirResult.stderr}`);
    }

    const copyResult = await this.executeCommand("sudo", ["cp", tempPath, configPath]);
    if (!copyResult.success) {
      errors.push(`Failed to copy OpenVPN config: ${copyResult.stderr}`);
      return { success: false, errors };
    }

    try {
      unlinkSync(tempPath);
    } catch {
    }

    const chmodResult = await this.executeCommand("sudo", ["chmod", "600", configPath]);
    if (!chmodResult.success) {
      console.warn(`[VPS Provisioner] Warning: Could not set permissions: ${chmodResult.stderr}`);
    }

    const logDirResult = await this.executeCommand("sudo", ["mkdir", "-p", "/var/log/openvpn"]);
    if (!logDirResult.success) {
      console.warn(`[VPS Provisioner] Warning: Could not create log directory: ${logDirResult.stderr}`);
    }

    console.log(`[VPS Provisioner] OpenVPN server config written to: ${configPath}`);
    return { success: errors.length === 0, errors, configPath };
  }

  async restartOpenvpnService(serviceName?: string): Promise<{ success: boolean; error?: string }> {
    const service = serviceName || "openvpn-server@server";
    
    console.log(`[VPS Provisioner] Restarting OpenVPN service: ${service}`);
    
    const result = await this.executeCommand("sudo", ["systemctl", "restart", service]);
    if (!result.success) {
      const fallback = await this.executeCommand("sudo", ["service", "openvpn", "restart"]);
      if (!fallback.success) {
        return { success: false, error: `Failed to restart OpenVPN: ${result.stderr || fallback.stderr}` };
      }
    }

    return { success: true };
  }

  async provisionVpnTunnel(vpnProfile: VpnProfile, options: {
    vpnInterface?: string;
    vpnSubnet?: string;
    configureOpenvpn?: boolean;
    restartOpenvpn?: boolean;
  } = {}): Promise<ProvisioningResult> {
    const result: ProvisioningResult = {
      status: "running",
      message: "Provisioning started",
      firewallApplied: false,
      openvpnConfigured: false,
      errors: [],
      timestamp: new Date(),
    };

    this.provisioningResults.set(vpnProfile.id, result);

    console.log(`[VPS Provisioner] Starting provisioning for VPN tunnel: ${vpnProfile.name}`);

    const capabilities = await this.getEnvironmentCapabilities();
    if (!capabilities.canProvision) {
      result.status = "failed";
      result.message = capabilities.reason || "Cannot provision in this environment";
      result.errors.push(result.message);
      this.provisioningResults.set(vpnProfile.id, result);
      return result;
    }

    const firewallResult = await this.applyFirewallRules(vpnProfile, {
      vpnInterface: options.vpnInterface,
      vpnSubnet: options.vpnSubnet,
    });
    result.firewallApplied = firewallResult.success;
    result.errors.push(...firewallResult.errors);

    if (options.configureOpenvpn !== false && capabilities.hasOpenvpn) {
      const openvpnResult = await this.configureOpenvpnServer(vpnProfile);
      result.openvpnConfigured = openvpnResult.success;
      result.errors.push(...openvpnResult.errors);

      if (options.restartOpenvpn && openvpnResult.success) {
        const restartResult = await this.restartOpenvpnService();
        if (!restartResult.success && restartResult.error) {
          result.errors.push(restartResult.error);
        }
      }
    }

    if (result.errors.length === 0) {
      result.status = "success";
      result.message = "VPN tunnel provisioned successfully";
    } else if (result.firewallApplied || result.openvpnConfigured) {
      result.status = "success";
      result.message = "VPN tunnel provisioned with warnings";
    } else {
      result.status = "failed";
      result.message = "VPN tunnel provisioning failed";
    }

    result.timestamp = new Date();
    this.provisioningResults.set(vpnProfile.id, result);

    console.log(`[VPS Provisioner] Provisioning complete: ${result.status} - ${result.message}`);
    return result;
  }

  async deprovisionVpnTunnel(vpnProfile: VpnProfile): Promise<ProvisioningResult> {
    const result: ProvisioningResult = {
      status: "running",
      message: "Deprovisioning started",
      firewallApplied: false,
      openvpnConfigured: false,
      errors: [],
      timestamp: new Date(),
    };

    console.log(`[VPS Provisioner] Deprovisioning VPN tunnel: ${vpnProfile.name}`);

    const cleanupResult = await this.cleanupFirewallRules(vpnProfile);
    if (!cleanupResult.success) {
      result.errors.push(...cleanupResult.errors);
    }

    const sanitizedName = vpnProfile.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const configPath = join(this.openvpnConfigDir, `server-${sanitizedName}.conf`);
    await this.executeCommand("sudo", ["rm", "-f", configPath]);

    if (result.errors.length === 0) {
      result.status = "success";
      result.message = "VPN tunnel deprovisioned successfully";
    } else {
      result.status = "failed";
      result.message = "VPN tunnel deprovisioning had errors";
    }

    result.timestamp = new Date();
    this.provisioningResults.delete(vpnProfile.id);

    return result;
  }

  getProvisioningStatus(profileId: string): ProvisioningResult | undefined {
    return this.provisioningResults.get(profileId);
  }
}

function cidrToMask(cidr: number): string {
  const mask = [];
  for (let i = 0; i < 4; i++) {
    const bits = Math.min(8, Math.max(0, cidr - i * 8));
    mask.push(256 - Math.pow(2, 8 - bits));
  }
  return mask.join(".");
}

export const vpsProvisioner = new VpsProvisioner();

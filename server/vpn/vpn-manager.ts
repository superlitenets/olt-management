import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { VpnProfile } from "@shared/schema";

export interface VpnConnectionStatus {
  profileId: string;
  status: "connected" | "connecting" | "disconnected" | "error";
  connectedAt?: Date;
  error?: string;
  pid?: number;
}

export interface VpnEnvironmentInfo {
  isReplitEnvironment: boolean;
  isOpenVpnAvailable: boolean;
  hasTunDevice: boolean;
  canEstablishVpn: boolean;
  reason?: string;
}

class VpnConnectionManager {
  private connections: Map<string, { process: ChildProcess; status: VpnConnectionStatus }> = new Map();
  private configDir: string;
  private environmentInfo: VpnEnvironmentInfo | null = null;

  constructor() {
    this.configDir = join(process.cwd(), ".vpn-configs");
    if (!existsSync(this.configDir)) {
      try {
        // Restrictive permissions (owner-only) for directory containing sensitive VPN configs
        mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
      } catch (e) {
        console.warn("[VPN Manager] Could not create config directory:", e);
      }
    }
  }

  async detectEnvironment(): Promise<VpnEnvironmentInfo> {
    if (this.environmentInfo) {
      return this.environmentInfo;
    }

    const isReplitEnvironment = !!(
      process.env.REPLIT_DEPLOYMENT_ID ||
      process.env.REPL_ID ||
      process.env.REPL_SLUG ||
      process.env.REPLIT_CLUSTER
    );

    const isOpenVpnAvailable = await this.checkOpenVpnAvailable();
    const hasTunDevice = await this.checkTunDevice();

    let canEstablishVpn = false;
    let reason: string | undefined;

    if (isReplitEnvironment) {
      reason = "VPN connections are not supported in Replit environment. Deploy with Docker for VPN support.";
    } else if (!isOpenVpnAvailable) {
      reason = "OpenVPN binary not found. Install openvpn package to enable VPN connections.";
    } else if (!hasTunDevice) {
      reason = "TUN/TAP device not available. Run with appropriate privileges or in Docker with --cap-add=NET_ADMIN --device=/dev/net/tun";
    } else {
      canEstablishVpn = true;
    }

    this.environmentInfo = {
      isReplitEnvironment,
      isOpenVpnAvailable,
      hasTunDevice,
      canEstablishVpn,
      reason,
    };

    console.log("[VPN Manager] Environment detected:", this.environmentInfo);
    return this.environmentInfo;
  }

  private async checkOpenVpnAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn("which", ["openvpn"]);
        proc.on("close", (code) => {
          resolve(code === 0);
        });
        proc.on("error", () => {
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  private async checkTunDevice(): Promise<boolean> {
    return existsSync("/dev/net/tun");
  }

  async connect(profile: VpnProfile): Promise<VpnConnectionStatus> {
    const env = await this.detectEnvironment();

    if (!env.canEstablishVpn) {
      return {
        profileId: profile.id,
        status: "error",
        error: env.reason || "VPN not available in this environment",
      };
    }

    // Check if already connected
    const existing = this.connections.get(profile.id);
    if (existing && existing.status.status === "connected") {
      return existing.status;
    }

    // Disconnect any existing attempt
    await this.disconnect(profile.id);

    const configPath = join(this.configDir, `${profile.id}.ovpn`);
    const authPath = join(this.configDir, `${profile.id}.auth`);

    try {
      // Write .ovpn config with restrictive permissions (may contain embedded certs/keys)
      writeFileSync(configPath, profile.ovpnConfig, { mode: 0o600 });

      // Build openvpn command args (foreground mode for proper lifecycle management)
      const args = ["--config", configPath, "--verb", "3"];

      // Handle authentication
      if (profile.username && profile.password) {
        writeFileSync(authPath, `${profile.username}\n${profile.password}\n`, { mode: 0o600 });
        args.push("--auth-user-pass", authPath);
      }

      const status: VpnConnectionStatus = {
        profileId: profile.id,
        status: "connecting",
      };

      // Run openvpn in foreground mode so we can track the process
      const proc = spawn("openvpn", args, {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      proc.stdout?.on("data", (data) => {
        const output = data.toString();
        console.log(`[VPN ${profile.name}] ${output}`);
        if (output.includes("Initialization Sequence Completed")) {
          status.status = "connected";
          status.connectedAt = new Date();
        }
      });

      proc.stderr?.on("data", (data) => {
        console.error(`[VPN ${profile.name}] Error: ${data.toString()}`);
      });

      proc.on("error", (error) => {
        status.status = "error";
        status.error = error.message;
        this.cleanup(profile.id);
      });

      proc.on("exit", (code) => {
        console.log(`[VPN ${profile.name}] Process exited with code ${code}`);
        if (status.status !== "error") {
          status.status = "disconnected";
        }
        // Only cleanup config files, keep the connection entry for status reporting
        this.cleanupConfigFiles(profile.id);
        this.connections.delete(profile.id);
      });

      status.pid = proc.pid;
      this.connections.set(profile.id, { process: proc, status });

      // Wait a bit for initial connection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return status;
    } catch (error) {
      this.cleanup(profile.id);
      return {
        profileId: profile.id,
        status: "error",
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  async disconnect(profileId: string): Promise<VpnConnectionStatus> {
    const connection = this.connections.get(profileId);

    if (!connection) {
      return {
        profileId,
        status: "disconnected",
      };
    }

    try {
      if (connection.process.pid) {
        process.kill(connection.process.pid, "SIGTERM");
      }
    } catch (e) {
      // Process may already be dead
    }

    this.cleanup(profileId);

    return {
      profileId,
      status: "disconnected",
    };
  }

  private cleanup(profileId: string) {
    const connection = this.connections.get(profileId);
    if (connection?.process?.pid) {
      try {
        process.kill(connection.process.pid, "SIGTERM");
      } catch (e) {
        // Process may already be dead
      }
    }
    this.connections.delete(profileId);
    this.cleanupConfigFiles(profileId);
  }

  private cleanupConfigFiles(profileId: string) {
    const configPath = join(this.configDir, `${profileId}.ovpn`);
    const authPath = join(this.configDir, `${profileId}.auth`);

    try {
      if (existsSync(configPath)) unlinkSync(configPath);
      if (existsSync(authPath)) unlinkSync(authPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  getStatus(profileId: string): VpnConnectionStatus {
    const connection = this.connections.get(profileId);
    if (!connection) {
      return {
        profileId,
        status: "disconnected",
      };
    }
    return connection.status;
  }

  getAllStatuses(): VpnConnectionStatus[] {
    return Array.from(this.connections.values()).map((c) => c.status);
  }

  async disconnectAll(): Promise<void> {
    const profileIds = Array.from(this.connections.keys());
    await Promise.all(profileIds.map((id) => this.disconnect(id)));
  }

  async testProfile(profile: VpnProfile): Promise<{ success: boolean; message: string }> {
    const env = await this.detectEnvironment();

    if (!env.canEstablishVpn) {
      return {
        success: false,
        message: `Cannot test VPN in this environment: ${env.reason}`,
      };
    }

    // Validate the .ovpn config has essential directives
    const config = profile.ovpnConfig.toLowerCase();
    const hasRemote = config.includes("remote ");
    const hasProto = config.includes("proto ");
    const hasDev = config.includes("dev ");

    if (!hasRemote) {
      return {
        success: false,
        message: "Invalid OpenVPN config: missing 'remote' directive",
      };
    }

    if (!hasDev) {
      return {
        success: false,
        message: "Invalid OpenVPN config: missing 'dev' directive (tun/tap)",
      };
    }

    // Check if authentication is configured
    const needsAuth =
      config.includes("auth-user-pass") && !profile.username && !profile.password;

    if (needsAuth) {
      return {
        success: false,
        message:
          "Config requires authentication but no username/password provided",
      };
    }

    return {
      success: true,
      message: "VPN profile configuration appears valid",
    };
  }
}

export const vpnManager = new VpnConnectionManager();

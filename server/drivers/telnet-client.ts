import Telnet from "telnet-client";

export interface TelnetConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  shellPrompt?: string | RegExp;
  loginPrompt?: string | RegExp;
  passwordPrompt?: string | RegExp;
  failedLoginMatch?: string | RegExp;
}

export interface TelnetResult {
  success: boolean;
  output: string;
  error?: string;
}

export class OltTelnetClient {
  private config: TelnetConfig;
  private connection: Telnet | null = null;

  constructor(config: TelnetConfig) {
    this.config = {
      timeout: 10000,
      shellPrompt: /[>#]\s*$/,
      loginPrompt: /[Uu]sername[:\s]*$/,
      passwordPrompt: /[Pp]assword[:\s]*$/,
      failedLoginMatch: /incorrect|invalid|failed|denied/i,
      ...config,
    };
  }

  async connect(): Promise<TelnetResult> {
    try {
      this.connection = new Telnet();

      const params = {
        host: this.config.host,
        port: this.config.port,
        timeout: this.config.timeout,
        shellPrompt: this.config.shellPrompt,
        loginPrompt: this.config.loginPrompt,
        passwordPrompt: this.config.passwordPrompt,
        failedLoginMatch: this.config.failedLoginMatch,
        negotiationMandatory: false,
        ors: "\r\n",
        irs: "\n",
        echoLines: 0,
        stripShellPrompt: true,
      };

      await this.connection.connect(params);

      console.log(`[Telnet] Connected to ${this.config.host}:${this.config.port}`);

      return {
        success: true,
        output: "Connected successfully",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Telnet] Connection failed to ${this.config.host}:${this.config.port}: ${errorMessage}`);
      return {
        success: false,
        output: "",
        error: errorMessage,
      };
    }
  }

  async login(): Promise<TelnetResult> {
    if (!this.connection) {
      return {
        success: false,
        output: "",
        error: "Not connected",
      };
    }

    try {
      const result = await this.connection.login({
        username: this.config.username,
        password: this.config.password,
        loginPrompt: this.config.loginPrompt,
        passwordPrompt: this.config.passwordPrompt,
        failedLoginMatch: this.config.failedLoginMatch,
      });

      console.log(`[Telnet] Logged in as ${this.config.username}`);

      return {
        success: true,
        output: result || "Login successful",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Telnet] Login failed: ${errorMessage}`);
      return {
        success: false,
        output: "",
        error: errorMessage,
      };
    }
  }

  async executeCommand(command: string, timeout?: number): Promise<TelnetResult> {
    if (!this.connection) {
      return {
        success: false,
        output: "",
        error: "Not connected",
      };
    }

    try {
      console.log(`[Telnet] Executing: ${command}`);
      
      const result = await this.connection.exec(command, {
        timeout: timeout || this.config.timeout,
        shellPrompt: this.config.shellPrompt,
      });

      return {
        success: true,
        output: result || "",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Telnet] Command failed: ${errorMessage}`);
      return {
        success: false,
        output: "",
        error: errorMessage,
      };
    }
  }

  async executeCommands(commands: string[], delayMs: number = 500): Promise<TelnetResult[]> {
    const results: TelnetResult[] = [];

    for (const command of commands) {
      const result = await this.executeCommand(command);
      results.push(result);

      if (!result.success) {
        console.error(`[Telnet] Stopping execution due to failed command: ${command}`);
        break;
      }

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log(`[Telnet] Disconnected from ${this.config.host}`);
      } catch (error) {
        console.error(`[Telnet] Error during disconnect:`, error);
      }
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}

export class HuaweiTelnetClient extends OltTelnetClient {
  constructor(host: string, port: number, username: string, password: string) {
    super({
      host,
      port,
      username,
      password,
      shellPrompt: /[<>#]\s*$/,
      loginPrompt: /[Uu]ser\s*name\s*[:>]|[Ll]ogin\s*[:>]|[Uu]sername\s*[:>]/,
      passwordPrompt: /[Pp]assword\s*[:>]/,
      failedLoginMatch: /incorrect|invalid|failed|denied|error/i,
      timeout: 15000,
    });
  }

  async enterConfigMode(): Promise<TelnetResult> {
    const enableResult = await this.executeCommand("enable");
    if (!enableResult.success) return enableResult;

    const configResult = await this.executeCommand("config");
    return configResult;
  }

  async exitConfigMode(): Promise<TelnetResult> {
    return this.executeCommand("quit");
  }

  async saveConfig(): Promise<TelnetResult> {
    return this.executeCommand("save", 30000);
  }
}

export class ZteTelnetClient extends OltTelnetClient {
  constructor(host: string, port: number, username: string, password: string) {
    super({
      host,
      port,
      username,
      password,
      shellPrompt: /[#>]\s*$/,
      loginPrompt: /[Uu]ser\s*name\s*[:>]|[Ll]ogin\s*[:>]|[Uu]sername\s*[:>]/,
      passwordPrompt: /[Pp]assword\s*[:>]/,
      failedLoginMatch: /incorrect|invalid|failed|denied|error/i,
      timeout: 15000,
    });
  }

  async enterConfigMode(): Promise<TelnetResult> {
    const enableResult = await this.executeCommand("enable");
    if (!enableResult.success) return enableResult;

    const configResult = await this.executeCommand("configure terminal");
    return configResult;
  }

  async exitConfigMode(): Promise<TelnetResult> {
    return this.executeCommand("exit");
  }

  async saveConfig(): Promise<TelnetResult> {
    return this.executeCommand("write", 30000);
  }
}

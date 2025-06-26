import { Connection } from "@solana/web3.js";
import { CpAmm } from "@meteora-ag/cp-amm-sdk";
import { ExtensionStorage } from "./lib/storage";

export class LancerBackend {
  private static instance: LancerBackend;
  private cpAmm: CpAmm | null = null;
  private connection: Connection | null = null;
  private rpcUrl: string | null = null;

  private constructor() {}

  static getInstance(): LancerBackend {
    if (!LancerBackend.instance) {
      LancerBackend.instance = new LancerBackend();
    }
    return LancerBackend.instance;
  }

  /**
   * Initialize the CP AMM SDK with the user's configured RPC
   * This should be called when the user visits v2.meteora.ag
   */
  async initialize(): Promise<boolean> {
    try {
      // Get the user's configured RPC URL from storage
      const settings = await ExtensionStorage.getSettings();

      if (!settings.rpcUrl || settings.rpcUrl.trim() === "") {
        console.log(
          "Lancer Backend: No RPC URL provided - bot won't work. Please configure an RPC URL in the extension settings."
        );
        return false;
      }

      // Validate RPC URL format
      try {
        new URL(settings.rpcUrl);
      } catch (urlError) {
        console.error(
          "Lancer Backend: Invalid RPC URL format:",
          settings.rpcUrl
        );
        return false;
      }

      // Don't use mainnet RPC - this should be a custom RPC
      if (settings.rpcUrl.includes("api.mainnet-beta.solana.com")) {
        console.warn(
          "Lancer Backend: Mainnet RPC detected. Please use a custom RPC endpoint for better performance."
        );
        return false;
      }

      this.rpcUrl = settings.rpcUrl;

      // Create connection with the user's RPC
      this.connection = new Connection(this.rpcUrl, {
        commitment: "confirmed",
        wsEndpoint: this.rpcUrl
          .replace("https://", "wss://")
          .replace("http://", "ws://"),
      });

      // Test the connection
      await this.testConnection();

      // Initialize CP AMM SDK
      this.cpAmm = new CpAmm(this.connection);

      console.log(
        "Lancer Backend: CP AMM SDK initialized successfully with RPC:",
        this.rpcUrl
      );
      return true;
    } catch (error) {
      console.error("Lancer Backend: Failed to initialize CP AMM SDK:", error);
      this.cpAmm = null;
      this.connection = null;
      this.rpcUrl = null;
      return false;
    }
  }

  /**
   * Test the RPC connection to ensure it's working
   */
  private async testConnection(): Promise<void> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
      // Test with a simple getSlot call
      const slot = await this.connection.getSlot();
      console.log(
        "Lancer Backend: RPC connection test successful. Current slot:",
        slot
      );
    } catch (error) {
      throw new Error(`RPC connection test failed: ${error}`);
    }
  }

  /**
   * Get the initialized CP AMM instance
   */
  getCpAmm(): CpAmm | null {
    return this.cpAmm;
  }

  /**
   * Get the connection instance
   */
  getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Get the current RPC URL
   */
  getRpcUrl(): string | null {
    return this.rpcUrl;
  }

  /**
   * Check if the backend is properly initialized
   */
  isInitialized(): boolean {
    return this.cpAmm !== null && this.connection !== null;
  }

  /**
   * Reinitialize the backend when RPC settings change
   */
  async reinitialize(): Promise<boolean> {
    // Clean up existing instances
    this.cpAmm = null;
    this.connection = null;
    this.rpcUrl = null;

    // Initialize again
    return await this.initialize();
  }

  /**
   * Get health status of the backend
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    rpcUrl: string | null;
    connectionHealth: "healthy" | "unhealthy" | "unknown";
    lastSlot?: number;
  }> {
    const status: {
      initialized: boolean;
      rpcUrl: string | null;
      connectionHealth: "healthy" | "unhealthy" | "unknown";
      lastSlot?: number;
    } = {
      initialized: this.isInitialized(),
      rpcUrl: this.rpcUrl,
      connectionHealth: "unknown",
      lastSlot: undefined,
    };

    if (this.connection) {
      try {
        const slot = await this.connection.getSlot();
        status.connectionHealth = "healthy";
        status.lastSlot = slot;
      } catch (error) {
        console.error("Lancer Backend: Health check failed:", error);
        status.connectionHealth = "unhealthy";
      }
    }

    return status;
  }
}

// Initialize the backend when the module is loaded
// This will be called when the content script runs on v2.meteora.ag
export const lancerBackend = LancerBackend.getInstance();

// Auto-initialize when visiting meteora
if (
  typeof window !== "undefined" &&
  window.location.hostname.includes("meteora.ag")
) {
  lancerBackend.initialize().then((success) => {
    if (success) {
      console.log("Lancer Backend: Auto-initialization successful");
    } else {
      console.log(
        "Lancer Backend: Auto-initialization failed - check RPC configuration"
      );
    }
  });
}

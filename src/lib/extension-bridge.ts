import { ExtensionStorage, type ExtensionSettings } from "./storage";

/**
 * Bridge utility for accessing extension settings from content scripts
 * This provides a simple interface for content scripts to retrieve settings
 */
export class ExtensionBridge {
  /**
   * Get the current extension settings
   * This can be called from content scripts to access user configuration
   */
  static async getSettings(): Promise<ExtensionSettings> {
    return await ExtensionStorage.getSettings();
  }

  /**
   * Check if RPC URL is configured
   */
  static async hasRpcUrl(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.rpcUrl.trim() !== "";
  }

  /**
   * Check if SW API key is configured
   */
  static async hasSwApiKey(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.swApiKey.trim() !== "";
  }

  /**
   * Get just the RPC URL
   */
  static async getRpcUrl(): Promise<string | null> {
    const settings = await this.getSettings();
    return settings.rpcUrl.trim() || null;
  }

  /**
   * Get just the SW API key
   */
  static async getSwApiKey(): Promise<string | null> {
    const settings = await this.getSettings();
    return settings.swApiKey.trim() || null;
  }
}

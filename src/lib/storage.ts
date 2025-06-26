export interface ExtensionSettings {
  rpcUrl: string;
  swApiKey: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  rpcUrl: "",
  swApiKey: "",
};

export class ExtensionStorage {
  private static readonly STORAGE_KEY = "lancer_settings";

  static async getSettings(): Promise<ExtensionSettings> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get(this.STORAGE_KEY);
        return { ...DEFAULT_SETTINGS, ...result[this.STORAGE_KEY] };
      }

      // Fallback to localStorage for development
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        : DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Failed to get settings:", error);
      return DEFAULT_SETTINGS;
    }
  }

  static async saveSettings(
    settings: Partial<ExtensionSettings>
  ): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };

      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: updatedSettings });
      } else {
        // Fallback to localStorage for development
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSettings));
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    }
  }

  static async clearSettings(): Promise<void> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.remove(this.STORAGE_KEY);
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to clear settings:", error);
      throw error;
    }
  }
}

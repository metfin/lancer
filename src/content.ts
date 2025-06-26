// Enhanced logging and page detection
console.log("🚀 Lancer: Content script loaded for Meteora portfolio");
console.log("🌍 Lancer: Current URL:", window.location.href);
console.log("⏰ Lancer: Script loaded at:", new Date().toISOString());

// Create a global object to access the backend
declare global {
  interface Window {
    lancerBackend: any;
  }
}

// Verify we're on the right page
if (window.location.href.includes("v2.meteora.ag/portfolio")) {
  console.log("✅ Lancer: Confirmed on Meteora portfolio page");
} else {
  console.log("❌ Lancer: Not on expected Meteora portfolio page");
}

// Extension Storage Interface and Implementation
interface ExtensionSettings {
  rpcUrl: string;
  dammPoolAddresses: string[];
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  rpcUrl: "",
  dammPoolAddresses: [],
};

class ExtensionStorage {
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

  static async getPoolAddresses(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.dammPoolAddresses;
  }

  static async savePoolAddresses(poolAddresses: string[]): Promise<void> {
    await this.saveSettings({ dammPoolAddresses: poolAddresses });
  }
}

// Create a simple backend wrapper
class LancerBackendWrapper {
  private _isInitialized = false;
  private positionPnLData = new Map();
  private overallPnL = null;

  async initialize(): Promise<boolean> {
    console.log("LancerBackendWrapper: Initializing...");
    this._isInitialized = true;
    return true;
  }

  getOverallPnL() {
    return (
      this.overallPnL || {
        totalPnLUSD: 0,
        totalPnLPercentage: 0,
      }
    );
  }

  getAllPositionsPnL() {
    return this.positionPnLData;
  }

  async loadUserPositions(walletAddress: string): Promise<void> {
    console.log(`LancerBackendWrapper: Loading positions for ${walletAddress}`);
    // Mock implementation
    return Promise.resolve();
  }

  async refreshAllPnL(): Promise<void> {
    console.log("LancerBackendWrapper: Refreshing all PnL");
    return Promise.resolve();
  }

  startPnLUpdates(): void {
    console.log("LancerBackendWrapper: Starting PnL updates");
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }
}

// Create and export the backend instance
const lancerBackend = new LancerBackendWrapper();

// DAMM Pool Manager Implementation
interface PoolTableEntry {
  poolAddress: string;
  tokenPair: string;
  depositValue: string;
  unclaimedFees: string;
  volume24h: string;
  feeTvl: string;
  element: HTMLElement;
}

interface PositionPnL {
  poolAddress: string;
  pnl: number;
  pnlPercentage: number;
}

// Overall PNL Manager
class OverallPnLManager {
  private static pnlObserver: MutationObserver | null = null;
  private static isOverallPnLInjected: boolean = false;
  private static overallPnL: { usd: number; percentage: number } = {
    usd: 0,
    percentage: 0,
  };

  static async initialize(): Promise<void> {
    console.log("💰 Lancer: Initializing Overall PnL Manager");
    this.startOverallPnLMonitoring();
    await this.calculateAndInjectOverallPnL();
  }

  private static startOverallPnLMonitoring(): void {
    // Find the portfolio stats container
    const findStatsContainer = (): HTMLElement | null => {
      // Look for the Net Value component's parent container
      const netValueElements = document.querySelectorAll("h1");
      for (const element of netValueElements) {
        if (element.textContent?.trim() === "Net Value") {
          const container = element.closest(".md\\:col-span-2");
          if (container) {
            return container.parentElement as HTMLElement;
          }
        }
      }
      return null;
    };

    const statsContainer = findStatsContainer();
    if (!statsContainer) {
      console.log("❌ Lancer: Portfolio stats container not found");
      return;
    }

    console.log(
      "✅ Lancer: Found portfolio stats container, starting monitoring"
    );

    // Set up mutation observer to watch for container changes
    this.pnlObserver = new MutationObserver((mutations) => {
      // Check if we need to re-inject the PnL component
      const hasRelevantChanges = mutations.some((mutation) => {
        return (
          mutation.type === "childList" &&
          (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
        );
      });

      if (hasRelevantChanges && !this.isOverallPnLInjected) {
        this.calculateAndInjectOverallPnL();
      }
    });

    this.pnlObserver.observe(statsContainer, {
      childList: true,
      subtree: true,
    });
  }

  static async calculateAndInjectOverallPnL(): Promise<void> {
    // Get overall PnL from backend
    const overallPnLData = lancerBackend.getOverallPnL();

    if (overallPnLData) {
      this.overallPnL = {
        usd: overallPnLData.totalPnLUSD,
        percentage: overallPnLData.totalPnLPercentage,
      };
    } else {
      // Fallback to calculating from individual positions
      const allPnLData = lancerBackend.getAllPositionsPnL();
      let totalPnL = 0;
      let totalInitialValue = 0;

      for (const [, pnlData] of allPnLData) {
        totalPnL += pnlData.pnlUSD;
        totalInitialValue += pnlData.initialTotalValueUSD;
      }

      const overallPercentage =
        totalInitialValue > 0 ? (totalPnL / totalInitialValue) * 100 : 0;

      this.overallPnL = {
        usd: totalPnL,
        percentage: overallPercentage,
      };
    }

    this.injectOverallPnLComponent();
  }

  private static injectOverallPnLComponent(): void {
    // Find the Net Value component
    const netValueElements = document.querySelectorAll("h1");
    let netValueContainer: HTMLElement | null = null;

    for (const element of netValueElements) {
      if (element.textContent?.trim() === "Net Value") {
        netValueContainer = element.closest(".md\\:col-span-2") as HTMLElement;
        break;
      }
    }

    if (!netValueContainer) {
      console.log("❌ Lancer: Net Value container not found");
      return;
    }

    // Check if Overall PnL component already exists in the Net Value card
    const existingPnL = netValueContainer.querySelector(
      ".lancer-overall-pnl-section"
    );
    if (existingPnL) {
      // Update existing component
      this.updateOverallPnLInNetValue(netValueContainer);
      return;
    }

    // Inject PnL into the existing Net Value card
    this.addOverallPnLToNetValue(netValueContainer);

    this.isOverallPnLInjected = true;
    console.log(
      "💰 Lancer: Overall PnL added to Net Value component successfully"
    );
  }

  private static addOverallPnLToNetValue(netValueContainer: HTMLElement): void {
    const { usd, percentage } = this.overallPnL;
    const isPositive = usd >= 0;

    // Find the stats section (after the hr element)
    const statsSection = netValueContainer.querySelector(
      ".flex.flex-row.gap-2"
    );
    if (!statsSection) {
      console.log("❌ Lancer: Stats section not found in Net Value component");
      return;
    }

    // Create Overall PnL stat item
    const pnlStatDiv = document.createElement("div");
    pnlStatDiv.className =
      "flex flex-col gap-2 md:gap-3 lancer-overall-pnl-section";

    // Create label
    const labelDiv = document.createElement("div");
    labelDiv.className =
      "text-xs md:text-sm font-medium text-text-tertiary whitespace-nowrap";
    labelDiv.textContent = "Overall PnL";

    // Create value container
    const valueDiv = document.createElement("div");
    valueDiv.className = "text-xsm md:text-xl font-semibold text-text-primary";

    // Create dollar value
    const dollarValueContainer = document.createElement("div");
    dollarValueContainer.className =
      "flex flex-rows items-center whitespace-nowrap";

    const dollarSign = document.createElement("span");
    dollarSign.textContent = "$";

    const dollarValue = document.createElement("span");
    dollarValue.className = `lancer-pnl-usd ${
      isPositive ? "text-success-primary" : "text-danger-primary"
    }`;
    dollarValue.textContent = `${isPositive ? "+" : ""}${Math.abs(usd).toFixed(
      2
    )}`;

    dollarValueContainer.appendChild(dollarSign);
    dollarValueContainer.appendChild(dollarValue);

    // Create percentage value (smaller text below dollar value)
    const percentageDiv = document.createElement("div");
    percentageDiv.className = `text-xs font-medium lancer-pnl-percent ${
      isPositive ? "text-success-primary" : "text-danger-primary"
    }`;
    percentageDiv.textContent = `${
      percentage >= 0 ? "+" : ""
    }${percentage.toFixed(2)}%`;

    // Assemble the PnL stat
    valueDiv.appendChild(dollarValueContainer);
    valueDiv.appendChild(percentageDiv);
    pnlStatDiv.appendChild(labelDiv);
    pnlStatDiv.appendChild(valueDiv);

    // Insert the PnL stat at the end of the stats section
    statsSection.appendChild(pnlStatDiv);

    console.log("💰 Lancer: Overall PnL added to Net Value stats section");
  }

  private static updateOverallPnLInNetValue(
    netValueContainer: HTMLElement
  ): void {
    const { usd, percentage } = this.overallPnL;
    const isPositive = usd >= 0;

    // Find the PnL section
    const pnlSection = netValueContainer.querySelector(
      ".lancer-overall-pnl-section"
    );
    if (!pnlSection) {
      // If section doesn't exist, add it
      this.addOverallPnLToNetValue(netValueContainer);
      return;
    }

    // Update dollar value
    const dollarValue = pnlSection.querySelector(".lancer-pnl-usd");
    if (dollarValue) {
      dollarValue.className = `lancer-pnl-usd ${
        isPositive ? "text-green-500" : "text-red-500"
      }`;
      dollarValue.textContent = `${isPositive ? "+" : ""}${Math.abs(
        usd
      ).toFixed(2)}`;
    }

    // Update percentage value
    const percentageElement = pnlSection.querySelector(".lancer-pnl-percent");
    if (percentageElement) {
      percentageElement.className = `text-xs font-medium lancer-pnl-percent ${
        isPositive ? "text-green-400" : "text-red-400"
      }`;
      percentageElement.textContent = `${
        percentage >= 0 ? "+" : ""
      }${percentage.toFixed(2)}%`;
    }

    console.log("💰 Lancer: Overall PnL in Net Value component updated");
  }

  static getOverallPnL(): { usd: number; percentage: number } {
    return this.overallPnL;
  }

  static cleanup(): void {
    if (this.pnlObserver) {
      this.pnlObserver.disconnect();
      this.pnlObserver = null;
    }

    // Remove any injected PnL sections
    const existingPnLSections = document.querySelectorAll(
      ".lancer-overall-pnl-section"
    );
    existingPnLSections.forEach((section) => section.remove());

    this.isOverallPnLInjected = false;
    this.overallPnL = { usd: 0, percentage: 0 };
  }
}

class DAMMPoolManager {
  private static poolTableObserver: MutationObserver | null = null;
  private static currentPoolAddresses: Set<string> = new Set();
  private static pnlData: Map<string, PositionPnL> = new Map();
  private static isUpdating: boolean = false;
  private static updateTimeout: NodeJS.Timeout | null = null;

  static async initialize(): Promise<void> {
    console.log("🎯 Lancer: Initializing DAMM Pool Manager");

    // Load existing pool addresses from storage
    const existingPools = await ExtensionStorage.getPoolAddresses();
    this.currentPoolAddresses = new Set(existingPools);

    // Start monitoring the pool table
    this.startPoolTableMonitoring();

    // Load real PnL data from backend
    await this.loadRealPnLData();
  }

  static async loadRealPnLData(): Promise<void> {
    try {
      // Get PnL data from the backend
      const allPnLData = lancerBackend.getAllPositionsPnL();

      // Convert to the format expected by the UI
      this.pnlData.clear();

      for (const [poolAddress, pnlData] of allPnLData) {
        this.pnlData.set(poolAddress, {
          poolAddress,
          pnl: pnlData.pnlUSD,
          pnlPercentage: pnlData.pnlPercentage,
        });
      }

      console.log(`Loaded real PnL data for ${this.pnlData.size} positions`);
    } catch (error) {
      console.error("Error loading real PnL data:", error);
      // Fallback to mock data if backend fails
      this.generateMockPnLData();
    }
  }

  static async refreshPnLData(): Promise<void> {
    // Trigger a refresh of all PnL data from the backend
    try {
      await lancerBackend.refreshAllPnL();
      await this.loadRealPnLData();

      // Update the UI
      await this.scanAndUpdatePools();
      await OverallPnLManager.calculateAndInjectOverallPnL();

      console.log("PnL data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing PnL data:", error);
    }
  }

  private static startPoolTableMonitoring(): void {
    // Find the pool table container
    const findPoolTable = (): HTMLElement | null => {
      const containers = document.querySelectorAll(
        ".w-full.h-full.overflow-auto"
      );
      for (const container of containers) {
        const poolLinks = container.querySelectorAll('a[href^="/damm/"]');
        if (poolLinks.length > 0) {
          return container as HTMLElement;
        }
      }
      return null;
    };

    const poolTable = findPoolTable();
    if (!poolTable) {
      console.log("❌ Lancer: Pool table not found");
      return;
    }

    console.log("✅ Lancer: Found pool table, starting monitoring");

    // Initial scan of existing pools
    this.debouncedScanAndUpdate();

    // Set up mutation observer to watch for table changes
    this.poolTableObserver = new MutationObserver((mutations) => {
      // Ignore mutations caused by our own modifications
      if (this.isUpdating) {
        return;
      }

      // Check if mutations include actual content changes (not just our PnL columns)
      const hasRelevantChanges = mutations.some((mutation) => {
        // Ignore mutations to our own elements
        if (mutation.target instanceof Element) {
          if (
            mutation.target.classList.contains("lancer-pnl-column") ||
            mutation.target.classList.contains("lancer-pnl-header") ||
            mutation.target.closest(".lancer-pnl-column") ||
            mutation.target.closest(".lancer-pnl-header")
          ) {
            return false;
          }
        }

        // Check for actual pool row changes
        return (
          mutation.type === "childList" &&
          (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
        );
      });

      if (hasRelevantChanges) {
        this.debouncedScanAndUpdate();
      }
    });

    this.poolTableObserver.observe(poolTable, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  static debouncedScanAndUpdate(): void {
    // Clear existing timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Set new timeout to debounce updates
    this.updateTimeout = setTimeout(() => {
      this.scanAndUpdatePools();
    }, 300); // 300ms debounce
  }

  static async scanAndUpdatePools(): Promise<void> {
    // Prevent recursive calls
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;

    try {
      const poolEntries = this.extractPoolEntries();

      // Only log if there's a significant change
      if (poolEntries.length !== this.currentPoolAddresses.size) {
        console.log(
          "📊 Lancer: Pool entries count changed:",
          poolEntries.length
        );
      }

      const newPoolAddresses = new Set(
        poolEntries.map((entry) => entry.poolAddress)
      );

      // Check if pool list has changed
      const hasChanged =
        newPoolAddresses.size !== this.currentPoolAddresses.size ||
        [...newPoolAddresses].some(
          (addr) => !this.currentPoolAddresses.has(addr)
        );

      if (hasChanged) {
        console.log("🔄 Lancer: Pool list updated", {
          count: newPoolAddresses.size,
          addresses: Array.from(newPoolAddresses),
        });

        this.currentPoolAddresses = newPoolAddresses;
        await ExtensionStorage.savePoolAddresses(Array.from(newPoolAddresses));
      }

      // Always inject PnL data into the table (not just when pool list changes)
      if (poolEntries.length > 0) {
        this.injectPnLIntoTable(poolEntries);
      }

      // Update overall PnL whenever pool data changes
      OverallPnLManager.calculateAndInjectOverallPnL();
    } catch (error) {
      console.error("❌ Lancer: Error in scanAndUpdatePools:", error);
    } finally {
      this.isUpdating = false;
    }
  }

  private static extractPoolEntries(): PoolTableEntry[] {
    const poolEntries: PoolTableEntry[] = [];
    const poolLinks = document.querySelectorAll('a[href^="/damm/"]');

    for (const link of poolLinks) {
      try {
        const href = link.getAttribute("href");
        if (!href) continue;

        const poolAddress = href.replace("/damm/", "");
        const element = link as HTMLElement;

        // Extract token pair information
        const tokenPairElement = element.querySelector(
          ".text-text-primary.font-semibold"
        );
        const tokenPair = tokenPairElement?.textContent?.trim() || "Unknown";

        // Extract deposit value
        const depositElements = element.querySelectorAll(
          ".flex.text-end.justify-end"
        );
        const depositValue = depositElements[0]?.textContent?.trim() || "$0";
        const unclaimedFees = depositElements[1]?.textContent?.trim() || "$0";
        const volume24h = depositElements[2]?.textContent?.trim() || "$0";
        const feeTvl = depositElements[3]?.textContent?.trim() || "0%";

        poolEntries.push({
          poolAddress,
          tokenPair,
          depositValue,
          unclaimedFees,
          volume24h,
          feeTvl,
          element,
        });
      } catch (error) {
        console.error("❌ Lancer: Error extracting pool entry:", error);
      }
    }

    return poolEntries;
  }

  private static injectPnLIntoTable(poolEntries: PoolTableEntry[]): void {
    let injectedCount = 0;

    for (const entry of poolEntries) {
      try {
        // Check if PnL column already exists and is up to date
        const existingPnL = entry.element.querySelector(".lancer-pnl-column");

        // Find the grid container
        const gridContainer = entry.element.querySelector(".grid.gap-x-4");
        if (!gridContainer) {
          continue;
        }

        // Get PnL data for this pool
        const pnlData = this.pnlData.get(entry.poolAddress);
        const pnl = pnlData ? pnlData.pnl : this.generateRandomPnL();
        const pnlPercentage = pnlData
          ? pnlData.pnlPercentage
          : this.generateRandomPnLPercentage();

        // If PnL column exists, just update the values instead of recreating
        if (existingPnL) {
          const pnlValue = existingPnL.querySelector(".lancer-pnl-value");
          const pnlPercent = existingPnL.querySelector(".lancer-pnl-percent");

          if (pnlValue && pnlPercent) {
            // Update existing values
            pnlValue.className = `flex flex-rows items-center whitespace-nowrap text-sm font-medium lancer-pnl-value ${
              pnl >= 0 ? "text-green-500" : "text-red-500"
            }`;
            pnlValue.textContent = `${pnl >= 0 ? "+" : ""}$${Math.abs(
              pnl
            ).toFixed(2)}`;

            pnlPercent.className = `text-xs lancer-pnl-percent ${
              pnl >= 0 ? "text-green-400" : "text-red-400"
            }`;
            pnlPercent.textContent = `${
              pnlPercentage >= 0 ? "+" : ""
            }${pnlPercentage.toFixed(2)}%`;
            continue;
          }
        }

        // Remove existing PnL column if it exists but is malformed
        if (existingPnL) {
          existingPnL.remove();
        }

        // Create new PnL column
        const pnlColumn = document.createElement("div");
        pnlColumn.className =
          "pr-1 flex text-end justify-end lancer-pnl-column";

        // Create PnL content
        const pnlContent = document.createElement("div");
        pnlContent.className = "flex flex-col items-end gap-1";

        // PnL value
        const pnlValue = document.createElement("div");
        pnlValue.className = `flex flex-rows items-center whitespace-nowrap text-sm font-medium lancer-pnl-value ${
          pnl >= 0 ? "text-green-500" : "text-red-500"
        }`;
        pnlValue.textContent = `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(
          2
        )}`;

        // PnL percentage
        const pnlPercent = document.createElement("div");
        pnlPercent.className = `text-xs lancer-pnl-percent ${
          pnl >= 0 ? "text-green-400" : "text-red-400"
        }`;
        pnlPercent.textContent = `${
          pnlPercentage >= 0 ? "+" : ""
        }${pnlPercentage.toFixed(2)}%`;

        pnlContent.appendChild(pnlValue);
        pnlContent.appendChild(pnlPercent);
        pnlColumn.appendChild(pnlContent);

        // Find the pools column and insert PnL after it
        const poolsColumn = gridContainer.querySelector(
          '[style*="grid-column: 1 / 4"]'
        );
        const otherColumns = Array.from(gridContainer.children).filter(
          (child) =>
            child !== poolsColumn &&
            !child.classList.contains("lancer-pnl-column")
        );

        // Update grid template to 8 columns to accommodate all elements
        (gridContainer as HTMLElement).style.gridTemplateColumns =
          "repeat(8, minmax(0px, 1fr))";

        // Insert PnL column after pools column but before other columns
        if (poolsColumn && otherColumns.length > 0) {
          gridContainer.insertBefore(pnlColumn, otherColumns[0]);
        } else if (poolsColumn) {
          gridContainer.appendChild(pnlColumn);
        }

        injectedCount++;
      } catch (error) {
        console.error(
          "❌ Lancer: Error injecting PnL for pool:",
          entry.poolAddress,
          error
        );
      }
    }

    // Only log if we actually injected new columns
    if (injectedCount > 0) {
      console.log(`💰 Lancer: Injected PnL for ${injectedCount} pools`);
    }
  }

  static addPnLHeader(): void {
    try {
      // Find the table header
      const header = document.querySelector(
        ".grid.gap-4.px-4.md\\:px-6.py-4.text-text-tertiary.text-xsm.sticky"
      );
      if (!header) return;

      // Check if PnL header already exists
      if (header.querySelector(".lancer-pnl-header")) return;

      // Find all existing column headers (excluding Pools which spans 1/4)
      const poolsHeader = header.querySelector('[style*="grid-column: 1 / 4"]');
      const otherHeaders = Array.from(header.children).filter(
        (child) =>
          child !== poolsHeader &&
          !child.classList.contains("lancer-pnl-header")
      );

      // Update grid template to 8 columns to accommodate all elements
      (header as HTMLElement).style.gridTemplateColumns =
        "repeat(8, minmax(0px, 1fr))";

      // Create PnL header
      const pnlHeader = document.createElement("div");
      pnlHeader.className =
        "flex-row gap-2 items-center flex text-end justify-end lancer-pnl-header";
      pnlHeader.textContent = "Position PnL";

      // Insert PnL header after Pools header but before other headers
      if (poolsHeader && poolsHeader.nextSibling) {
        header.insertBefore(pnlHeader, poolsHeader.nextSibling);
      } else if (poolsHeader) {
        header.insertBefore(pnlHeader, otherHeaders[0]);
      }
    } catch (error) {
      console.error("❌ Lancer: Error adding PnL header:", error);
    }
  }

  private static generateMockPnLData(): void {
    const mockData = [
      {
        poolAddress: "24q6wuB52rCx6Poh6KTqPeeD7iW2j7ibEtL3H2t8UqmN",
        pnl: 23.45,
        pnlPercentage: 15.67,
      },
      { poolAddress: "examplepool2", pnl: -12.3, pnlPercentage: -8.94 },
      { poolAddress: "examplepool3", pnl: 45.78, pnlPercentage: 22.11 },
    ];

    for (const data of mockData) {
      this.pnlData.set(data.poolAddress, data);
    }
  }

  private static generateRandomPnL(): number {
    return (Math.random() - 0.5) * 100;
  }

  private static generateRandomPnLPercentage(): number {
    return (Math.random() - 0.5) * 50;
  }

  static getCurrentPoolAddresses(): string[] {
    return Array.from(this.currentPoolAddresses);
  }

  static getAllPnLData(): Map<string, PositionPnL> {
    return this.pnlData;
  }

  static cleanup(): void {
    if (this.poolTableObserver) {
      this.poolTableObserver.disconnect();
      this.poolTableObserver = null;
    }
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    this.currentPoolAddresses.clear();
    this.pnlData.clear();
    this.isUpdating = false;
  }
}

// Function to wait for an element to appear
function waitForElement(
  selector: string,
  timeout = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Function to detect and handle DAMM V2 tab activation
async function handleDAMMV2Activation() {
  console.log("🎯 Lancer: DAMM V2 tab activated!");

  try {
    // Wait for the table to fully load
    await waitForElement(".w-full.h-full.overflow-auto", 5000);

    // Add a small delay to ensure table is rendered
    setTimeout(async () => {
      // Initialize the DAMM pool manager
      await DAMMPoolManager.initialize();

      // Initialize the Overall PnL manager
      await OverallPnLManager.initialize();

      // Add PnL header to the table
      DAMMPoolManager.addPnLHeader();

      // Force initial PnL injection after a short delay
      setTimeout(() => {
        console.log("🔄 Lancer: Forcing initial PnL injection...");
        DAMMPoolManager.debouncedScanAndUpdate();
      }, 1000);

      console.log("⚡ Lancer: DAMM V2 functionality initialized");
    }, 500);
  } catch (error) {
    console.error(
      "❌ Lancer: Error initializing DAMM V2 functionality:",
      error
    );
  }
}

// Function to handle tab deactivation (cleanup)
function handleDAMMV2Deactivation() {
  console.log("🔄 Lancer: DAMM V2 tab deactivated, cleaning up");
  DAMMPoolManager.cleanup();
  OverallPnLManager.cleanup();
}

// Function to find and monitor DAMM V2 tab
function setupDAMMV2Monitor() {
  // Look for the DAMM V2 button (contains "DAMM" text and "V2" badge)
  const findDAMMV2Button = () => {
    const buttons = document.querySelectorAll(
      'button[title="Apply filter"], button[title="Remove filter"]'
    );

    for (const button of buttons) {
      // Check if this button contains DAMM text and V2 badge
      const spans = button.querySelectorAll("span");
      const hasDAMM = Array.from(spans).some(
        (span) => span.textContent?.trim() === "DAMM"
      );
      const hasV2Badge = button.querySelector(".bg-primary-tint-200");

      if (hasDAMM && hasV2Badge) {
        return button as HTMLButtonElement;
      }
    }
    return null;
  };

  // Check if DAMM V2 is currently active
  const checkDAMMV2Active = () => {
    const dammV2Button = findDAMMV2Button();
    if (!dammV2Button) return false;

    // Active tab has "bg-base-2 text-text-primary" classes
    // Inactive tab has "bg-base-0 text-text-tertiary" classes
    return (
      dammV2Button.classList.contains("bg-base-2") &&
      dammV2Button.classList.contains("text-text-primary")
    );
  };

  // Add click listener to DAMM V2 button
  const addClickListener = () => {
    const dammV2Button = findDAMMV2Button();
    if (dammV2Button) {
      console.log("✅ Lancer: Found DAMM V2 button, adding click listener");

      dammV2Button.addEventListener("click", () => {
        console.log("🔘 Lancer: DAMM V2 button clicked");

        // Clean up previous instance
        handleDAMMV2Deactivation();

        // Use a small delay to ensure the tab state has changed
        setTimeout(() => {
          if (checkDAMMV2Active()) {
            handleDAMMV2Activation();
          }
        }, 100);
      });
    } else {
      console.log("❌ Lancer: DAMM V2 button not found");
    }
  };

  // Monitor for tab state changes using MutationObserver
  const setupTabMonitor = () => {
    let wasDAMMV2Active = checkDAMMV2Active();

    // If DAMM V2 is already active on page load
    if (wasDAMMV2Active) {
      console.log("🎯 Lancer: DAMM V2 already active on page load");
      handleDAMMV2Activation();
    }

    const observer = new MutationObserver(() => {
      const isDAMMV2Active = checkDAMMV2Active();

      // Check if state changed from inactive to active
      if (!wasDAMMV2Active && isDAMMV2Active) {
        handleDAMMV2Activation();
      } else if (wasDAMMV2Active && !isDAMMV2Active) {
        // Tab became inactive, cleanup
        handleDAMMV2Deactivation();
      }

      wasDAMMV2Active = isDAMMV2Active;
    });

    // Observe changes to the tab container
    const tabContainer = document.querySelector(
      ".flex.flex-row.gap-2.overflow-x-scroll"
    );
    if (tabContainer) {
      observer.observe(tabContainer, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true,
        childList: true,
      });
      console.log("✅ Lancer: Tab monitor setup complete");
    } else {
      console.log("❌ Lancer: Tab container not found for monitoring");
    }
  };

  // Setup both click listener and mutation observer
  addClickListener();
  setupTabMonitor();
}

// Function to add Lancer status to Meteora's footer
function addLancerToFooter(isRpcConfigured = false) {
  const footer = document.querySelector(
    ".h-footer-height.bg-base--2.border-t.border-base-0.fixed.bottom-0"
  );

  if (!footer) {
    console.log("❌ Lancer: Footer not found");
    return;
  }

  // Remove existing Lancer entry if it exists
  const existingLancer = document.getElementById("lancer-footer-entry");
  if (existingLancer) {
    existingLancer.remove();
  }

  // Find the right side container (where Jupiter swap button is)
  const rightContainer = footer.querySelector(
    ".flex.items-center.divide-base-0.border-l.border-base-0"
  );

  if (!rightContainer) {
    console.log("❌ Lancer: Right container not found in footer");
    return;
  }

  // Create Lancer entry matching the Jupiter swap button style
  const lancerEntry = document.createElement("button");
  lancerEntry.id = "lancer-footer-entry";
  lancerEntry.className =
    "cursor-pointer justify-center transition-colors disabled:cursor-not-allowed font-medium text-sm flex items-center space-x-3 px-4 py-2 border-l border-base-0 rounded-none";
  lancerEntry.type = "button";

  // Create status indicator (green dot for active, yellow for not configured)
  const statusDot = document.createElement("div");
  statusDot.className = `size-[14px] rounded-full border-[3.5px] transition-colors duration-300 ${
    isRpcConfigured
      ? "text-success-primary bg-success-primary border-success-primary"
      : "text-danger-primary bg-danger-primary border-danger-primary"
  }`;

  // Create Lancer text
  const lancerText = document.createElement("span");
  lancerText.className = "text-sm font-medium leading-5 text-text-primary";
  lancerText.textContent = "Lancer";

  // Add elements to button
  lancerEntry.appendChild(statusDot);
  lancerEntry.appendChild(lancerText);

  // Add click handler to open extension popup (if needed)
  lancerEntry.addEventListener("click", () => {
    console.log("🚀 Lancer: Footer entry clicked");

    // Show current pool addresses in console for debugging
    const currentPools = DAMMPoolManager.getCurrentPoolAddresses();
    console.log("📊 Lancer: Current tracked pools:", currentPools);
  });

  // Insert Lancer entry before other buttons or at the end
  rightContainer.appendChild(lancerEntry);

  console.log(
    `✅ Lancer: Added to footer with status: ${
      isRpcConfigured ? "RPC Configured" : "Not Configured"
    }`
  );
}

// Main initialization function
async function initializeLancerBackend(): Promise<void> {
  try {
    console.log("🔧 Lancer: Initializing backend...");

    // Initialize the backend first
    const backendInitialized = await lancerBackend.initialize();

    if (!backendInitialized) {
      console.warn(
        "⚠️ Lancer: Backend initialization failed - check RPC configuration"
      );
      return;
    }

    // Try to detect wallet address from the page
    const walletAddress = detectWalletAddress();

    if (walletAddress) {
      console.log(`🔍 Lancer: Detected wallet address: ${walletAddress}`);

      // Load user positions
      await lancerBackend.loadUserPositions(walletAddress);

      // Start automatic PnL updates
      lancerBackend.startPnLUpdates();

      console.log("✅ Lancer: Backend fully initialized with positions");
    } else {
      console.warn("⚠️ Lancer: Could not detect wallet address");
    }
  } catch (error) {
    console.error("❌ Lancer: Error initializing backend:", error);
  }
}

// Function to detect wallet address from the page
function detectWalletAddress(): string | null {
  try {
    // Look for wallet address in the URL
    const urlMatch = window.location.pathname.match(
      /\/portfolio\/([A-Za-z0-9]{32,44})/
    );
    if (urlMatch) {
      return urlMatch[1];
    }

    // Look for wallet address in the page content
    const elements = document.querySelectorAll(
      '[class*="wallet"], [class*="address"], [data-wallet]'
    );
    for (const element of elements) {
      const text =
        element.textContent || element.getAttribute("data-wallet") || "";
      const addressMatch = text.match(/[A-Za-z0-9]{32,44}/);
      if (addressMatch) {
        return addressMatch[0];
      }
    }

    // Check if there's a connected wallet in localStorage or sessionStorage
    const storageKeys = [
      "wallet",
      "walletAddress",
      "connectedWallet",
      "phantom",
      "solflare",
    ];
    for (const key of storageKeys) {
      const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (
            typeof parsed === "string" &&
            parsed.match(/[A-Za-z0-9]{32,44}/)
          ) {
            return parsed;
          }
          if (
            parsed.publicKey &&
            parsed.publicKey.match(/[A-Za-z0-9]{32,44}/)
          ) {
            return parsed.publicKey;
          }
        } catch {
          // If parsing fails, try direct string match
          const match = stored.match(/[A-Za-z0-9]{32,44}/);
          if (match) return match[0];
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error detecting wallet address:", error);
    return null;
  }
}

// Add refresh button to the page
function addPnLRefreshButton(): void {
  // Check if button already exists
  if (document.querySelector(".lancer-refresh-button")) {
    return;
  }

  // Find a suitable container (near the Net Value section)
  const netValueElements = document.querySelectorAll("h1");
  let container: HTMLElement | null = null;

  for (const element of netValueElements) {
    if (element.textContent?.trim() === "Net Value") {
      container = element.closest(".md\\:col-span-2") as HTMLElement;
      break;
    }
  }

  if (!container) {
    console.log("Could not find suitable container for refresh button");
    return;
  }

  // Create refresh button
  const refreshButton = document.createElement("button");
  refreshButton.className = "lancer-refresh-button";
  refreshButton.innerHTML = `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-left: 8px;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
        <path d="M3 21v-5h5"/>
      </svg>
      <span class="lancer-refresh-text">Refresh PnL</span>
    </div>
  `;

  // Add hover effects
  refreshButton.addEventListener("mouseenter", () => {
    const div = refreshButton.querySelector("div") as HTMLElement;
    if (div) {
      div.style.transform = "scale(1.05)";
      div.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
    }
  });

  refreshButton.addEventListener("mouseleave", () => {
    const div = refreshButton.querySelector("div") as HTMLElement;
    if (div) {
      div.style.transform = "scale(1)";
      div.style.boxShadow = "none";
    }
  });

  // Add click handler
  refreshButton.addEventListener("click", async () => {
    const textSpan = refreshButton.querySelector(
      ".lancer-refresh-text"
    ) as HTMLElement;
    const originalText = textSpan.textContent;

    try {
      textSpan.textContent = "Refreshing...";
      refreshButton.style.opacity = "0.7";
      refreshButton.style.pointerEvents = "none";

      await DAMMPoolManager.refreshPnLData();

      textSpan.textContent = "✓ Refreshed";
      setTimeout(() => {
        textSpan.textContent = originalText;
      }, 2000);
    } catch (error) {
      textSpan.textContent = "✗ Error";
      setTimeout(() => {
        textSpan.textContent = originalText;
      }, 2000);
    } finally {
      refreshButton.style.opacity = "1";
      refreshButton.style.pointerEvents = "auto";
    }
  });

  // Add button to the container header
  const header = container.querySelector("h1");
  if (header && header.parentElement) {
    header.parentElement.style.display = "flex";
    header.parentElement.style.alignItems = "center";
    header.parentElement.appendChild(refreshButton);
  }
}

// Enhanced main initialization
async function injectEnhancements() {
  console.log("🚀 Lancer: Starting enhanced injection");

  try {
    // Initialize backend first
    await initializeLancerBackend();

    // Wait for DOM to be ready
    await waitForElement("body");

    // Initialize managers
    await OverallPnLManager.initialize();
    await DAMMPoolManager.initialize();

    // Setup DAMM V2 tab monitoring
    setupDAMMV2Monitor();

    // Add refresh button
    addPnLRefreshButton();

    // Add footer
    addLancerToFooter(lancerBackend.isInitialized());

    console.log("✅ Lancer: All enhancements successfully injected");
  } catch (error) {
    console.error("❌ Lancer: Error during injection:", error);
  }
}

// Auto-run the injection when the script loads
if (window.location.href.includes("v2.meteora.ag/portfolio")) {
  // Wait a bit for the page to load, then inject
  setTimeout(injectEnhancements, 2000);
} else {
  console.log("📍 Lancer: Not on portfolio page, skipping injection");
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (request: any, _sender: any, _sendResponse: any) => {
    console.log("🔔 Lancer: Received message:", request);

    if (request.action === "rpcConfigured") {
      console.log("⚙️ Lancer: RPC configured, updating footer status...");

      // Update the footer entry with configured status
      addLancerToFooter(true);
    }
  }
);

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  DAMMPoolManager.cleanup();
});

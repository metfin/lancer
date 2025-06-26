// Enhanced logging and page detection
console.log("🚀 Lancer: Content script loaded for Meteora portfolio");
console.log("🌍 Lancer: Current URL:", window.location.href);
console.log("⏰ Lancer: Script loaded at:", new Date().toISOString());

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

class DAMMPoolManager {
  private static poolTableObserver: MutationObserver | null = null;
  private static currentPoolAddresses: Set<string> = new Set();
  private static pnlData: Map<string, PositionPnL> = new Map();

  static async initialize(): Promise<void> {
    console.log("🎯 Lancer: Initializing DAMM Pool Manager");

    // Load existing pool addresses from storage
    const existingPools = await ExtensionStorage.getPoolAddresses();
    this.currentPoolAddresses = new Set(existingPools);

    // Start monitoring the pool table
    this.startPoolTableMonitoring();

    // Generate mock PnL data for demonstration
    this.generateMockPnLData();
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
    this.scanAndUpdatePools();

    // Set up mutation observer to watch for table changes
    this.poolTableObserver = new MutationObserver(() => {
      this.scanAndUpdatePools();
    });

    this.poolTableObserver.observe(poolTable, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  private static async scanAndUpdatePools(): Promise<void> {
    const poolEntries = this.extractPoolEntries();
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
        previous: Array.from(this.currentPoolAddresses),
        current: Array.from(newPoolAddresses),
      });

      this.currentPoolAddresses = newPoolAddresses;
      await ExtensionStorage.savePoolAddresses(Array.from(newPoolAddresses));

      // Inject PnL data into the table
      this.injectPnLIntoTable(poolEntries);
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
    for (const entry of poolEntries) {
      try {
        // Remove existing PnL column if it exists
        const existingPnL = entry.element.querySelector(".lancer-pnl-column");
        if (existingPnL) {
          existingPnL.remove();
        }

        // Find the grid container
        const gridContainer = entry.element.querySelector(".grid.gap-x-4");
        if (!gridContainer) continue;

        // Get PnL data for this pool
        const pnlData = this.pnlData.get(entry.poolAddress);
        const pnl = pnlData ? pnlData.pnl : this.generateRandomPnL();
        const pnlPercentage = pnlData
          ? pnlData.pnlPercentage
          : this.generateRandomPnLPercentage();

        // Create PnL column
        const pnlColumn = document.createElement("div");
        pnlColumn.className =
          "pr-1 flex text-end justify-end lancer-pnl-column";
        pnlColumn.style.gridColumn = "2 / 3"; // Insert between Pools and Your Deposits

        // Create PnL content
        const pnlContent = document.createElement("div");
        pnlContent.className = "flex flex-col items-end gap-1";

        // PnL value
        const pnlValue = document.createElement("div");
        pnlValue.className = `flex flex-rows items-center whitespace-nowrap text-sm font-medium ${
          pnl >= 0 ? "text-green-500" : "text-red-500"
        }`;
        pnlValue.textContent = `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(
          2
        )}`;

        // PnL percentage
        const pnlPercent = document.createElement("div");
        pnlPercent.className = `text-xs ${
          pnl >= 0 ? "text-green-400" : "text-red-400"
        }`;
        pnlPercent.textContent = `${
          pnlPercentage >= 0 ? "+" : ""
        }${pnlPercentage.toFixed(2)}%`;

        pnlContent.appendChild(pnlValue);
        pnlContent.appendChild(pnlPercent);
        pnlColumn.appendChild(pnlContent);

        // Insert the PnL column
        const firstColumn = gridContainer.querySelector(
          '[style*="grid-column: 1 / 4"]'
        );
        if (firstColumn && firstColumn.parentNode) {
          firstColumn.parentNode.insertBefore(
            pnlColumn,
            firstColumn.nextSibling
          );
        }

        // Update grid template to accommodate new column
        const currentStyle = (gridContainer as HTMLElement).style
          .gridTemplateColumns;
        if (!currentStyle.includes("8,")) {
          (gridContainer as HTMLElement).style.gridTemplateColumns =
            "repeat(8, minmax(0px, 1fr))";
        }
      } catch (error) {
        console.error(
          "❌ Lancer: Error injecting PnL for pool:",
          entry.poolAddress,
          error
        );
      }
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

      // Create PnL header
      const pnlHeader = document.createElement("div");
      pnlHeader.className =
        "flex-row gap-2 items-center flex text-end justify-end lancer-pnl-header";
      pnlHeader.style.gridColumn = "2 / 3";
      pnlHeader.textContent = "Position PnL";

      // Insert after the Pools header
      const poolsHeader = header.querySelector('[style*="grid-column: 1 / 4"]');
      if (poolsHeader && poolsHeader.parentNode) {
        poolsHeader.parentNode.insertBefore(pnlHeader, poolsHeader.nextSibling);
      }

      // Update grid template
      (header as HTMLElement).style.gridTemplateColumns =
        "repeat(8, minmax(0px, 1fr))";
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

  static cleanup(): void {
    if (this.poolTableObserver) {
      this.poolTableObserver.disconnect();
      this.poolTableObserver = null;
    }
    this.currentPoolAddresses.clear();
    this.pnlData.clear();
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

      // Add PnL header to the table
      DAMMPoolManager.addPnLHeader();

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
    isRpcConfigured ? "text-green-500" : "text-yellow-500"
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

// Enhanced injection function
async function injectEnhancements() {
  console.log("🔧 Lancer: Injecting enhancements...");

  // Wait for the footer to load
  console.log("⏳ Lancer: Waiting for footer to load...");
  const footer = await waitForElement(
    ".h-footer-height.bg-base--2.border-t.border-base-0.fixed.bottom-0"
  );

  if (footer) {
    console.log("✅ Lancer: Footer found, adding Lancer entry");
    addLancerToFooter(false); // Start with not configured status
  } else {
    console.log("❌ Lancer: Footer not found after timeout");
  }

  // Wait for tab container to load and setup DAMM V2 monitoring
  console.log("⏳ Lancer: Waiting for tab container to load...");
  const tabContainer = await waitForElement(
    ".flex.flex-row.gap-2.overflow-x-scroll"
  );

  if (tabContainer) {
    console.log("✅ Lancer: Tab container found, setting up DAMM V2 monitor");
    setupDAMMV2Monitor();
  } else {
    console.log("❌ Lancer: Tab container not found after timeout");
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectEnhancements);
} else {
  injectEnhancements();
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

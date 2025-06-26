// Content script for Meteora v2 portfolio enhancement
console.log("Lancer: Content script loaded for Meteora portfolio");

// Wait for the page to be fully loaded
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

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Inject enhancement UI
async function injectEnhancements() {
  // Wait for the main content area to load
  const mainContent = await waitForElement(
    '[data-testid="main-content"], main, .portfolio-container, body'
  );

  if (!mainContent) {
    console.log("Lancer: Could not find main content area");
    return;
  }

  // Create enhancement panel
  const enhancementPanel = document.createElement("div");
  enhancementPanel.id = "lancer-enhancement-panel";
  enhancementPanel.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      z-index: 10000;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">🚀 Lancer Enhanced</h3>
        <button id="lancer-toggle" style="
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 18px;
        ">−</button>
      </div>
      <div id="lancer-content">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #ccc;">RPC Status</label>
          <div id="rpc-status" style="font-size: 12px; color: #ff6b6b;">Not configured</div>
        </div>
        <button id="configure-rpc" style="
          width: 100%;
          background: #4f46e5;
          border: none;
          color: white;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          margin-bottom: 8px;
        ">Configure RPC</button>
        <button id="refresh-data" style="
          width: 100%;
          background: #059669;
          border: none;
          color: white;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Refresh Portfolio Data</button>
      </div>
    </div>
  `;

  document.body.appendChild(enhancementPanel);

  // Add toggle functionality
  const toggleBtn = document.getElementById("lancer-toggle");
  const content = document.getElementById("lancer-content");
  let isCollapsed = false;

  toggleBtn?.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    if (content) {
      content.style.display = isCollapsed ? "none" : "block";
    }
    if (toggleBtn) {
      toggleBtn.textContent = isCollapsed ? "+" : "−";
    }
  });

  // Add button listeners
  document.getElementById("configure-rpc")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopup" });
  });

  document.getElementById("refresh-data")?.addEventListener("click", () => {
    refreshPortfolioData();
  });

  // Check RPC configuration
  chrome.storage.sync.get(["rpcUrl"], (result) => {
    const rpcStatus = document.getElementById("rpc-status");
    if (rpcStatus) {
      if (result.rpcUrl) {
        rpcStatus.textContent = "Connected";
        rpcStatus.style.color = "#10b981";
      } else {
        rpcStatus.textContent = "Not configured";
        rpcStatus.style.color = "#ff6b6b";
      }
    }
  });
}

async function refreshPortfolioData() {
  console.log("Lancer: Refreshing portfolio data...");

  // Get stored RPC URL
  chrome.storage.sync.get(["rpcUrl"], async (result) => {
    if (!result.rpcUrl) {
      alert("Please configure your RPC URL first");
      return;
    }

    try {
      // Here you would implement the actual data refresh logic
      // For now, just simulate a refresh
      const refreshBtn = document.getElementById(
        "refresh-data"
      ) as HTMLButtonElement;
      if (refreshBtn) {
        refreshBtn.textContent = "Refreshing...";
        refreshBtn.disabled = true;

        setTimeout(() => {
          refreshBtn.textContent = "Refresh Portfolio Data";
          refreshBtn.disabled = false;
          console.log("Lancer: Portfolio data refreshed");
        }, 2000);
      }
    } catch (error) {
      console.error("Lancer: Error refreshing data:", error);
    }
  });
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
    if (request.action === "rpcConfigured") {
      const rpcStatus = document.getElementById("rpc-status");
      if (rpcStatus) {
        rpcStatus.textContent = "Connected";
        rpcStatus.style.color = "#10b981";
      }
    }
  }
);

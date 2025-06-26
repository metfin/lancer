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
function handleDAMMV2Activation() {
  console.log("🎯 Lancer: DAMM V2 tab activated!");

  // Add your custom code here for when DAMM V2 tab is active
  // This is where you can add any logic you want to execute
  // when the user switches to the DAMM V2 tab

  // Example: You could inject additional UI elements, start monitoring, etc.
  console.log("⚡ Lancer: Executing DAMM V2 specific functionality...");
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

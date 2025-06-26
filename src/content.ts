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

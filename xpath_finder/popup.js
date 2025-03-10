// Popup functionality for XPath Finder

// DOM elements
const toggleActiveCheckbox = document.getElementById("toggle-active");
const toggleStrictModeCheckbox = document.getElementById("toggle-strict-mode");
const recentXPathsList = document.getElementById("recent-xpaths-list");
const xpathInput = document.getElementById("xpath-input");
const testBtn = document.getElementById("test-btn");
const copyTestBtn = document.getElementById("copy-test-btn");
const testResult = document.getElementById("test-result");
const clearRecentBtn = document.getElementById("clear-recent");
const notification = document.getElementById("notification");

// Current state
let isActive = true;
let strictMode = true;
let recentXPaths = [];

// Initialize popup state
function initPopup() {
  // Get state from storage
  chrome.storage.local.get(
    ["isActive", "strictMode", "recentXPaths"],
    function (result) {
      isActive = result.isActive !== undefined ? result.isActive : true;
      strictMode = result.strictMode !== undefined ? result.strictMode : true;
      recentXPaths = result.recentXPaths || [];

      // Update UI based on state
      toggleActiveCheckbox.checked = isActive;
      toggleStrictModeCheckbox.checked = strictMode;
      updateRecentXPathsList();
    }
  );
}

// Update the recent XPaths list
function updateRecentXPathsList() {
  // Clear the list
  recentXPathsList.innerHTML = "";

  if (recentXPaths.length === 0) {
    recentXPathsList.innerHTML = `<div style="color: #999; font-style: italic;">No recent XPaths</div>`;
    return;
  }

  // Add each XPath to the list
  recentXPaths.forEach((xpath, index) => {
    const item = document.createElement("div");
    item.className = "recent-xpath-item";
    item.textContent = xpath;

    // Add actions div
    const actions = document.createElement("div");
    actions.className = "recent-xpath-actions";

    // Add copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "action-btn";
    copyBtn.innerHTML = "⧉";
    copyBtn.title = "Copy to clipboard";
    copyBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      copyToClipboard(xpath);
    });

    // Add test button
    const testBtn = document.createElement("button");
    testBtn.className = "action-btn";
    testBtn.innerHTML = "⚙";
    testBtn.title = "Test this XPath";
    testBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      xpathInput.value = xpath;
      testSelector(xpath);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(testBtn);
    item.appendChild(actions);

    // Make the entire item clickable to test
    item.addEventListener("click", function () {
      xpathInput.value = xpath;
      testSelector(xpath);
    });

    recentXPathsList.appendChild(item);
  });
}

// Test an XPath selector on the active tab
function testSelector(selector) {
  // Show loading state
  testResult.textContent = "Testing...";
  testResult.style.display = "block";
  testResult.className = "";

  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Send message to content script to test the selector
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "testSelector", selector: selector },
      function (response) {
        if (chrome.runtime.lastError) {
          testResult.textContent = "Error: " + chrome.runtime.lastError.message;
          testResult.className = "error";
          return;
        }

        if (!response) {
          testResult.textContent = "Error: No response from content script";
          testResult.className = "error";
          return;
        }

        // Update the result
        testResult.textContent = `Found ${response.count} matching element${
          response.count !== 1 ? "s" : ""
        }`;
        testResult.className = response.count > 0 ? "success" : "error";
      }
    );
  });
}

// Copy text to clipboard
function copyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);

  // Show notification
  showNotification("Copied to clipboard");
}

// Show a notification
function showNotification(message, duration = 2000) {
  notification.textContent = message;
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, duration);
}

// Add event listeners
function setupEventListeners() {
  // Toggle active state
  toggleActiveCheckbox.addEventListener("change", function () {
    isActive = this.checked;
    chrome.storage.local.set({ isActive: isActive });

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateSettings",
        isActive: isActive,
        strictMode: strictMode,
      });
    });
  });

  // Toggle strict mode
  toggleStrictModeCheckbox.addEventListener("change", function () {
    strictMode = this.checked;
    chrome.storage.local.set({ strictMode: strictMode });

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateSettings",
        isActive: isActive,
        strictMode: strictMode,
      });
    });
  });

  // Test selector
  testBtn.addEventListener("click", function () {
    const selector = xpathInput.value.trim();
    if (!selector) {
      testResult.textContent = "Please enter an XPath selector";
      testResult.style.display = "block";
      testResult.className = "error";
      return;
    }

    testSelector(selector);
  });

  // Copy test selector
  copyTestBtn.addEventListener("click", function () {
    const selector = xpathInput.value.trim();
    if (!selector) {
      testResult.textContent = "Please enter an XPath selector";
      testResult.style.display = "block";
      testResult.className = "error";
      return;
    }

    copyToClipboard(selector);
  });

  // Clear recent XPaths
  clearRecentBtn.addEventListener("click", function () {
    recentXPaths = [];
    chrome.storage.local.set({ recentXPaths: [] });
    updateRecentXPathsList();
    showNotification("Recent XPaths cleared");
  });

  // Handle Enter key in the input field
  xpathInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const selector = xpathInput.value.trim();
      if (selector) {
        testSelector(selector);
      }
    }
  });
}

// Initialize popup
document.addEventListener("DOMContentLoaded", function () {
  initPopup();
  setupEventListeners();
});

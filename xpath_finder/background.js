// Background script for XPath Finder extension

// Initialize default settings when the extension is installed
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.set(
    {
      isActive: true,
      strictMode: true,
      recentXPaths: [],
    },
    function () {
      console.log("XPath Finder: Default settings initialized");
    }
  );
});

// Listen for messages from the popup or content script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getState") {
    // Get current state from storage and send it back
    chrome.storage.local.get(
      ["isActive", "strictMode", "recentXPaths"],
      function (result) {
        sendResponse({
          isActive: result.isActive !== undefined ? result.isActive : true,
          strictMode:
            result.strictMode !== undefined ? result.strictMode : true,
          recentXPaths: result.recentXPaths || [],
        });
      }
    );
    return true; // Keep the messaging channel open for the async response
  }
});

// Open the extension popup when the icon is clicked
chrome.action.onClicked.addListener(function (tab) {
  // This is handled by the popup.html in manifest.json, no need for additional code here
});

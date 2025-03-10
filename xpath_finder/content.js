// Global variables
let isActive = true;
let strictMode = true;
let hoverTooltip = null;
let highlightedElements = [];
let currentElement = null;
let recentXPaths = [];
const MAX_RECENT_XPATHS = 10;
let tooltipPinned = false;
let tooltipPosition = { x: 0, y: 0 }; // Store fixed tooltip position
let tagFilter = ""; // Store current tag filter
let prioritizedTags = []; // Tags that should be prioritized

// Create the hover tooltip element
function createHoverTooltip() {
  const tooltip = document.createElement("div");
  tooltip.id = "xpath-finder-tooltip";
  tooltip.style.display = "none";
  tooltip.style.position = "fixed";
  tooltip.style.zIndex = "10000";
  tooltip.style.backgroundColor = "#fff";
  tooltip.style.border = "1px solid #ccc";
  tooltip.style.borderRadius = "4px";
  tooltip.style.padding = "10px";
  tooltip.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
  tooltip.style.maxWidth = "400px";
  tooltip.style.maxHeight = "300px";
  tooltip.style.overflow = "auto";
  tooltip.style.fontSize = "12px";
  tooltip.style.fontFamily = "Arial, sans-serif";

  document.body.appendChild(tooltip);
  return tooltip;
}

// Get XPath for a specific element
function getElementXPath(element) {
  if (!element) return "";

  // For the HTML element
  if (element.tagName.toLowerCase() === "html") return "/html";

  // Get all siblings of the same type
  let siblings = Array.from(element.parentNode.children).filter(
    (sibling) => sibling.tagName === element.tagName
  );

  let index = siblings.indexOf(element) + 1;

  // If there's only one of this element type under the parent, don't include index
  if (siblings.length === 1 && strictMode === false) {
    return `${getElementXPath(
      element.parentNode
    )}/${element.tagName.toLowerCase()}`;
  }

  // Otherwise, include the index
  return `${getElementXPath(
    element.parentNode
  )}/${element.tagName.toLowerCase()}[${index}]`;
}

// Generate alternative XPath patterns
function generateXPathAlternatives(element) {
  if (!element) return [];

  const xpaths = [];
  const tag = element.tagName.toLowerCase();

  // By ID if available (highest priority)
  if (element.id) {
    // Escape ID value to prevent XPath injection
    const escapedId = escapeXPathString(element.id);
    xpaths.push({
      xpath: `//*[@id=${escapedId}]`,
      description: "By ID",
      specificity: "high",
      priority: 10,
    });

    xpaths.push({
      xpath: `//${tag}[@id=${escapedId}]`,
      description: `By tag and ID`,
      specificity: "high",
      priority: 9,
    });
  }

  // By class if available
  if (
    element.className &&
    typeof element.className === "string" &&
    element.className.trim()
  ) {
    const classes = element.className.trim().split(/\s+/);

    // All classes combined (more specific)
    if (classes.length > 1) {
      const classConditions = classes
        .map((cls) => `contains(@class, ${escapeXPathString(cls)})`)
        .join(" and ");
      xpaths.push({
        xpath: `//${tag}[${classConditions}]`,
        description: "By all classes",
        specificity: "high",
        priority: 8,
      });
    }

    // Individual classes
    classes.forEach((cls) => {
      xpaths.push({
        xpath: `//${tag}[contains(@class, ${escapeXPathString(cls)})]`,
        description: `By class "${cls}"`,
        specificity: "medium",
        priority: 6,
      });
    });
  }

  // By text content for elements that typically have text
  if (
    [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "span",
      "a",
      "button",
      "label",
      "li",
    ].includes(tag)
  ) {
    const text = element.textContent.trim();
    if (text && text.length < 50) {
      // Only use text if it's reasonably short
      try {
        xpaths.push({
          xpath: `//${tag}[contains(text(), ${escapeXPathString(text)})]`,
          description: "By text content",
          specificity: "medium",
          priority: 7,
        });
      } catch (e) {
        console.warn("Error creating text-based XPath:", e);
      }
    }
  }

  // By attribute values
  for (const attr of element.attributes) {
    if (["id", "class"].includes(attr.name) || !attr.value) continue;

    if (
      attr.name === "name" ||
      attr.name === "type" ||
      attr.name.startsWith("data-") ||
      attr.name === "placeholder" ||
      attr.name === "title" ||
      attr.name === "value"
    ) {
      try {
        xpaths.push({
          xpath: `//${tag}[@${attr.name}=${escapeXPathString(attr.value)}]`,
          description: `By ${attr.name}="${attr.value}"`,
          specificity: "medium",
          priority: 5,
        });
      } catch (e) {
        console.warn(
          `Error creating attribute-based XPath for ${attr.name}:`,
          e
        );
      }
    }
  }

  // Most specific XPath (with full path) - lowest priority
  xpaths.push({
    xpath: getElementXPath(element),
    description: "Full path",
    specificity: "high",
    priority: 1,
  });

  // Filter valid XPaths and sort by priority
  const validXPaths = xpaths.filter(
    (item) => item.xpath && isValidXPath(item.xpath)
  );

  // Apply tag filtering if available
  if (tagFilter && tagFilter.trim() !== "") {
    const filteredTag = tagFilter.toLowerCase();
    const tagFilteredXPaths = validXPaths.filter(
      (item) =>
        item.xpath.includes(`//${filteredTag}`) ||
        item.xpath.includes(`/${filteredTag}`)
    );

    // If we have tag-filtered results, prioritize them
    if (tagFilteredXPaths.length > 0) {
      // Give tag-filtered results higher priority
      tagFilteredXPaths.forEach((item) => {
        item.priority += 100;
        item.tagFiltered = true;
      });

      // Combine tag filtered and non-filtered results
      return [
        ...tagFilteredXPaths,
        ...validXPaths.filter((item) => !item.tagFiltered),
      ].sort((a, b) => b.priority - a.priority);
    }
  }

  // Return sorted XPaths by priority
  return validXPaths.sort((a, b) => b.priority - a.priority);
}

// Properly escape a string for XPath use
function escapeXPathString(str) {
  if (typeof str !== "string") {
    return "''";
  }

  // If the string doesn't contain single or double quotes, use it as-is in single quotes
  if (!str.includes("'") && !str.includes('"')) {
    return `'${str}'`;
  }

  // If the string contains single quotes but not double quotes, use double quotes
  if (!str.includes('"')) {
    return `"${str}"`;
  }

  // If the string contains double quotes but not single quotes, use single quotes
  if (!str.includes("'")) {
    return `'${str}'`;
  }

  // If the string contains both types of quotes, we need to use concat()
  // Example: concat('part1', "'", 'part2', '"', 'part3')
  let result = "concat(";
  let parts = [];
  let currentPart = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "'") {
      if (currentPart.length > 0) {
        parts.push(`'${currentPart}'`);
        currentPart = "";
      }
      parts.push(`"'"`);
    } else if (char === '"') {
      if (currentPart.length > 0) {
        parts.push(`'${currentPart}'`);
        currentPart = "";
      }
      parts.push(`'"'`);
    } else {
      currentPart += char;
    }
  }

  if (currentPart.length > 0) {
    parts.push(`'${currentPart}'`);
  }

  result += parts.join(", ");
  result += ")";

  return result;
}

// Validate XPath without throwing errors
function isValidXPath(xpath) {
  try {
    const count = countMatchingElements(xpath);
    return true;
  } catch (e) {
    console.warn("Invalid XPath:", xpath, e);
    return false;
  }
}

// Count how many elements match a given XPath
function countMatchingElements(xpath) {
  try {
    // First try to create an XPathEvaluator to catch syntax errors
    const evaluator = new XPathEvaluator();
    evaluator.createExpression(xpath);

    // If that succeeds, proceed with evaluation
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    return result.snapshotLength;
  } catch (e) {
    // Log the error and the XPath that caused it
    console.error(`Error evaluating XPath: ${xpath}`, e);
    throw e; // Re-throw so the caller knows there was a problem
  }
}

// Get all elements matching a given XPath
function getMatchingElements(xpath) {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    const elements = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      elements.push(result.snapshotItem(i));
    }
    return elements;
  } catch (e) {
    console.error(`Error getting matching elements for XPath: ${xpath}`, e);
    return [];
  }
}

// Highlight elements matching a given XPath
function highlightMatchingElements(xpath, isCurrentElement = false) {
  removeAllHighlights();

  const elements = getMatchingElements(xpath);

  elements.forEach((element) => {
    const highlight = document.createElement("div");
    highlight.className = isCurrentElement
      ? "xpath-finder-highlight current"
      : "xpath-finder-highlight";

    // Get element position and dimensions
    updateHighlightPosition(highlight, element, isCurrentElement);

    document.body.appendChild(highlight);
    highlightedElements.push({ highlight, element, isCurrentElement });
  });

  return elements.length;
}

// Update the position of a highlight based on its target element
function updateHighlightPosition(highlight, element, isCurrentElement = false) {
  const rect = element.getBoundingClientRect();

  highlight.style.position = "fixed"; // Use fixed positioning for viewport coordinates
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  if (isCurrentElement) {
    highlight.style.backgroundColor = "rgba(245, 158, 11, 0.2)"; // secondary color
    highlight.style.border = "2px solid #f59e0b"; // secondary color
    highlight.classList.add("current");
  } else {
    highlight.style.backgroundColor = "rgba(79, 70, 229, 0.15)"; // primary color
    highlight.style.border = "2px solid #4f46e5"; // primary color
  }

  highlight.style.zIndex = isCurrentElement ? "10000" : "9999";
  highlight.style.pointerEvents = "none";
  highlight.style.borderRadius = "0.25rem"; // var(--radius)
  highlight.style.boxShadow = isCurrentElement
    ? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" // var(--shadow-md)
    : "none";
}

// Update all highlight positions (for when scrolling occurs)
function updateAllHighlights() {
  highlightedElements.forEach((item) => {
    if (item.element && item.highlight) {
      updateHighlightPosition(
        item.highlight,
        item.element,
        item.isCurrentElement
      );
    }
  });
}

// Remove all highlight elements
function removeAllHighlights() {
  highlightedElements.forEach((item) => {
    if (item.highlight && item.highlight.parentNode) {
      item.highlight.parentNode.removeChild(item.highlight);
    }
  });
  highlightedElements = [];
}

// Copy content to clipboard
function copyToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    showNotification(successful ? "Copied to clipboard!" : "Failed to copy");
  } catch (err) {
    console.error("Error copying to clipboard:", err);
    showNotification("Failed to copy: " + err);
  }

  document.body.removeChild(textArea);
}

// Show notification message
function showNotification(message) {
  const notification = document.createElement("div");
  notification.className = "xpath-finder-notification";
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.bottom = "20px";
  notification.style.left = "50%";
  notification.style.transform = "translateX(-50%)";
  notification.style.backgroundColor = "#333";
  notification.style.color = "#fff";
  notification.style.padding = "8px 16px";
  notification.style.borderRadius = "4px";
  notification.style.zIndex = "10001";
  notification.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.5s";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 2000);
}

// Update the tooltip contents and position
function updateTooltip(element, mouseX, mouseY) {
  if (!hoverTooltip) return;

  if (
    !element ||
    element === document ||
    element === document.documentElement
  ) {
    if (!tooltipPinned) {
      hoverTooltip.style.display = "none";
    }
    return;
  }

  // Get XPath variants - remove CSS selectors
  const xpathAlternatives = generateXPathAlternatives(element);

  // Save to recent XPaths if we have something
  if (xpathAlternatives.length > 0) {
    const newXPath = xpathAlternatives[0].xpath;

    // Only add if it's not a duplicate
    if (!recentXPaths.includes(newXPath)) {
      // Add to the beginning
      recentXPaths.unshift(newXPath);

      // Keep only the max number of items
      if (recentXPaths.length > MAX_RECENT_XPATHS) {
        recentXPaths.pop();
      }

      // Save to storage
      chrome.storage.local.set({ recentXPaths });
    }
  }

  const elementTag = element.tagName.toLowerCase();

  // Create tooltip content
  let content = `<div class="xpath-finder-element-info">
    <div class="xpath-finder-tag">&lt;${elementTag}&gt;</div>
    <button id="xpath-close-btn" class="xpath-close-btn">×</button>
    <div class="tag-filter-container">
      <input type="text" class="tag-filter-input ${
        tagFilter ? "active-filter" : ""
      }" 
        id="xpath-tag-filter" 
        placeholder="Filter by tag (e.g., '${elementTag}', 'div', 'a')" 
        value="${tagFilter}">
      <div class="tag-filter-help">Press Enter to apply filter</div>
    </div>
  </div>`;

  // Count filtered vs total results
  const totalXPaths = xpathAlternatives.length;
  const filteredXPaths = xpathAlternatives.filter((x) => x.tagFiltered).length;

  // XPath section
  if (xpathAlternatives.length > 0) {
    // Add filter indicator if filtering is active
    const filterIndicator = tagFilter
      ? `<span class="filter-indicator">(${filteredXPaths}/${totalXPaths} filtered)</span>`
      : "";

    content += `<div class="xpath-finder-section">
      <h3>XPath Options ${filterIndicator}</h3>
      <ul class="xpath-finder-list">`;

    xpathAlternatives.forEach((option) => {
      const count = countMatchingElements(option.xpath);
      const tagFilteredClass = option.tagFiltered ? "tag-filtered" : "";
      content += `
        <li class="xpath-selector-item ${tagFilteredClass}" data-selector="${
        option.xpath
      }" data-type="xpath">
          <div class="xpath-selector-header">
            <span class="xpath-selector-title">${option.description}</span>
            <span class="xpath-match-count">${count} match${
        count !== 1 ? "es" : ""
      }</span>
          </div>
          <div class="xpath-selector-code">${option.xpath}</div>
          <div class="xpath-selector-actions">
            <button class="xpath-btn xpath-test-btn" data-selector="${
              option.xpath
            }" data-type="xpath">Test</button>
            <button class="xpath-btn xpath-copy-btn" data-selector="${
              option.xpath
            }">Copy</button>
          </div>
        </li>`;
    });

    content += "</ul></div>";
  }

  // Add quick filter buttons for common tags
  let quickFilters = "";
  const commonTags = ["div", "span", "a", "button", "input", "img", elementTag];
  // Remove duplicates
  const uniqueTags = [...new Set(commonTags)];

  quickFilters += '<div class="quick-filters">';
  quickFilters += '<div class="quick-filters-label">Quick Filters:</div>';
  uniqueTags.forEach((tag) => {
    const isActive = tagFilter === tag ? "active" : "";
    quickFilters += `<button class="quick-filter-btn ${isActive}" data-tag="${tag}">${tag}</button>`;
  });
  quickFilters +=
    '<button class="quick-filter-btn clear" data-tag="">Clear</button>';
  quickFilters += "</div>";

  // Pin/Unpin button
  content += `
    <div class="xpath-finder-footer">
      ${quickFilters}
      <button id="xpath-toggle-pin" class="${tooltipPinned ? "pinned" : ""}">
        ${tooltipPinned ? "Unpin Tooltip" : "Pin Tooltip"}
      </button>
    </div>`;

  // Set the HTML content before positioning
  hoverTooltip.innerHTML = content;

  // Set tooltip dimensions based on content
  hoverTooltip.style.maxWidth = "450px";
  hoverTooltip.style.maxHeight = "80vh"; // Limit to 80% of viewport height

  // Position the tooltip - only update position if not pinned
  if (!tooltipPinned) {
    // Get tooltip dimensions after content is set
    const tooltipHeight = hoverTooltip.offsetHeight;
    const tooltipWidth = hoverTooltip.offsetWidth;

    // Start with the mouse position
    let top = mouseY + 15;
    let left = mouseX + 10;

    // Get viewport dimensions, accounting for scroll
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Ensure the tooltip stays within the viewport bounds
    // Check bottom boundary
    if (top + tooltipHeight > viewportHeight) {
      // Place above the cursor if it would go off the bottom
      top = Math.max(10, mouseY - tooltipHeight - 10);

      // If still off-screen, position at the bottom of the viewport with margin
      if (top < 0 || top + tooltipHeight > viewportHeight) {
        top = Math.max(10, viewportHeight - tooltipHeight - 10);
      }
    }

    // Check right boundary
    if (left + tooltipWidth > viewportWidth) {
      // Place to the left of the cursor if it would go off the right
      left = Math.max(10, mouseX - tooltipWidth - 10);

      // If still off-screen, position at the right of the viewport with margin
      if (left < 0 || left + tooltipWidth > viewportWidth) {
        left = Math.max(10, viewportWidth - tooltipWidth - 10);
      }
    }

    // Store position for future reference
    tooltipPosition.x = left;
    tooltipPosition.y = top;

    // Apply position
    hoverTooltip.style.top = `${top}px`;
    hoverTooltip.style.left = `${left}px`;
  } else {
    // For pinned tooltips, ensure they're still on screen after window resize
    const tooltipHeight = hoverTooltip.offsetHeight;
    const tooltipWidth = hoverTooltip.offsetWidth;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = tooltipPosition.y;
    let left = tooltipPosition.x;

    // Adjust if off-screen
    if (top + tooltipHeight > viewportHeight) {
      top = Math.max(10, viewportHeight - tooltipHeight - 10);
    }

    if (left + tooltipWidth > viewportWidth) {
      left = Math.max(10, viewportWidth - tooltipWidth - 10);
    }

    // Update stored position
    tooltipPosition.x = left;
    tooltipPosition.y = top;

    // Apply adjusted position
    hoverTooltip.style.top = `${top}px`;
    hoverTooltip.style.left = `${left}px`;
  }

  // Highlight the current element
  highlightMatchingElements(
    `//*[count(.|${getElementXPath(element)})=count(${getElementXPath(
      element
    )})]`,
    true
  );

  // Display the tooltip
  hoverTooltip.style.display = "block";

  // Add event listeners to buttons and other elements
  addTooltipEventListeners(element);

  // Add close button event listener
  const closeBtn = hoverTooltip.querySelector("#xpath-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      // Unpin the tooltip
      tooltipPinned = false;
      const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
      if (pinButton) {
        pinButton.classList.remove("pinned");
        pinButton.textContent = "Pin Tooltip";
      }

      // Hide the tooltip
      hoverTooltip.style.display = "none";
      removeAllHighlights();

      showNotification("Tooltip closed - hover over elements to show again");
    });
  }
}

// Add event listeners to tooltip buttons
function addTooltipEventListeners(element) {
  // Test buttons
  const testButtons = hoverTooltip.querySelectorAll(".xpath-test-btn");
  testButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.stopPropagation();

      // Pin the tooltip when a test button is clicked for stability
      if (!tooltipPinned) {
        tooltipPinned = true;
        const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
        if (pinButton) {
          pinButton.classList.add("pinned");
          pinButton.textContent = "Unpin Tooltip";
        }
      }

      const selector = this.getAttribute("data-selector");
      const type = this.getAttribute("data-type");

      // Add visual feedback
      this.classList.add("xpath-btn-clicked");
      setTimeout(() => {
        this.classList.remove("xpath-btn-clicked");
      }, 200);

      if (type === "xpath") {
        const count = highlightMatchingElements(selector);
        showNotification(
          `Found ${count} matching element${count !== 1 ? "s" : ""}`
        );
      }
    });
  });

  // Copy buttons
  const copyButtons = hoverTooltip.querySelectorAll(".xpath-copy-btn");
  copyButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();

      // Pin the tooltip when a copy button is clicked for stability
      if (!tooltipPinned) {
        tooltipPinned = true;
        const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
        if (pinButton) {
          pinButton.classList.add("pinned");
          pinButton.textContent = "Unpin Tooltip";
        }
      }

      const selector = this.getAttribute("data-selector");

      // Add visual feedback
      this.classList.add("xpath-btn-clicked");
      setTimeout(() => {
        this.classList.remove("xpath-btn-clicked");
      }, 200);

      // Use modern clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(selector)
          .then(() => {
            showNotification("Copied to clipboard!");
          })
          .catch((err) => {
            console.error("Clipboard write failed:", err);
            // Fallback to the older method
            copyToClipboardFallback(selector);
          });
      } else {
        // Use fallback for browsers that don't support the Clipboard API
        copyToClipboardFallback(selector);
      }
    });
  });

  // Quick filter buttons
  const quickFilterButtons = hoverTooltip.querySelectorAll(".quick-filter-btn");
  quickFilterButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.stopPropagation();

      // Pin the tooltip when a filter button is clicked
      if (!tooltipPinned) {
        tooltipPinned = true;
        const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
        if (pinButton) {
          pinButton.classList.add("pinned");
          pinButton.textContent = "Unpin Tooltip";
        }
      }

      // Add visual feedback
      this.classList.add("xpath-btn-clicked");
      setTimeout(() => {
        this.classList.remove("xpath-btn-clicked");
      }, 200);

      const tag = this.getAttribute("data-tag");

      // Update tag filter
      tagFilter = tag;

      // Update input field
      const filterInput = hoverTooltip.querySelector("#xpath-tag-filter");
      if (filterInput) {
        filterInput.value = tag;

        // Toggle active class
        if (tag) {
          filterInput.classList.add("active-filter");
        } else {
          filterInput.classList.remove("active-filter");
        }
      }

      // Refresh the tooltip with the new filter
      updateTooltip(
        element,
        parseInt(hoverTooltip.style.left),
        parseInt(hoverTooltip.style.top)
      );

      // Show notification
      if (tag) {
        showNotification(`Filtering by "${tag}" tag`);
      } else {
        showNotification("Filter cleared");
      }
    });
  });

  // Pin/unpin button
  const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
  if (pinButton) {
    pinButton.addEventListener("click", function (e) {
      e.stopPropagation();
      tooltipPinned = !tooltipPinned;
      this.classList.toggle("pinned");
      this.textContent = tooltipPinned ? "Unpin Tooltip" : "Pin Tooltip";

      // Add visual feedback
      this.classList.add("xpath-btn-clicked");
      setTimeout(() => {
        this.classList.remove("xpath-btn-clicked");
      }, 200);

      // If pinned, store the current position
      if (tooltipPinned) {
        tooltipPosition.x = parseInt(hoverTooltip.style.left);
        tooltipPosition.y = parseInt(hoverTooltip.style.top);
        showNotification("Tooltip pinned - will stay in place");
      } else {
        showNotification("Tooltip unpinned - will follow mouse");
      }
    });
  }

  // Add click handler to the entire tooltip to prevent it from closing when clicked
  hoverTooltip.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Click handler for the inspected element itself to prevent default actions
  if (element) {
    // Only add this if we haven't already done so
    if (!element._hasXPathFinderHandler) {
      element._hasXPathFinderHandler = true;

      // Store the original onclick handler if it exists
      const originalOnClick = element.onclick;

      // Replace with our handler that conditionally calls the original
      element.onclick = function (e) {
        // Check if the extension is active
        if (isActive && hoverTooltip.style.display === "block") {
          e.preventDefault();
          e.stopPropagation();

          // Pin the tooltip if not already pinned
          if (!tooltipPinned) {
            tooltipPinned = true;
            const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
            if (pinButton) {
              pinButton.classList.add("pinned");
              pinButton.textContent = "Unpin Tooltip";
            }

            // Update the tooltip position to current mouse position
            updateTooltip(element, e.clientX, e.clientY);

            showNotification("Element clicked - tooltip pinned");
          }

          return false;
        } else if (originalOnClick) {
          // Call the original handler if the extension is not active
          return originalOnClick.apply(this, arguments);
        }
      };
    }
  }

  // Tag filter input
  const tagFilterInput = hoverTooltip.querySelector("#xpath-tag-filter");
  if (tagFilterInput) {
    // Prevent focus from auto-pinning, but still maintain the tooltip
    tagFilterInput.addEventListener("focus", function (e) {
      e.stopPropagation();
    });

    tagFilterInput.addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent tooltip from disappearing
    });

    // Add input event for real-time filtering as user types
    tagFilterInput.addEventListener("input", function (e) {
      e.stopPropagation();

      // Update the tag filter value
      const inputValue = this.value.trim();

      // Toggle active class for styling
      if (inputValue) {
        this.classList.add("active-filter");
      } else {
        this.classList.remove("active-filter");
      }

      // Real-time update (debounced for performance)
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        // Only update if value has actually changed
        if (tagFilter !== inputValue) {
          tagFilter = inputValue;

          // Only auto-pin if user is actively filtering
          if (inputValue && !tooltipPinned) {
            tooltipPinned = true;
            const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
            if (pinButton) {
              pinButton.classList.add("pinned");
              pinButton.textContent = "Unpin Tooltip";
            }
          }

          // Update the tooltip with filtered results
          updateTooltip(
            element,
            parseInt(hoverTooltip.style.left),
            parseInt(hoverTooltip.style.top)
          );
        }
      }, 300); // 300ms debounce
    });

    // Add keydown event to handle Enter key
    tagFilterInput.addEventListener("keydown", function (e) {
      e.stopPropagation();

      if (e.key === "Enter") {
        e.preventDefault();

        // Pin the tooltip when Enter is pressed on the filter
        if (!tooltipPinned) {
          tooltipPinned = true;
          const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
          if (pinButton) {
            pinButton.classList.add("pinned");
            pinButton.textContent = "Unpin Tooltip";
          }
        }

        // Apply the filter and update the display
        tagFilter = this.value.trim();

        // Toggle active class for styling
        if (tagFilter) {
          this.classList.add("active-filter");
        } else {
          this.classList.remove("active-filter");
        }

        // Update the tooltip immediately
        updateTooltip(
          element,
          parseInt(hoverTooltip.style.left),
          parseInt(hoverTooltip.style.top)
        );

        if (tagFilter) {
          showNotification(`Filtering by "${tagFilter}"`);
        } else {
          showNotification("Filter cleared");
        }
      }
    });
  }
}

// Fallback method for copying to clipboard
function copyToClipboardFallback(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);

  try {
    // Select the text
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices

    // Execute the copy command
    const successful = document.execCommand("copy");
    showNotification(successful ? "Copied to clipboard!" : "Failed to copy");
  } catch (err) {
    console.error("Error copying to clipboard:", err);
    showNotification("Failed to copy: " + err);
  } finally {
    document.body.removeChild(textArea);
  }
}

// Initialize the extension
function init() {
  // Create the tooltip element
  hoverTooltip = createHoverTooltip();

  // Add event listener for mouseover - allow movement until pinned
  document.addEventListener("mouseover", function (e) {
    if (!isActive) return;

    // Skip updating if tooltip is pinned
    if (tooltipPinned) return;

    currentElement = e.target;
    updateTooltip(e.target, e.clientX, e.clientY);
  });

  // Add event listener for mousemove to follow the cursor smoothly
  document.addEventListener("mousemove", function (e) {
    if (
      !isActive ||
      tooltipPinned ||
      !hoverTooltip ||
      hoverTooltip.style.display === "none"
    )
      return;

    // Only update position, not content
    const tooltipHeight = hoverTooltip.offsetHeight;
    const tooltipWidth = hoverTooltip.offsetWidth;

    // Start with mouse position
    let top = e.clientY + 15;
    let left = e.clientX + 10;

    // Screen dimensions
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Ensure the tooltip doesn't go outside the viewport
    if (top + tooltipHeight > viewportHeight) {
      top = Math.max(10, viewportHeight - tooltipHeight - 10);
    }

    if (left + tooltipWidth > viewportWidth) {
      left = Math.max(10, viewportWidth - tooltipWidth - 10);
    }

    // Apply position with smooth transition
    hoverTooltip.style.transition = "top 0.1s, left 0.1s";
    hoverTooltip.style.top = `${top}px`;
    hoverTooltip.style.left = `${left}px`;
  });

  // Add window resize handler to keep tooltip in viewport
  window.addEventListener("resize", function () {
    if (!isActive || !hoverTooltip || hoverTooltip.style.display !== "block")
      return;

    // Reposition the tooltip if necessary
    repositionTooltip();
  });

  // Add scroll handler to keep tooltip visible and update highlights
  window.addEventListener(
    "scroll",
    function () {
      if (!isActive) return;

      // Update highlight positions when scrolling
      if (highlightedElements.length > 0) {
        updateAllHighlights();
      }

      // Only reposition tooltip if it's visible and pinned
      if (
        hoverTooltip &&
        hoverTooltip.style.display === "block" &&
        tooltipPinned
      ) {
        // Get current tooltip position relative to the viewport
        const rect = hoverTooltip.getBoundingClientRect();

        // Check if tooltip is now off-screen due to scrolling
        if (
          rect.bottom > window.innerHeight ||
          rect.right > window.innerWidth ||
          rect.top < 0 ||
          rect.left < 0
        ) {
          repositionTooltip();
        }
      }
    },
    { passive: true }
  );

  // Add click interceptor for links and clickable elements
  document.addEventListener(
    "click",
    function (e) {
      // Skip if the extension is not active or tooltip isn't visible
      if (!isActive || !hoverTooltip || hoverTooltip.style.display !== "block")
        return;

      // Check if we clicked inside the tooltip - let those clicks pass through
      if (hoverTooltip.contains(e.target)) {
        return;
      }

      // Check if we're clicking on a link or clickable element
      let isClickable = false;
      let targetElement = e.target;

      // Check if element or any parent is a link or interactive element
      while (targetElement && targetElement !== document) {
        const tagName = targetElement.tagName.toLowerCase();
        const isLink = tagName === "a" && targetElement.hasAttribute("href");
        const isButton =
          tagName === "button" ||
          (targetElement.hasAttribute("role") &&
            ["button", "link"].includes(targetElement.getAttribute("role")));
        const isFormControl =
          ["input", "select", "textarea"].includes(tagName) &&
          !["checkbox", "radio"].includes(targetElement.type);

        // Only intercept links and buttons, not form controls that need interaction
        if (isLink || isButton || targetElement.hasAttribute("onclick")) {
          isClickable = true;
          break;
        }

        // Don't intercept form controls - let them function normally
        if (isFormControl) {
          return;
        }

        targetElement = targetElement.parentElement;
      }

      // If it's a clickable element (link/button) and tooltip is showing
      if (isClickable && hoverTooltip.style.display === "block") {
        // Prevent default only for links and buttons, not for form elements
        e.preventDefault();
        e.stopPropagation();

        // Pin the tooltip
        if (!tooltipPinned) {
          tooltipPinned = true;
          const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
          if (pinButton) {
            pinButton.classList.add("pinned");
            pinButton.textContent = "Unpin Tooltip";
          }

          // Update tooltipPosition to current values
          tooltipPosition.x = parseInt(hoverTooltip.style.left);
          tooltipPosition.y = parseInt(hoverTooltip.style.top);

          showNotification("Clickable element detected - tooltip pinned");
        }

        // Update the tooltip with the new element
        currentElement = targetElement;
        updateTooltip(targetElement, e.clientX, e.clientY);

        return false;
      }

      // If clicked outside tooltip and not on a clickable element
      else if (hoverTooltip.style.display === "block") {
        // If it's currently pinned, unpin it
        if (tooltipPinned) {
          tooltipPinned = false;
          const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
          if (pinButton) {
            pinButton.classList.remove("pinned");
            pinButton.textContent = "Pin Tooltip";
          }
          showNotification("Tooltip unpinned - will follow mouse");
        } else {
          // If not pinned, hide it
          hoverTooltip.style.display = "none";
          removeAllHighlights();
        }
      }
    },
    true
  ); // Use capture phase

  // Add escape key handler to unpin the tooltip
  document.addEventListener("keydown", function (e) {
    // Toggle activation with Alt+X
    if (e.altKey && e.key === "x") {
      isActive = !isActive;

      if (!isActive) {
        hoverTooltip.style.display = "none";
        removeAllHighlights();
      }

      chrome.storage.local.set({ isActive });
      showNotification(
        isActive ? "XPath Finder activated" : "XPath Finder deactivated"
      );
    }

    // Escape key unpins the tooltip
    if (e.key === "Escape" && tooltipPinned) {
      tooltipPinned = false;
      const pinButton = hoverTooltip.querySelector("#xpath-toggle-pin");
      if (pinButton) {
        pinButton.classList.remove("pinned");
        pinButton.textContent = "Pin Tooltip";
      }
      showNotification("Tooltip unpinned - will follow mouse");
    }
  });

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    if (request.action === "updateSettings") {
      isActive = request.isActive;
      strictMode = request.strictMode;

      if (!isActive) {
        hoverTooltip.style.display = "none";
        removeAllHighlights();
      }

      sendResponse({ success: true });
    } else if (request.action === "testSelector") {
      const count = highlightMatchingElements(request.selector);
      sendResponse({ count: count });
    }

    return true;
  });

  // Check stored settings
  chrome.storage.local.get(["isActive", "strictMode"], function (result) {
    isActive = result.isActive !== undefined ? result.isActive : true;
    strictMode = result.strictMode !== undefined ? result.strictMode : true;
  });

  // Add a close button to the tooltip
  addCloseButton();
}

// Add a close button to the tooltip
function addCloseButton() {
  // This function will dynamically add a close button to the tooltip content in updateTooltip
}

// Reposition the tooltip to keep it within viewport bounds
function repositionTooltip() {
  if (!hoverTooltip) return;

  const tooltipHeight = hoverTooltip.offsetHeight;
  const tooltipWidth = hoverTooltip.offsetWidth;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Get current position
  let top = parseInt(hoverTooltip.style.top) || 0;
  let left = parseInt(hoverTooltip.style.left) || 0;

  // Adjust for scroll if not using position:fixed
  if (hoverTooltip.style.position !== "fixed") {
    top = top - window.scrollY;
    left = left - window.scrollX;
  }

  // Check boundaries and reposition if needed
  if (top + tooltipHeight > viewportHeight) {
    top = Math.max(10, viewportHeight - tooltipHeight - 10);
  }

  if (top < 0) {
    top = 10;
  }

  if (left + tooltipWidth > viewportWidth) {
    left = Math.max(10, viewportWidth - tooltipWidth - 10);
  }

  if (left < 0) {
    left = 10;
  }

  // Update tooltip position
  hoverTooltip.style.top = `${top}px`;
  hoverTooltip.style.left = `${left}px`;

  // Update stored position for pinned tooltips
  if (tooltipPinned) {
    tooltipPosition.x = left;
    tooltipPosition.y = top;
  }
}

// Initialize when DOM is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

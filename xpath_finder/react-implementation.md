# Converting XPath Finder to React + Tailwind CSS

This document outlines how to transform the XPath Finder extension from vanilla JavaScript to a modern React + Tailwind CSS implementation.

## Directory Structure

```
xpath-finder/
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── src/
│   ├── background/
│   │   └── index.js
│   ├── content/
│   │   ├── components/
│   │   │   ├── XPathFinder.jsx
│   │   │   ├── Tooltip.jsx
│   │   │   ├── Highlighter.jsx
│   │   │   ├── TagFilter.jsx
│   │   │   ├── SelectorList.jsx
│   │   │   ├── SelectorItem.jsx
│   │   │   └── QuickFilters.jsx
│   │   ├── hooks/
│   │   │   ├── useXPath.js
│   │   │   ├── useHighlighter.js
│   │   │   └── useStorage.js
│   │   ├── utils/
│   │   │   ├── xpath.js
│   │   │   ├── cssSelector.js
│   │   │   └── dom.js
│   │   └── index.jsx
│   └── popup/
│       ├── components/
│       │   ├── App.jsx
│       │   ├── Settings.jsx
│       │   └── RecentXPaths.jsx
│       └── index.jsx
├── package.json
├── tailwind.config.js
└── webpack.config.js
```

## Implementation Steps

### 1. Project Setup

1. Initialize a new project:

```bash
mkdir xpath-finder && cd xpath-finder
npm init -y
```

2. Install dependencies:

```bash
npm install react react-dom @headlessui/react @heroicons/react
npm install -D tailwindcss postcss autoprefixer webpack webpack-cli babel-loader
npm install -D @babel/core @babel/preset-env @babel/preset-react css-loader style-loader
npm install -D copy-webpack-plugin html-webpack-plugin
```

3. Initialize Tailwind CSS:

```bash
npx tailwindcss init -p
```

### 2. Configure Tailwind CSS

Create a `tailwind.config.js` file:

```javascript
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        secondary: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
      },
    },
  },
  plugins: [],
};
```

### 3. Core Components

#### XPathFinder.jsx (Main Component)

```jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Tooltip from "./Tooltip";
import Highlighter from "./Highlighter";
import useXPath from "../hooks/useXPath";
import useHighlighter from "../hooks/useHighlighter";
import useStorage from "../hooks/useStorage";

const XPathFinder = () => {
  const [isActive, setIsActive] = useStorage("isActive", true);
  const [strictMode, setStrictMode] = useStorage("strictMode", true);
  const [currentElement, setCurrentElement] = useState(null);
  const [tooltipPinned, setTooltipPinned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tagFilter, setTagFilter] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);

  const { generateXPathAlternatives, generateCSSSelectors } =
    useXPath(strictMode);
  const { highlightElements, removeHighlights } = useHighlighter();

  // Handle element hover
  useEffect(() => {
    if (!isActive) return;

    const handleMouseOver = (e) => {
      if (tooltipPinned) return;
      setCurrentElement(e.target);
      setShowTooltip(true);
      updateTooltipPosition(e.clientX, e.clientY);
    };

    const handleMouseMove = (e) => {
      if (!isActive || tooltipPinned || !showTooltip) return;
      updateTooltipPosition(e.clientX, e.clientY);
    };

    const handleKeydown = (e) => {
      // Toggle activation with Alt+X
      if (e.altKey && e.key === "x") {
        setIsActive(!isActive);
        if (!isActive) {
          setShowTooltip(false);
          removeHighlights();
        }
      }

      // Escape key unpins the tooltip
      if (e.key === "Escape" && tooltipPinned) {
        setTooltipPinned(false);
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [isActive, tooltipPinned, showTooltip]);

  // Handle resize and scroll
  useEffect(() => {
    if (!isActive || !showTooltip) return;

    const handleResize = () => {
      if (currentElement) {
        repositionTooltip();
      }
    };

    const handleScroll = () => {
      if (tooltipPinned && currentElement) {
        repositionTooltip();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isActive, showTooltip, tooltipPinned, currentElement]);

  const updateTooltipPosition = (mouseX, mouseY) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate tooltip position
    let x = mouseX + 10;
    let y = mouseY + 15;

    // We need to get the tooltip dimensions here
    // This is estimated since we don't have the DOM element yet
    const estimatedTooltipWidth = 400;
    const estimatedTooltipHeight = 300;

    // Check boundaries
    if (x + estimatedTooltipWidth > viewportWidth) {
      x = Math.max(10, viewportWidth - estimatedTooltipWidth - 10);
    }

    if (y + estimatedTooltipHeight > viewportHeight) {
      y = Math.max(10, viewportHeight - estimatedTooltipHeight - 10);
    }

    setTooltipPosition({ x, y });
  };

  const repositionTooltip = () => {
    // Recalculate position based on viewport
    // This would be done using refs in a complete implementation
  };

  const handleClose = () => {
    setShowTooltip(false);
    setTooltipPinned(false);
    removeHighlights();
  };

  const handlePinToggle = () => {
    setTooltipPinned(!tooltipPinned);
  };

  const handleFilterChange = (value) => {
    setTagFilter(value);
  };

  if (!isActive || !showTooltip || !currentElement) return null;

  const xpathAlternatives = generateXPathAlternatives(
    currentElement,
    tagFilter
  );
  const cssSelectors = generateCSSSelectors(currentElement, tagFilter);

  return createPortal(
    <>
      <Highlighter element={currentElement} />
      <Tooltip
        element={currentElement}
        position={tooltipPosition}
        isPinned={tooltipPinned}
        onPin={handlePinToggle}
        onClose={handleClose}
        xpathAlternatives={xpathAlternatives}
        cssSelectors={cssSelectors}
        tagFilter={tagFilter}
        onFilterChange={handleFilterChange}
      />
    </>,
    document.body
  );
};

export default XPathFinder;
```

#### Tooltip.jsx

```jsx
import React, { useRef, useEffect } from "react";
import SelectorList from "./SelectorList";
import TagFilter from "./TagFilter";
import QuickFilters from "./QuickFilters";

const Tooltip = ({
  element,
  position,
  isPinned,
  onPin,
  onClose,
  xpathAlternatives,
  cssSelectors,
  tagFilter,
  onFilterChange,
}) => {
  const tooltipRef = useRef(null);

  const handleDocumentClick = (e) => {
    // Close tooltip if clicked outside
    if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
      // If it's pinned, unpin it, otherwise close it
      if (isPinned) {
        onPin();
      } else {
        onClose();
      }
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isPinned]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[10001] bg-white rounded-lg shadow-lg p-4 max-w-[450px] max-h-[80vh] overflow-auto"
      style={{
        top: position.y + "px",
        left: position.x + "px",
        transition: "all 150ms ease-out",
      }}
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 relative">
        <div className="inline-flex items-center bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono text-xs font-medium">
          &lt;{element.tagName.toLowerCase()}&gt;
        </div>
        <button
          onClick={onClose}
          className="absolute top-0 right-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
        >
          ×
        </button>
      </div>

      <TagFilter value={tagFilter} onChange={onFilterChange} />

      {/* XPath Selectors Section */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-3 text-gray-700 flex items-center">
          XPath Options
          {tagFilter && (
            <span className="text-xs font-normal ml-2 text-indigo-600">
              ({xpathAlternatives.filter((x) => x.tagFiltered).length}/
              {xpathAlternatives.length} filtered)
            </span>
          )}
        </h3>

        <SelectorList items={xpathAlternatives} type="xpath" />
      </div>

      {/* CSS Selectors Section */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-3 text-gray-700 flex items-center">
          CSS Selectors
          {tagFilter && (
            <span className="text-xs font-normal ml-2 text-indigo-600">
              ({cssSelectors.filter((x) => x.tagFiltered).length}/
              {cssSelectors.length} filtered)
            </span>
          )}
        </h3>

        <SelectorList items={cssSelectors} type="css" />
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
        <QuickFilters
          currentTag={element.tagName.toLowerCase()}
          value={tagFilter}
          onChange={onFilterChange}
        />

        <button
          onClick={onPin}
          className={`px-3 py-1.5 text-xs font-medium flex items-center transition-all ${
            isPinned
              ? "bg-indigo-50 text-indigo-600 border-indigo-200"
              : "bg-gray-100 border-gray-200 text-gray-700"
          } border rounded`}
        >
          <span className="mr-1.5">📌</span>
          {isPinned ? "Unpin Tooltip" : "Pin Tooltip"}
        </button>
      </div>
    </div>
  );
};

export default Tooltip;
```

#### SelectorItem.jsx

```jsx
import React, { useState } from "react";

const SelectorItem = ({ item, type }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(type === "xpath" ? item.xpath : item.selector)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
  };

  const testSelector = () => {
    setIsHighlighted(!isHighlighted);
    // Code to highlight matching elements
    // In a real implementation, this would use a context or parent function
  };

  const value = type === "xpath" ? item.xpath : item.selector;

  return (
    <li
      className={`mb-3 p-3 rounded bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all ${
        item.tagFiltered
          ? "bg-indigo-50 border-l-[3px] border-l-indigo-500"
          : ""
      }`}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-medium text-gray-700 text-[13px]">
          {item.description}
        </span>
        {type === "xpath" && (
          <span className="text-[11px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
            {item.count} {item.count === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      <div className="font-mono text-xs bg-gray-100 p-2 rounded mb-2.5 overflow-x-auto break-all leading-relaxed text-gray-800">
        {value}
      </div>

      <div className="flex gap-2">
        <button
          onClick={testSelector}
          className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-all ${
            isHighlighted
              ? "bg-indigo-600 text-white border-indigo-700"
              : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300"
          }`}
        >
          Test
        </button>

        <button
          onClick={copyToClipboard}
          className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-all ${
            isCopied
              ? "bg-green-600 text-white border-green-700"
              : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300"
          }`}
        >
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>
    </li>
  );
};

export default SelectorItem;
```

### 4. Integration into Extension

#### content/index.jsx

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import XPathFinder from "./components/XPathFinder";
import "./index.css";

// Create container for React
const container = document.createElement("div");
container.id = "xpath-finder-container";
document.body.appendChild(container);

// Initialize React
const root = createRoot(container);
root.render(<XPathFinder />);
```

#### index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Any additional custom styles */
```

### 5. Extension Configuration

#### manifest.json

```json
{
  "manifest_version": 3,
  "name": "XPath Finder React",
  "version": "2.0",
  "description": "Modern XPath and CSS selector finder built with React and Tailwind",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "permissions": ["activeTab", "storage", "clipboardWrite"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Building the Project

Configure webpack to build the extension:

```javascript
// webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    popup: "./src/popup/index.jsx",
    content: "./src/content/index.jsx",
    background: "./src/background/index.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/popup/index.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: "public", to: "." }],
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx"],
  },
};
```

## Conclusion

This React + Tailwind implementation offers several advantages:

1. **Component-Based Architecture**: Better organization and reusability
2. **Modern Styling**: Tailwind CSS provides a consistent, utility-first approach
3. **State Management**: React's state management makes complex UI interactions easier
4. **Maintainability**: Easier to maintain and extend with modular code structure
5. **Developer Experience**: Better development tooling and debugging

To implement this approach, you'll need to:

1. Set up your development environment with Node.js and npm
2. Configure Webpack, Babel, and Tailwind
3. Convert the existing JavaScript into React components
4. Test thoroughly in different browsers and contexts
5. Package and publish the extension

This represents a significant refactoring of the extension but would result in a more maintainable, modern codebase that's easier to extend in the future.

# XPath Finder Chrome Extension

A powerful Chrome extension that helps you identify and work with XPath selectors for web elements.

## Features

- **Hover Detection**: Automatically identifies XPath selectors when hovering over any element on a webpage
- **Alternative XPaths**: Suggests multiple XPath patterns for each element, from highly specific to general
- **Real-time Preview**: Highlights all elements that would be matched by each suggested XPath
- **Element Count**: Shows the number of elements that would be selected by each XPath
- **One-click Copy**: Copy any suggested XPath to your clipboard with a single click
- **Visual Feedback**: Color-coded highlighting distinguishes between the current element and other matching elements
- **Toggle Matching Mode**: Switch between strict and relaxed matching to find the right balance
- **Test Interface**: Test and refine XPaths directly within the extension popup
- **Recent XPaths**: Remembers recently used XPaths for quick access

## Installation

### From Chrome Web Store (Recommended)

1. Go to the [Chrome Web Store](https://chrome.google.com/webstore/category/extensions) (Note: this extension is not yet published)
2. Search for "XPath Finder"
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and visible in your extensions list

## How to Use

1. Click the XPath Finder icon in your Chrome toolbar to open the popup
2. Enable the extension using the toggle switch if not already enabled
3. Navigate to any webpage
4. Hover over elements to see XPath suggestions in a tooltip
5. Click on any suggested XPath to highlight all matching elements
6. Click the "Copy" button to copy an XPath to your clipboard
7. Use the popup to test custom XPaths or access recently used ones

### Options

- **Enable/Disable**: Toggle the extension on/off
- **Strict Mode**: Generate more specific XPaths when enabled
- **XPath Testing**: Enter custom XPaths to test directly from the popup

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `background.js`: Background script for extension lifecycle events
- `content.js`: Content script for webpage interaction
- `content.css`: Styles for the content script
- `popup.html`: Extension popup UI
- `popup.js`: JavaScript for the popup

### Building from Source

1. Clone this repository
2. Make any desired changes to the code
3. Load the unpacked extension as described in the manual installation section

## Contributing

Contributions are welcome! If you have any suggestions, bug reports, or feature requests, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

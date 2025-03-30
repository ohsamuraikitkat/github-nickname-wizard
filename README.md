# GitHub Nickname Wizard

A browser extension that enhances GitHub by adding nicknames to usernames, making it easier to identify and recognize people in your workflow.

---

## ✨ Features

**Core Functionality:**
* Display nicknames across GitHub:
  * Organization People lists
  * Team member listings
  * Project board avatar tooltips
  * Repository Issue lists and avatar hovers
  * Repository Pull Request lists and avatar tooltips
  * Inside Issues and Pull Requests

**Management Features:**
* Easy management of nicknames (add, edit, delete)
* Import/Export capabilities: Save your nickname mappings to a JSON file and import them later
* Strict Mode: Restrict the extension to only run on trusted URLs with support for wildcards and regex patterns

---

## 🚀 Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory

---

## 🧩 Usage

**Adding Nicknames:**
1. Click the extension icon in your browser toolbar to open the popup
2. Enter a GitHub username (without the `@` symbol)
3. Enter your preferred nickname (e.g., "John Doe")
4. Click the "Add" button

**Import/Export Settings:**
1. Click "Export Settings" to save your current nicknames, custom sort order, and theme to a `config.json` file
2. To import, click the file input area, select a previously exported JSON file, and click "Import Settings"

**Configuring Strict Mode:**
1. Enable Strict Mode by toggling the checkbox in the "Strict Mode Settings" section of the popup UI
2. Enter trusted URL patterns in the input field. Supported formats include:
    * Exact match: `https://github.com/your-org/repo-name`
    * Wildcard: `https://github.com/your-org/*`
    * Regular expression: `regex:github\.com\/your-org\/[^/]+\/issues`
3. Click the "Add" button to add the pattern to your trusted list
4. Patterns are displayed in a list and can be removed when no longer needed

---

## 🛠️ Extension Structure

```
github-nickname-wizard/
├── manifest.json      # Chrome extension manifest file
├── content.js         # Script that modifies the GitHub DOM to inject nicknames
├── popup.html         # Popup UI for the extension icon
├── popup.js           # Logic for the popup UI
├── config.json        # Configuration file (when used for default settings)
└── icon.png           # Extension icon image
```

---

## ⚙️ Technical Design

* Directly modifies the DOM to add display names to GitHub interfaces
* Prevents duplicate replacements by adding `data-*` attributes (e.g., `data-nickname-injected`) to processed elements
* Uses `MutationObserver` to monitor page content changes and process dynamically loaded elements
* Stores name mappings and settings in `chrome.storage.local`
* Provides an intuitive popup UI for managing nicknames and settings
* In Strict Mode, checks if the current URL matches registered patterns and only displays nicknames on matching pages
* Supports three URL matching methods: exact match, wildcard patterns, and regular expressions

---

## 📝 Release History

### v1.1.0 (2025-03-30)
* Added Strict Mode to limit extension operation to trusted URLs only
* Implemented URL pattern matching with support for exact matches, wildcards, and regular expressions
* Extended import/export functionality to include Strict Mode settings

### v1.0.0 (2025-03-30)
* Initial release with core functionality

---

## ⚠️ Important Notes

* Display names are stored locally in your browser and are **never** shared with or visible to other users
* Changes to GitHub's website structure may temporarily affect the extension's functionality. We'll provide updates to adapt to such changes when possible.

---

## 📄 License

This project is licensed under the MIT License.

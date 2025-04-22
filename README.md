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
  * **Assignee dropdown menus** in issue sidebar

**Management Features:**
* Nickname addition methods:
  * Add through the extension popup UI
  * **Context menu direct registration**: Easily register nicknames by right-clicking on selected usernames on GitHub
  * **One-click registration from user cards**: Add nicknames directly via the "Add nickname" button that appears on user profile hover cards
* Easy management of existing nicknames (edit, delete)
* Import/Export capabilities: Save your nickname mappings to a JSON file and import them later
* Gist Synchronization: Share your nickname settings with team members via GitHub Gist and keep settings synchronized
* Strict Mode: Restrict the extension to only run on trusted URLs with support for wildcards and regex patterns

---

## 🚀 Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory

---

## 🧩 Usage

**Adding Nicknames (via popup):**
1. Click the extension icon in your browser toolbar to open the popup
2. Enter a GitHub username (without the `@` symbol)
3. Enter your preferred nickname (e.g., "John Doe")
4. Click the "Add" button

**Adding Nicknames (via context menu):**
1. Select any GitHub username on a page (with or without the `@` symbol)
2. Right-click on the selected text and choose "Register nickname for this username"
3. Enter a nickname in the popup window that appears (the user's real name is automatically suggested from their GitHub profile if available)
4. Click the "Save" button

**Import/Export Settings:**
1. Click "Export Settings" to save your current nicknames, custom sort order, and theme to a `config.json` file
2. To import, click the file input area, select a previously exported JSON file, and click "Import Settings"

**Gist Synchronization:**
1. Click the extension icon in your browser toolbar to open the popup
2. Go to the "Gist Sync Settings" section
3. Create a GitHub Gist that contains your settings (you can export your settings first and use that content)
4. Enter the Gist ID in the input field (the alphanumeric part from the Gist URL)
5. Click "Sync Now" to synchronize your settings
6. Optionally enable "Automatic synchronization" to keep your settings in sync automatically
7. Share the Gist ID with your team members who can then use it to sync the same settings

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
├── background.js      # Background script (context menu handling, etc.)
├── content.js         # Script that modifies the GitHub DOM to inject nicknames
├── popup.html         # Popup UI for the extension icon
├── popup.js           # Logic for the popup UI
├── quick-add.html     # Quick add UI triggered from context menu
├── quick-add.js       # Logic for the quick add UI
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
* Context menu implementation allows for quick username registration right from GitHub pages
* Leverages GitHub's public API to automatically suggest real names for users as nickname candidates
* In Strict Mode, checks if the current URL matches registered patterns and only displays nicknames on matching pages
* Supports three URL matching methods: exact match, wildcard patterns, and regular expressions
* Enhanced security with proper Content Security Policy implementation for Manifest V3 compliance

---

## 📝 Release History

### v1.3.0 (2025-04-22)
* Added nickname display in assignee dropdown menus in issue/PR sidebar
* Improved DOM detection for better compatibility with GitHub UI changes
* Optimized console logging for cleaner browser developer tools experience

### v1.2.0 (2025-03-30)
* Added context menu functionality for direct nickname registration
* Implemented automatic real name suggestion using GitHub's public API
* Enhanced security with Content Security Policy compliance for Manifest V3

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

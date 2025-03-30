# GitHub Nickname Wizard

A simple Chrome extension to customize how GitHub usernames are displayed in your browser.

Replace GitHub usernames with nicknames you set, making it easier to identify users at a glance.

---

## ✨ Features

*   **Display Nicknames in Various Locations:**
    *   Organization's People list
    *   Team members list
    *   Project board avatar tooltips
    *   Repository Issue list (including avatar hover)
    *   Repository Pull Request list (including avatar tooltips)
    *   Inside Issues and Pull Requests
*   **Easy Nickname Management:**
    *   Add, edit, and delete nicknames easily via the popup.
*   **Import/Export Settings:**
    *   Export your nickname list (and other settings like sort order, theme) to a JSON file.
    *   Import settings from a previously saved JSON file.
    *   (The popup also includes features like search, sorting, bulk delete, and themes.)

---

## 🚀 Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and go to `chrome://extensions/`.
3.  Enable "Developer mode" (usually a toggle in the top right).
4.  Click "Load unpacked" and select the extension's directory.

---

## 🧩 Usage

**Adding a Nickname:**
1.  Click the extension icon in your browser toolbar to open the popup.
2.  Enter the GitHub username (without the `@`).
3.  Enter the desired nickname (e.g., "John Doe").
4.  Click the "Add" button.

**Import/Export:**
1.  Click "Export Settings" in the popup to save your current settings to a JSON file.
2.  To load settings, click the file input area, select your saved JSON file, and click "Import Settings".

---

## 🛠️ How It Works (Briefly)

*   The extension directly modifies the GitHub page content (DOM) to insert nicknames.
*   It uses `data-*` attributes on elements to avoid applying nicknames multiple times.
*   It uses `MutationObserver` to detect page changes and apply nicknames to dynamically loaded content.
*   Nickname mappings and settings are stored locally in your browser using `chrome.storage.local`.

---

## ⚠️ Notes

*   Nicknames are stored **locally** in your browser. They are **not** shared and **cannot** be seen by other users.
*   If GitHub changes its website structure, the extension might temporarily stop working correctly. We will try to provide updates to adapt to such changes when possible.

---

## 📄 License

This project is licensed under the MIT License. 
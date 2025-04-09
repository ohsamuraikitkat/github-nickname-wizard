// i18n関数へのショートカット
const i18n = window.i18n;

const listDiv = document.getElementById('list');
const usernameInput = document.getElementById('username');
const nicknameInput = document.getElementById('nickname');
const addButton = document.getElementById('add');
const filterInput = document.getElementById('filterInput');
const clearFilterButton = document.getElementById('clearFilter');
const toggleCustomSortButton = document.getElementById('toggleCustomSort');
const saveCustomOrderButton = document.getElementById('saveCustomOrder');

// 厳格モード関連の要素
const strictModeToggle = document.getElementById('strictModeToggle');
const strictModeControls = document.getElementById('strictModeControls');
const urlPatternInput = document.getElementById('urlPattern');
const addUrlPatternButton = document.getElementById('addUrlPattern');
const urlPatternsList = document.getElementById('urlPatternsList');

// ユーザーカードボタン設定関連の要素
const userCardButtonToggle = document.getElementById('userCardButtonToggle');

// Gist同期関連の要素
const gistIdInput = document.getElementById('gistIdInput');
const syncWithGistButton = document.getElementById('syncWithGist');
const autoSyncToggle = document.getElementById('autoSyncToggle');
const lastSyncTimeElement = document.getElementById('lastSyncTime');
const syncStatusMessageElement = document.getElementById('syncStatusMessage');

// 言語セレクター関連の要素（DOMContentLoadedで取得するよう変更）
let languageSelectorContainer;

// Gist設定を管理
let gistSettings = {
  gistId: '',
  lastSyncTimestamp: null,
  autoSync: {
    enabled: false,
    lastCheck: null
  }
};

// ソート状態を管理
let sortState = {
  column: 'username',
  direction: 'asc',
  isCustom: false
};

// フィルター状態を管理
let filterState = {
  text: ''
};

// カスタムソート順を管理
let customOrder = [];

// 厳格モードの設定を管理
let strictModeSettings = {
  enabled: false,
  urlPatterns: []
};

// ユーザーカードボタンの設定を管理
let userCardButtonSettings = {
  enabled: true
};

// テーマ関連の要素
const lightThemeButton = document.getElementById('lightTheme');
const darkThemeButton = document.getElementById('darkTheme');

function filterEntries(entries) {
  if (!filterState.text) return entries;
  
  const searchText = filterState.text.toLowerCase();
  return entries.filter(([username, nickname]) =>
    username.toLowerCase().includes(searchText) ||
    nickname.toLowerCase().includes(searchText)
  );
}

function renderList(mapping) {
  if (!mapping || Object.keys(mapping).length === 0) {
    listDiv.innerHTML = `<div class="empty-state">${i18n.getMessage('no_nicknames')}</div>`;
    return;
  }

  // マッピングを配列に変換
  let entries = Object.entries(mapping);

  // フィルター適用
  entries = filterEntries(entries);

  // ソート適用
  if (!sortState.isCustom) {
    entries.sort((a, b) => {
      const [usernameA, nicknameA] = a;
      const [usernameB, nicknameB] = b;
      
      if (sortState.column === 'username') {
        return sortState.direction === 'asc' 
          ? usernameA.localeCompare(usernameB)
          : usernameB.localeCompare(usernameA);
      } else {
        return sortState.direction === 'asc'
          ? nicknameA.localeCompare(nicknameB)
          : nicknameB.localeCompare(nicknameA);
      }
    });
  } else if (customOrder.length > 0) {
    // カスタムソート順を適用
    entries.sort((a, b) => {
      const [usernameA] = a;
      const [usernameB] = b;
      const indexA = customOrder.indexOf(usernameA);
      const indexB = customOrder.indexOf(usernameB);
      return indexA - indexB;
    });
  }

  const table = document.createElement('table');
  table.className = 'mappings-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th class="checkbox-cell">
          <input type="checkbox" id="selectAll">
        </th>
        ${sortState.isCustom ? '<th></th>' : ''}
        <th class="sortable" data-column="username">
          ${i18n.getMessage('github_username')}
          <span class="sort-icon">${!sortState.isCustom && sortState.column === 'username' ? (sortState.direction === 'asc' ? '↑' : '↓') : ''}</span>
        </th>
        <th class="sortable" data-column="nickname">
          ${i18n.getMessage('display_nickname')}
          <span class="sort-icon">${!sortState.isCustom && sortState.column === 'nickname' ? (sortState.direction === 'asc' ? '↑' : '↓') : ''}</span>
        </th>
        <th>${i18n.getMessage('actions')}</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map(([username, nickname]) => `
        <tr data-username="${username}">
          <td class="checkbox-cell">
            <input type="checkbox" class="row-checkbox" data-username="${username}">
          </td>
          ${sortState.isCustom ? `<td class="drag-handle">⋮</td>` : ''}
          <td>@${username}</td>
          <td>
            <span class="nickname-display">${nickname}</span>
            <input type="text" class="nickname-edit" value="${nickname}" style="display: none;">
          </td>
          <td class="action-buttons">
            <button class="edit-btn success" data-username="${username}">${i18n.getMessage('edit_button')}</button>
            <button class="delete-btn danger" data-username="${username}">${i18n.getMessage('delete_button')}</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;

  // 一括削除ボタンのコンテナを作成
  const bulkActionsContainer = document.createElement('div');
  bulkActionsContainer.className = 'bulk-actions';
  bulkActionsContainer.innerHTML = `
    <button id="bulkDeleteBtn">${i18n.getMessage('delete_selected')}</button>
  `;

  listDiv.innerHTML = '';
  listDiv.appendChild(table);
  listDiv.appendChild(bulkActionsContainer);

  // 全選択チェックボックスのイベントリスナー
  const selectAllCheckbox = table.querySelector('#selectAll');
  const rowCheckboxes = table.querySelectorAll('.row-checkbox');
  
  selectAllCheckbox.addEventListener('change', (e) => {
    rowCheckboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
    updateBulkActionsVisibility();
  });

  // 個別チェックボックスのイベントリスナー
  rowCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateBulkActionsVisibility();
      // すべてのチェックボックスが選択されているか確認
      const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
      selectAllCheckbox.checked = allChecked;
    });
  });

  // 一括削除ボタンのイベントリスナー
  const bulkDeleteBtn = bulkActionsContainer.querySelector('#bulkDeleteBtn');
  bulkDeleteBtn.addEventListener('click', () => {
    const selectedUsernames = Array.from(rowCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute('data-username'));

    if (selectedUsernames.length === 0) return;

    if (confirm(i18n.getMessage('confirm_bulk_delete', [selectedUsernames.length, selectedUsernames.map(username => `@${username}`).join('\n')]))) {
      chrome.storage.local.get('nameMapping', (data) => {
        const mapping = data.nameMapping || {};
        selectedUsernames.forEach(username => {
          delete mapping[username];
        });
        chrome.storage.local.set({ nameMapping: mapping }, render);
      });
    }
  });

  // カスタムソートモードの場合、ドラッグ&ドロップを有効化
  if (sortState.isCustom) {
    setupDragAndDrop(table);
  }

  // ソート機能のイベントリスナー
  if (!sortState.isCustom) {
    table.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', () => {
        const column = header.getAttribute('data-column');
        if (sortState.column === column) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.column = column;
          sortState.direction = 'asc';
        }
        renderList(mapping);
      });
    });
  }

  // 編集ボタンのイベントリスナー
  table.querySelectorAll('.edit-btn').forEach(editBtn => {
    const row = editBtn.closest('tr');
    const nicknameDisplay = row.querySelector('.nickname-display');
    const nicknameEdit = row.querySelector('.nickname-edit');
    const username = editBtn.getAttribute('data-username');

    editBtn.addEventListener('click', () => {
      if (nicknameDisplay.style.display === 'none') {
        const newNickname = nicknameEdit.value.trim();
        if (newNickname) {
          chrome.storage.local.get('nameMapping', (data) => {
            const mapping = data.nameMapping || {};
            mapping[username] = newNickname;
            chrome.storage.local.set({ nameMapping: mapping }, () => {
              nicknameDisplay.textContent = newNickname;
              nicknameDisplay.style.display = 'inline';
              nicknameEdit.style.display = 'none';
              editBtn.textContent = i18n.getMessage('edit_button');
              renderList(mapping);
            });
          });
        }
      } else {
        nicknameDisplay.style.display = 'none';
        nicknameEdit.style.display = 'inline';
        editBtn.textContent = i18n.getMessage('save_button');
      }
    });
  });

  // 削除ボタンのイベントリスナー
  table.querySelectorAll('.delete-btn').forEach(deleteBtn => {
    deleteBtn.addEventListener('click', () => {
      const username = deleteBtn.getAttribute('data-username');
      if (confirm(i18n.getMessage('confirm_delete', [username]))) {
        chrome.storage.local.get('nameMapping', (data) => {
          const mapping = data.nameMapping || {};
          delete mapping[username];
          chrome.storage.local.set({ nameMapping: mapping }, render);
        });
      }
    });
  });
}

function setupDragAndDrop(table) {
  const tbody = table.querySelector('tbody');
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    row.draggable = true;
    row.addEventListener('dragstart', () => {
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingRow = tbody.querySelector('.dragging');
      if (draggingRow && draggingRow !== row) {
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          tbody.insertBefore(draggingRow, row);
        } else {
          tbody.insertBefore(draggingRow, row.nextSibling);
        }
      }
    });
  });
}

function updateBulkActionsVisibility() {
  const bulkActionsContainer = document.querySelector('.bulk-actions');
  const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
  bulkActionsContainer.classList.toggle('visible', checkedBoxes.length > 0);
}

// URLパターンリストの描画関数
function renderUrlPatterns() {
  if (!strictModeSettings.urlPatterns || strictModeSettings.urlPatterns.length === 0) {
    urlPatternsList.innerHTML = `
      <div class="url-patterns-empty">
        ${i18n.getMessage('no_url_patterns')}
      </div>
    `;
    return;
  }

  urlPatternsList.innerHTML = strictModeSettings.urlPatterns
    .map((pattern, index) => `
      <div class="url-pattern-item">
        <div class="url-pattern-text">${pattern}</div>
        <button class="url-pattern-delete" data-index="${index}">×</button>
      </div>
    `)
    .join('');

  // 削除ボタンのイベントリスナーを追加
  urlPatternsList.querySelectorAll('.url-pattern-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      strictModeSettings.urlPatterns.splice(index, 1);
      saveStrictModeSettings();
      renderUrlPatterns();
    });
  });
}

// 厳格モード設定の保存
function saveStrictModeSettings() {
  chrome.storage.local.set({ strictMode: strictModeSettings }, () => {
    // 設定が保存されたことをコンテンツスクリプトに通知
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'strictModeUpdated',
          settings: strictModeSettings
        });
      }
    });
  });
}

// URLパターンの検証
function validateUrlPattern(pattern) {
  // 空のパターンをチェック
  if (!pattern || pattern.trim() === '') {
    return {
      isValid: false,
      error: i18n.getMessage('error_url_pattern_empty')
    };
  }
  
  // 最大長をチェック
  if (pattern.length > 1000) {
    return {
      isValid: false,
      error: i18n.getMessage('error_url_pattern_length')
    };
  }

  // 正規表現パターンをチェック
  if (pattern.startsWith('regex:')) {
    try {
      const regexPart = pattern.substring(6);
      new RegExp(regexPart);
    } catch (error) {
      return {
        isValid: false,
        error: i18n.getMessage('error_invalid_regex', [error.message])
      };
    }
  }

  return {
    isValid: true,
    sanitized: pattern.trim()
  };
}

// フィルター機能のイベントリスナー
filterInput.addEventListener('input', (e) => {
  filterState.text = e.target.value;
  render();
});

clearFilterButton.addEventListener('click', () => {
  filterInput.value = '';
  filterState.text = '';
  render();
});

// カスタムソート機能のイベントリスナー
toggleCustomSortButton.addEventListener('click', () => {
  sortState.isCustom = !sortState.isCustom;
  toggleCustomSortButton.textContent = sortState.isCustom ? i18n.getMessage('normal_sort') : i18n.getMessage('custom_sort');
  saveCustomOrderButton.classList.toggle('active', sortState.isCustom);
  
  if (sortState.isCustom) {
    // 現在の順序をカスタム順序として保存
    const rows = listDiv.querySelectorAll('tbody tr');
    customOrder = Array.from(rows).map(row => row.getAttribute('data-username'));
  } else {
    // 通常ソートに戻す際にソート状態をリセット
    sortState.column = 'username';
    sortState.direction = 'asc';
  }
  
  render();
});

saveCustomOrderButton.addEventListener('click', () => {
  const rows = listDiv.querySelectorAll('tbody tr');
  customOrder = Array.from(rows).map(row => row.getAttribute('data-username'));
  
  // カスタム順序をストレージに保存
  chrome.storage.local.set({ customOrder }, () => {
    alert(i18n.getMessage('order_saved'));
  });
});

// 厳格モードの切り替え
strictModeToggle.addEventListener('change', () => {
  strictModeSettings.enabled = strictModeToggle.checked;
  saveStrictModeSettings();
});

// URLパターンの追加
addUrlPatternButton.addEventListener('click', () => {
  const pattern = urlPatternInput.value.trim();
  const validation = validateUrlPattern(pattern);
  
  if (!validation.isValid) {
    alert(validation.error);
    return;
  }
  
  // 重複チェック
  if (strictModeSettings.urlPatterns.includes(validation.sanitized)) {
    alert(i18n.getMessage('error_duplicate_pattern'));
    return;
  }
  
  strictModeSettings.urlPatterns.push(validation.sanitized);
  saveStrictModeSettings();
  renderUrlPatterns();
  
  // 入力欄をクリア
  urlPatternInput.value = '';
});

// セキュリティ検証用の関数
function sanitizeNickname(name) {
  // HTMLタグを除去
  name = name.replace(/<[^>]*>/g, '');
  
  // 特殊文字をエスケープ
  name = name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return name;
}

function validateNickname(name) {
  // 空文字チェック
  if (!name || name.trim() === '') {
    return {
      isValid: false,
      error: i18n.getMessage('error_nickname_empty')
    };
  }

  // 長さチェック（最大100文字）
  if (name.length > 100) {
    return {
      isValid: false,
      error: i18n.getMessage('error_nickname_length')
    };
  }

  // 危険な文字パターンのチェック
  const dangerousPatterns = [
    /<script>/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+=/i,
    /eval\s*\(/i,
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /XMLHttpRequest/i,
    /fetch\s*\(/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      return {
        isValid: false,
        error: i18n.getMessage('error_nickname_content')
      };
    }
  }

  return {
    isValid: true,
    sanitized: sanitizeNickname(name)
  };
}

// マッピング追加のイベントリスナー
document.getElementById('add').addEventListener('click', () => {
  const username = document.getElementById('username').value.trim();
  const nickname = document.getElementById('nickname').value.trim();

  // 表示名の検証
  const validation = validateNickname(nickname);
  if (!validation.isValid) {
    alert(validation.error);
    return;
  }

  const sanitizedNickname = validation.sanitized;

  if (!username) {
    alert(i18n.getMessage('error_username_empty'));
    return;
  }

  chrome.storage.local.get('nameMapping', (data) => {
    const mapping = data.nameMapping || {};
    mapping[username] = sanitizedNickname;
    chrome.storage.local.set({ nameMapping: mapping }, () => {
      document.getElementById('username').value = '';
      document.getElementById('nickname').value = '';
      renderList(mapping);
    });
  });
});

// テーマの初期化
chrome.storage.local.get('theme', (data) => {
  const theme = data.theme || 'light';
  setTheme(theme);
});

// テーマ切り替えのイベントリスナー
lightThemeButton.addEventListener('click', () => {
  setTheme('light');
  chrome.storage.local.set({ theme: 'light' });
});

darkThemeButton.addEventListener('click', () => {
  setTheme('dark');
  chrome.storage.local.set({ theme: 'dark' });
});

// テーマ設定関数
function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  lightThemeButton.classList.toggle('active', theme === 'light');
  darkThemeButton.classList.toggle('active', theme === 'dark');
}

// 設定のエクスポート
document.getElementById('exportPreset').addEventListener('click', async () => {
  try {
    const { nameMapping, customOrder, theme, strictMode, language } = await new Promise(resolve => {
      chrome.storage.local.get(['nameMapping', 'customOrder', 'theme', 'strictMode', 'language'], resolve);
    });

    const preset = {
      version: '1.0',
      mappings: nameMapping || {},
      customOrder: customOrder || [],
      theme: theme || 'light',
      strictMode: strictMode || { enabled: false, urlPatterns: [] },
      language: language || 'auto'
    };

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'github-nickname-wizard-settings.json';
    a.click();
    URL.revokeObjectURL(url);

    alert(i18n.getMessage('settings_exported'));
  } catch (error) {
    alert(i18n.getMessage('error_export', [error.message]));
  }
});

// 設定の読み込み
document.getElementById('loadPreset').addEventListener('click', async () => {
  const fileInput = document.getElementById('presetFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert(i18n.getMessage('error_file_select'));
    return;
  }

  try {
    const text = await file.text();
    const preset = JSON.parse(text);

    // バージョンチェック
    if (!preset.version || !preset.mappings) {
      throw new Error(i18n.getMessage('error_import_format'));
    }

    // マッピングの検証とサニタイズ
    const sanitizedMappings = {};
    for (const [username, nickname] of Object.entries(preset.mappings)) {
      const validation = validateNickname(nickname);
      if (!validation.isValid) {
        throw new Error(i18n.getMessage('error_import_nickname', [username, validation.error]));
      }
      sanitizedMappings[username] = validation.sanitized;
    }

    // マッピングの更新
    await new Promise(resolve => {
      chrome.storage.local.set({ nameMapping: sanitizedMappings }, resolve);
    });

    // カスタム順序の更新
    if (preset.customOrder) {
      await new Promise(resolve => {
        chrome.storage.local.set({ customOrder: preset.customOrder }, resolve);
      });
    }

    // テーマの更新
    if (preset.theme) {
      await new Promise(resolve => {
        chrome.storage.local.set({ theme: preset.theme }, resolve);
      });
      setTheme(preset.theme);
    }

    // 厳格モード設定の更新
    if (preset.strictMode) {
      strictModeSettings = preset.strictMode;
      await new Promise(resolve => {
        chrome.storage.local.set({ strictMode: strictModeSettings }, resolve);
      });
      strictModeToggle.checked = strictModeSettings.enabled;
      renderUrlPatterns();
    }

    // 言語設定の更新
    if (preset.language) {
      await new Promise(resolve => {
        chrome.storage.local.set({ language: preset.language }, resolve);
      });
    }

    // リストを更新
    renderList(sanitizedMappings);
    alert(i18n.getMessage('settings_imported'));
  } catch (error) {
    alert(i18n.getMessage('error_import', [error.message]));
  }
});

function render() {
  chrome.storage.local.get('nameMapping', (data) => {
    renderList(data.nameMapping || {});
  });
}

// ストレージから最新のニックネームデータを取得し、リストを更新する関数
async function refreshNameMappingList() {
  try {
    // 最新のデータを取得
    const { nameMapping } = await new Promise(resolve => {
      chrome.storage.local.get(['nameMapping'], resolve);
    });
    
    // リストを更新
    renderList(nameMapping || {});
    
    return true;
  } catch (error) {
    console.error('ニックネームリストの更新に失敗:', error);
    return false;
  }
}

// ユーザーカードボタンの切り替え
userCardButtonToggle.addEventListener('change', () => {
  userCardButtonSettings.enabled = userCardButtonToggle.checked;
  saveUserCardButtonSettings();
});

// ユーザーカードボタン設定の保存
function saveUserCardButtonSettings() {
  chrome.storage.local.set({ userCardButtonSettings }, () => {
    // 設定が保存されたことをコンテンツスクリプトに通知
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'userCardButtonSettingsUpdated',
          settings: userCardButtonSettings
        });
      }
    });
  });
}

// 言語セレクタを設定
async function setupLanguageSelector() {
  try {
    // 言語セレクタコンテナを取得
    languageSelectorContainer = document.getElementById('language-selector-container');
    if (!languageSelectorContainer) {
      console.error('Language selector container not found');
      return;
    }

    // 利用可能な言語のリスト（_localesディレクトリ内の言語）
    const availableLocales = ['en', 'ja']; // 将来的に言語が追加されたらここを拡張
    
    // 現在の言語を取得
    const currentLocale = await window.i18n.getCurrentLocale();
    console.log('Current locale:', currentLocale);
    
    // 言語セレクタを作成
    const selector = i18n.createLanguageSelector(availableLocales, currentLocale);
    
    // セレクタのスタイル設定
    selector.style.width = '100%';
    selector.style.padding = '8px';
    selector.style.marginTop = '8px';
    selector.style.borderRadius = '4px';
    selector.style.border = '1px solid var(--border-color)';
    
    // コンテナに追加（既存の内容をクリア）
    languageSelectorContainer.innerHTML = '';
    languageSelectorContainer.appendChild(selector);
    
    console.log('Language selector setup complete');
  } catch (error) {
    console.error('Error setting up language selector:', error);
  }
}

// 多言語化とUIの初期化
// 直接言語を変更する関数
function changeLanguage(newLocale) {
  console.log(`直接言語を変更: ${newLocale}`);
  
  // ローカルストレージに保存
  chrome.storage.local.set({ language: newLocale }, () => {
    // 拡張機能をリロード
    window.location.reload();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  
  // すべての設定を一度に取得
  chrome.storage.local.get(['nameMapping', 'customOrder', 'theme', 'strictMode', 'language', 'gistSettings', 'userCardButtonSettings'], (data) => {
    console.log('読み込まれた設定:', data);
    
    // マッピングデータを読み込んでレンダリング
    if (data.nameMapping) {
      renderList(data.nameMapping);
    } else {
      // 初回表示時に空のリストを表示
      renderList({});
    }
    
    // カスタム順序の設定
    if (data.customOrder) {
      customOrder = data.customOrder;
    }
    
    // テーマの設定（すでに setTheme 関数が別の場所で呼ばれているので削除）
    
    // 厳格モード設定の読み込み
    if (data.strictMode) {
      strictModeSettings = data.strictMode;
      strictModeToggle.checked = strictModeSettings.enabled;
      renderUrlPatterns();
    }
    
    // ユーザーカードボタン設定の読み込み
    if (data.userCardButtonSettings) {
      userCardButtonSettings = data.userCardButtonSettings;
      userCardButtonToggle.checked = userCardButtonSettings.enabled;
    }
    
    // Gist設定の読み込み
    if (data.gistSettings) {
      gistSettings = data.gistSettings;
      // Gist UI の初期化
      initGistUI();
    } else {
      // Gist設定がない場合でもUIは初期化
      initGistUI();
    }
    
    // 現在の言語を確認
    const currentLanguage = data.language || 'auto';
    console.log(`現在の言語設定: ${currentLanguage}`);
    
    // 多言語化を適用
    i18n.localizeDocument();
    
    // 動的に追加される要素の多言語化を設定
    i18n.setupDynamicLocalization();
    
    // 言語セレクタを設定
    setupLanguageSelector().catch(err => {
      console.error('Failed to set up language selector:', err);
    });
    
    // 言語セレクタが設定された後に手動で言語セレクタの値を設定
    setTimeout(() => {
      const languageSelector = document.getElementById('language-selector');
      if (languageSelector) {
        languageSelector.value = currentLanguage;
        
        // イベントリスナを再設定
        languageSelector.addEventListener('change', (e) => {
          changeLanguage(e.target.value);
        });
      }
    }, 100);
  });
});

// 最終同期時間の表示を更新
function updateLastSyncTime() {
  if (gistSettings.lastSyncTimestamp) {
    const date = new Date(gistSettings.lastSyncTimestamp);
    const formattedDate = new Intl.DateTimeFormat(navigator.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    
    lastSyncTimeElement.textContent = i18n.getMessage('last_synced', [formattedDate]) || `最終同期: ${formattedDate}`;
  } else {
    lastSyncTimeElement.textContent = i18n.getMessage('last_synced_never') || '最終同期: なし';
  }
}

// 自動同期設定の保存
function saveAutoSyncSettings() {
  chrome.storage.local.set({
    gistSettings: {
      ...gistSettings,
      autoSync: {
        ...gistSettings.autoSync,
        enabled: autoSyncToggle.checked
      }
    }
  });
}

// Gist関連UIの初期化
function initGistUI() {
  // Gist IDの設定
  if (gistSettings.gistId) {
    gistIdInput.value = gistSettings.gistId;
  }
  
  // 自動同期トグルの設定
  autoSyncToggle.checked = gistSettings.autoSync?.enabled || false;
  
  // 最終同期時間の更新
  updateLastSyncTime();
  
  // 手動同期ボタンのイベントリスナー
  syncWithGistButton.addEventListener('click', syncWithGistAction);
  
  // 自動同期トグルのイベントリスナー
  autoSyncToggle.addEventListener('change', saveAutoSyncSettings);
}

// Gist同期処理
async function syncWithGistAction() {
  try {
    // Gist IDを取得して設定
    const gistId = gistIdInput.value.trim();
    if (!gistId) {
      throw new Error(i18n.getMessage('error_gist_id_empty') || 'Gist IDを入力してください');
    }
    
    // 同期処理中のUI状態を更新
    syncWithGistButton.disabled = true;
    syncStatusMessageElement.textContent = i18n.getMessage('syncing') || '同期中...';
    
    // Gist設定を更新
    gistSettings.gistId = gistId;
    
    // バックグラウンドスクリプトに同期リクエスト送信
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'syncWithGist', gistId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || i18n.getMessage('sync_error_unknown') || '同期エラー');
    }
    
    // 設定を更新
    gistSettings.lastSyncTimestamp = new Date().toISOString();
    
    // 保存して、自動同期の設定も適用
    await new Promise(resolve => {
      chrome.storage.local.set({ 
        gistSettings: gistSettings
      }, resolve);
    });
    
    // 同期成功メッセージ
    syncStatusMessageElement.textContent = i18n.getMessage('sync_success') || '同期が完了しました';
    updateLastSyncTime();
    
    // 最新のデータで確実にリストを更新
    await refreshNameMappingList();
  } catch (error) {
    console.error('Gist同期エラー:', error);
    syncStatusMessageElement.textContent = i18n.getMessage('sync_error', [error.message]) || `同期エラー: ${error.message}`;
  } finally {
    syncWithGistButton.disabled = false;
  }
}

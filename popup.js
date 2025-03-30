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
    listDiv.innerHTML = '<div class="empty-state">No nicknames configured</div>';
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
          GitHub Username
          <span class="sort-icon">${!sortState.isCustom && sortState.column === 'username' ? (sortState.direction === 'asc' ? '↑' : '↓') : ''}</span>
        </th>
        <th class="sortable" data-column="nickname">
          Display Nickname
          <span class="sort-icon">${!sortState.isCustom && sortState.column === 'nickname' ? (sortState.direction === 'asc' ? '↑' : '↓') : ''}</span>
        </th>
        <th>Actions</th>
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
            <button class="edit-btn success" data-username="${username}">Edit</button>
            <button class="delete-btn danger" data-username="${username}">Del</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;

  // 一括削除ボタンのコンテナを作成
  const bulkActionsContainer = document.createElement('div');
  bulkActionsContainer.className = 'bulk-actions';
  bulkActionsContainer.innerHTML = `
    <button id="bulkDeleteBtn">Delete Selected Items</button>
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

    if (confirm(`Are you sure you want to delete ${selectedUsernames.length} nickname(s)?\n\n${selectedUsernames.map(username => `@${username}`).join('\n')}`)) {
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
              editBtn.textContent = 'Edit';
              renderList(mapping);
            });
          });
        }
      } else {
        nicknameDisplay.style.display = 'none';
        nicknameEdit.style.display = 'inline';
        editBtn.textContent = 'Save';
      }
    });
  });

  // 削除ボタンのイベントリスナー
  table.querySelectorAll('.delete-btn').forEach(deleteBtn => {
    deleteBtn.addEventListener('click', () => {
      const username = deleteBtn.getAttribute('data-username');
      if (confirm(`Are you sure you want to delete the nickname for @${username}?`)) {
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
        No URL patterns added yet. Add patterns to specify which GitHub URLs the extension should run on.
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
      error: 'URL pattern cannot be empty'
    };
  }
  
  // 最大長をチェック
  if (pattern.length > 1000) {
    return {
      isValid: false,
      error: 'URL pattern must be 1000 characters or less'
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
        error: `Invalid regular expression: ${error.message}`
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
  toggleCustomSortButton.textContent = sortState.isCustom ? 'Normal Sort' : 'Custom Sort';
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
    alert('Custom order saved successfully.');
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
    alert('This URL pattern already exists.');
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
      error: 'Display nickname cannot be empty'
    };
  }

  // 長さチェック（最大100文字）
  if (name.length > 100) {
    return {
      isValid: false,
      error: 'Display nickname must be 100 characters or less'
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
        error: 'Display nickname contains potentially dangerous content'
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
    alert('Please enter a GitHub username');
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
    const { nameMapping, customOrder, theme, strictMode } = await new Promise(resolve => {
      chrome.storage.local.get(['nameMapping', 'customOrder', 'theme', 'strictMode'], resolve);
    });

    const preset = {
      version: '1.0',
      mappings: nameMapping || {},
      customOrder: customOrder || [],
      theme: theme || 'light',
      strictMode: strictMode || { enabled: false, urlPatterns: [] }
    };

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'github-nickname-wizard-settings.json';
    a.click();
    URL.revokeObjectURL(url);

    alert('Settings exported successfully.');
  } catch (error) {
    alert(`Failed to export settings: ${error.message}`);
  }
});

// 設定の読み込み
document.getElementById('loadPreset').addEventListener('click', async () => {
  const fileInput = document.getElementById('presetFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select a settings file.');
    return;
  }

  try {
    const text = await file.text();
    const preset = JSON.parse(text);

    // バージョンチェック
    if (!preset.version || !preset.mappings) {
      throw new Error('Invalid settings file format.');
    }

    // マッピングの検証とサニタイズ
    const sanitizedMappings = {};
    for (const [username, nickname] of Object.entries(preset.mappings)) {
      const validation = validateNickname(nickname);
      if (!validation.isValid) {
        throw new Error(`Invalid display nickname for user ${username}: ${validation.error}`);
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

    // リストを更新
    renderList(sanitizedMappings);
    alert('Settings imported successfully.');
  } catch (error) {
    alert(`Failed to import settings: ${error.message}`);
  }
});

function render() {
  chrome.storage.local.get('nameMapping', (data) => {
    renderList(data.nameMapping || {});
  });
}

// 初期化 - 保存された設定の読み込み
chrome.storage.local.get(['nameMapping', 'customOrder', 'strictMode'], (data) => {
  // ニックネームマッピングとカスタムソート順の読み込み
  if (data.customOrder) {
    customOrder = data.customOrder;
  }
  
  // 厳格モード設定の読み込み
  if (data.strictMode) {
    strictModeSettings = data.strictMode;
    strictModeToggle.checked = strictModeSettings.enabled;
  }
  
  // 初期描画
  renderList(data.nameMapping || {});
  renderUrlPatterns();
});

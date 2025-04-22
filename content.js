// --- このファイルには強制リロード処理は含まれない ---

// IIFE（即時実行関数式）でスコープを作成し、chrome APIへのアクセスを含める
(async () => {
  // i18nメッセージ取得のためのヘルパー関数（IIFE内でローカルに定義）
  const getMessage = (key, substitutions = []) => {
    try {
      return chrome.i18n.getMessage(key, substitutions);
    } catch (error) {
      console.error(`Error getting message for key ${key}:`, error);
      return key; // エラー時はキーをそのまま返す
    }
  };

  // 設定の読み込み
  const { nameMapping, strictMode, userCardButtonSettings, language } = await new Promise(resolve => {
    chrome.storage.local.get(['nameMapping', 'strictMode', 'userCardButtonSettings', 'language'], (data) => {
      resolve({
        nameMapping: data.nameMapping || {},
        strictMode: data.strictMode || { enabled: false, urlPatterns: [] },
        userCardButtonSettings: data.userCardButtonSettings || { enabled: true },
        language: data.language || 'auto'
      });
    });
  });

  // 設定の保持
  let strictModeSettings = strictMode;
  let userCardButtonEnabled = userCardButtonSettings.enabled;
  
  // マッピング参照用変数（更新可能にする）
  let mapping = nameMapping;

  // --- URLパターンマッチング関数 ---
  function isUrlMatched(url, pattern) {
    // 正規表現パターン
    if (pattern.startsWith('regex:')) {
      try {
        const regexPattern = pattern.substring(6);
        const regex = new RegExp(regexPattern);
        return regex.test(url);
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`, error);
        return false;
      }
    }
    
    // ワイルドカードパターン (*.github.com/org-name)
    if (pattern.includes('*')) {
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexPattern = escapeRegExp(pattern).replace(/\\\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(url);
    }
    
    // 通常の完全一致
    return url === pattern;
  }

  // --- 現在のURLが厳格モードのパターンにマッチするかを確認 ---
  function shouldApplyNicknames() {
    // 厳格モードが無効なら常に適用
    if (!strictModeSettings.enabled) {
      return true;
    }
    
    // パターンが設定されていない場合は適用しない
    if (!strictModeSettings.urlPatterns || strictModeSettings.urlPatterns.length === 0) {
      return false;
    }
    
    // 現在のURLを取得
    const currentUrl = window.location.href;
    
    // いずれかのパターンにマッチすれば適用
    return strictModeSettings.urlPatterns.some(pattern => isUrlMatched(currentUrl, pattern));
  }

  // --- Project カンバンボード用アバター処理 ---
  const handleAvatarHover = (event) => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;

    const imgEl = event.currentTarget;
    const describedbyId = imgEl.getAttribute('aria-describedby');

    if (describedbyId) {
      requestAnimationFrame(() => {
        const tooltipEl = document.getElementById(describedbyId);

        if (tooltipEl && !tooltipEl.getAttribute('data-tooltip-modified')) {
          const originalAriaLabel = tooltipEl.getAttribute('aria-label');
          const originalDataVisibleText = tooltipEl.getAttribute('data-visible-text');
          const username = originalAriaLabel;

          if (username && mapping[username]) {
            const newNicknameText = `${username} ( ${mapping[username]} ) `;
            tooltipEl.setAttribute('aria-label', newNicknameText);
            if (tooltipEl.hasAttribute('data-visible-text')) {
                tooltipEl.setAttribute('data-visible-text', newNicknameText);
            }
            tooltipEl.setAttribute('data-tooltip-modified', 'true');
          } else if (username) {
            tooltipEl.setAttribute('data-tooltip-modified', 'true');
          }
        }
      });
    }
  };

  const processAvatars = () => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;

    const avatarImages = document.querySelectorAll('img[data-component="Avatar"]:not([data-tooltip-listener-attached])');
    avatarImages.forEach(imgEl => {
      imgEl.addEventListener('mouseover', handleAvatarHover);
      imgEl.setAttribute('data-tooltip-listener-attached', 'true');
    });
  };

  // --- Project カンバンボード用アバター処理ここまで ---

  // --- Assignee アバター処理 (イベント委任バージョン) ---
  const handleDelegatedAssigneeHover = (event) => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;

    // ホバーされた要素が目的のimg要素か、その親要素を辿って探す
    let imgEl = null;
    if (event.target.matches('img.from-avatar.avatar-user')) {
      imgEl = event.target;
    } else {
      // ホバーされた要素の親を辿ってimgを探す (例: リンクの中にある場合など)
      imgEl = event.target.closest('a')?.querySelector('img.from-avatar.avatar-user');
    }

    // 目的のimg要素でなければ何もしない
    if (!imgEl) {
      return;
    }

    // --- ここからホバー時リロードチェック --- 
    const prListPathRegex = /^\/[^/]+\/[^/]+\/pulls(\/?$|\?)/;
    const currentPath = window.location.pathname + window.location.search;
    const reloadFlag = 'gh-nickname-wizard-pr-reloaded';

    if (prListPathRegex.test(currentPath)) {
      if (!sessionStorage.getItem(reloadFlag)) {
        sessionStorage.setItem(reloadFlag, 'true');
        setTimeout(() => {
            location.reload();
        }, 50);
        return; // リロードするので処理中断
      }
    }
    // --- ホバー時リロードチェックここまで ---

    // --- 既存のツールチップ処理ロジック (imgEl を使う) ---
    const originalAlt = imgEl.getAttribute('alt');

    if (originalAlt && !imgEl.getAttribute('data-assignee-processed')) {
      const usernameWithAt = originalAlt;
      const plainUsername = usernameWithAt.startsWith('@') ? usernameWithAt.substring(1) : usernameWithAt;

      imgEl.setAttribute('data-assignee-processed', 'true');

      setTimeout(() => {
        let potentialTooltips = document.querySelectorAll('.tooltipped, [role="tooltip"], .Tooltip');
        let foundTooltip = null;
        potentialTooltips.forEach(tip => {
          const tipAriaLabel = tip.getAttribute('aria-label');
          const tipTextContent = tip.textContent;
          const containsUsername = (tipAriaLabel && tipAriaLabel.includes(plainUsername)) || (tipTextContent && tipTextContent.includes(plainUsername));
          if (containsUsername && tip.offsetWidth > 0 && !tip.getAttribute('data-assignee-tooltip-modified')) {
             if (!foundTooltip) foundTooltip = tip;
          }
        });

        if (foundTooltip) {
          if (mapping[plainUsername]) {
            const newNicknameText = `${usernameWithAt} ( ${mapping[plainUsername]} ) `;
            if (foundTooltip.hasAttribute('aria-label')) {
              foundTooltip.setAttribute('aria-label', newNicknameText);
              if (foundTooltip.hasAttribute('data-visible-text')) {
                  foundTooltip.setAttribute('data-visible-text', newNicknameText);
              }
              foundTooltip.setAttribute('data-assignee-tooltip-modified', 'true');
            } else if(foundTooltip.textContent.includes(plainUsername)) {
               foundTooltip.textContent = foundTooltip.textContent.replace(usernameWithAt, newNicknameText);
               foundTooltip.setAttribute('data-assignee-tooltip-modified', 'true');
            }
          } else {
            foundTooltip.setAttribute('data-assignee-tooltip-modified', 'true');
          }
        } else {
          if (mapping[plainUsername]) {
             const newAltString = `${usernameWithAt} ( ${mapping[plainUsername]} ) `;
             imgEl.setAttribute('alt', newAltString);
          }
        }
        imgEl.removeAttribute('data-assignee-processed');
      }, 150);
    }
  };

  // --- Helper function to check if it's an org teams or people page ---
  function isOrgMemberListPage() {
    // Matches /orgs/ORG_NAME/teams(/TEAM_NAME), /orgs/ORG_NAME/people(/USERNAME)
    // Now also matches the base people page /orgs/ORG_NAME/people
    return /^\/orgs\/[^/]+\/(teams\/[^/]+|people(\/?$|\/[^/]+)?)(\/?$|\?)/.test(window.location.pathname);
  }

  // --- Helper function to check if it's an issue or pull request page ---
  function isIssueOrPrPage() {
    // Matches /{owner}/{repo}/issues/{number} or /{owner}/{repo}/pull/{number}
    return /^\/[^/]+\/[^/]+\/(issues|pull)\/\d+(\/?$|\?)/.test(window.location.pathname);
  }

  // --- 元々のリンク置換処理 ---
  const injectNicknames = () => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;

    // 一般ユーザーリンク
    const allUserLinks = document.querySelectorAll('a[href^="/"]:not([data-nickname-injected])');
    allUserLinks.forEach(el => {
      const href = el.getAttribute('href');
      const username = href?.split('/')[1];
      if (
        username &&
        mapping[username] &&
        /^\/[^/]+\/?$/.test(href) &&
        !el.textContent.includes(` ( ${mapping[username]} ) `)
      ) {
        if (el.textContent.trim() === username) {
          el.textContent = `${username} ( ${mapping[username]} ) `;
        } else if (el.textContent.includes(username)) {
          el.textContent = el.textContent.replace(
            new RegExp(`\\b${username}\\b`, 'g'),
            `${username} ( ${mapping[username]} ) `
          );
        }
        el.setAttribute('data-nickname-injected', 'true');
      }
    });

    // Issue/PR 一覧等のリンク
    const openedByLinks = document.querySelectorAll([
      '.opened-by a[data-hovercard-type="user"]',
      'a[data-hovercard-type="user"]:not([data-nickname-injected])',
      '.Link--primary[data-hovercard-type="user"]',
      '.js-issue-row a[data-hovercard-type="user"]',
      '.js-pull-request-row a[data-hovercard-type="user"]',
      'a[data-hovercard-url^="/users/"]:not([data-nickname-injected])',
      '.issue-item-module__authorCreatedLink--wFZvk'
    ].join(','));
    openedByLinks.forEach(el => {
       // Check if already processed by team member logic
       if (el.getAttribute('data-nickname-injected')) {
        return;
       }
      const username = el.textContent.trim();
      if (
        mapping[username] &&
        !el.textContent.includes(` ( ${mapping[username]} ) `)
      ) {
        el.textContent = `${username} ( ${mapping[username]} ) `;
        el.setAttribute('data-nickname-injected', 'true');
      }
    });
  };

  // --- Processing for Org Team Member & People List Links ---
  const processOrgMemberLinks = (mapping) => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;
    
    if (!isOrgMemberListPage()) {
      return;
    }

    // Selector should work for both team members and org people list
    const memberLinks = document.querySelectorAll('a[data-hovercard-type="user"][href^="/orgs/"][href*="/people/"]:not([data-nickname-injected])');

    memberLinks.forEach(el => {
      const href = el.getAttribute('href');
      if (!href) return;

      // Extract username from href (e.g., /orgs/ORG/people/USERNAME -> USERNAME)
      // This regex should still work for the people list links
      const match = href.match(/\/orgs\/[^/]+\/people\/([^/]+)/);
      const username = match ? match[1] : null;

      if (username && mapping[username]) {
        // Find the relevant text node and append the nickname
        let textNodeFoundAndModified = false;
        el.childNodes.forEach(node => {
          // Ensure it's a text node and not just whitespace
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
            const currentText = node.nodeValue.trim();
            // Avoid double appending if already somehow contains the alias structure
            if (!currentText.includes(` ( ${mapping[username]} ) `)){
                 node.nodeValue = `${currentText} ( ${mapping[username]} ) `;
                 textNodeFoundAndModified = true;
            }
          }
        });

        // Only mark as injected if we actually modified a text node
        if (textNodeFoundAndModified) {
             el.setAttribute('data-nickname-injected', 'true'); // Mark as processed
        }
      }
    });
  };

  // --- ユーザーカードへのニックネーム追加ボタン挿入処理 ---
  const processUserCards = () => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;
    
    // 設定で無効化されている場合は何もしない
    if (!userCardButtonEnabled) return;
    
    // OrganizationのPeople一覧ページでのみボタンを表示する
    // /orgs/{org-name}/people の形式のURLにマッチするか確認
    if (!window.location.pathname.match(/^\/orgs\/[^/]+\/people\/?$/)) return;

    // GitHubのユーザーカード（プロフィールホバー）を検出
    // 主にポップオーバーやホバーカードとして表示される要素
    const userCards = document.querySelectorAll([
      // ホバーカード
      '.Popover-message:not([data-nickname-button-added])',
      // 詳細なプロフィールカード
      '[data-hovercard-type="user"]:not([data-nickname-button-added])',
      // アバターホバー
      '.Overlay:not([data-nickname-button-added])',
      // その他のユーザー情報を含むコンテナ
      '.Profile-card:not([data-nickname-button-added])'
    ].join(','));

    userCards.forEach(card => {
      // ユーザー名を抽出
      let username = null;
      
      // ユーザー名を抽出するための様々なセレクタを試す
      const usernameElements = card.querySelectorAll([
        'a[href^="/"]:not([href^="/orgs/"]):not([href^="/teams/"]):not([href*="/issues/"]):not([href*="/pull/"]):not([href*="/blob/"])',
        '[data-hovercard-type="user"]',
        '.author',
        'span.text-bold',
        '.user-profile-link'
      ].join(','));
      
      usernameElements.forEach(el => {
        const potentialUsername = el.textContent.trim().replace(/^@/, '');
        // GitHubのユーザー名パターンに一致する場合のみ（英数字、ハイフンのみ）
        if (/^[a-zA-Z0-9-]+$/.test(potentialUsername)) {
          username = potentialUsername;
        }
      });
      
      // アバター画像のALT属性からもユーザー名を取得してみる
      if (!username) {
        const avatarImg = card.querySelector('img.avatar, img.avatar-user');
        if (avatarImg) {
          const altText = avatarImg.getAttribute('alt');
          if (altText) {
            const cleanAlt = altText.trim().replace(/^@/, '');
            if (/^[a-zA-Z0-9-]+$/.test(cleanAlt)) {
              username = cleanAlt;
            }
          }
        }
      }
      
      // ユーザー名が取得できた場合のみボタンを追加
      if (username) {
        // ボタンを挿入する適切な場所を探す
        let insertPoint = null;
        
        // 様々な挿入ポイントを探す
        const potentialInsertPoints = card.querySelectorAll('.Popover-message > div, .d-flex > div');
        if (potentialInsertPoints.length > 0) {
          insertPoint = potentialInsertPoints[potentialInsertPoints.length - 1];
        } else {
          insertPoint = card;
        }
        
        // 既にニックネームが登録されているかチェック
        const hasNickname = mapping[username];
        
        // 既にこのカードに対してボタンが追加されていないことを確認
        if (insertPoint && !card.querySelector('.nickname-add-button')) {
          // ニックネーム追加ボタンの作成 - 言語設定によらず固定の英語表記
          const addButton = document.createElement('button');
          addButton.className = 'nickname-add-button';
          addButton.setAttribute('data-username', username);
          // 固定の"Nickname"テキスト
          addButton.textContent = "Nickname";
          addButton.style.cssText = `
            margin-top: 8px;
            padding: 4px 8px;
            font-size: 12px;
            background-color: #2ea44f;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: block;
            width: 100%;
            text-align: center;
          `;
          
          // クリックイベントの追加
          addButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 現在のニックネームを取得（設定済みの場合）
            const currentNickname = mapping[username] || '';
            
            // バックグラウンドスクリプトにメッセージを送信
            try {
              chrome.runtime.sendMessage({
                action: "openQuickAddPopup",
                username: username,
                currentNickname: currentNickname
              });
            } catch (error) {
              console.error('Failed to send message to background script:', error);
            }
          });
          
          // ボタンを追加
          insertPoint.appendChild(addButton);
          
          // 処理済みとしてマーク
          card.setAttribute('data-nickname-button-added', 'true');
        }
      }
    });
  };

  // --- DOMツリー内の全spanとテキストを検索するヘルパー関数 ---
  const findUsernameElements = () => {
    console.log('GitHub Nickname Wizard: 全スパン要素を検索中...');
    
    // すべてのspan要素を取得
    const allSpans = document.querySelectorAll('span:not([data-nickname-injected])');
    const usernameSpans = [];
    
    // 各spanのテキストコンテンツを調べて、GitHubユーザー名パターンに一致するものを探す
    allSpans.forEach(span => {
      const text = span.textContent.trim();
      
      // シンプルなユーザー名パターン（英数字とハイフンのみ）
      if (/^[a-zA-Z0-9-]+$/.test(text) && text.length > 1) {
        // まずマッピングに存在するか確認
        if (mapping[text]) {
          usernameSpans.push({
            element: span,
            username: text
          });
          console.log(`GitHub Nickname Wizard: ユーザー名らしきテキストを検出: ${text}`);
        }
      }
    });
    
    return usernameSpans;
  };

  // --- Assigneeドロップダウン処理 - 直接要素ベースのアプローチ ---
  const processAssigneeDropdown = () => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;
    
    // Issue/PRページ以外では処理しない
    if (!isIssueOrPrPage()) return;

    // コンソールログを削除
    
    // 方法1: 特定のクラスを持つspan要素を探す（提供されたパターン）
    const specificLabelSelectors = [
      // 提供されたパターン
      '.prc-ActionList-ItemLabel-TmBhn:not([data-nickname-injected])',
      // IDベースのパターン
      '[id$="--label"]:not([data-nickname-injected])',
      // より一般的な名前の一部
      '[class*="ActionList"]:not([data-nickname-injected]) span:not([data-nickname-injected])',
      '[class*="actionList"]:not([data-nickname-injected]) span:not([data-nickname-injected])',
      // assigneeという単語を含むコンテナの中のspan
      '[class*="assignee" i] span:not([data-nickname-injected])',
      '[id*="assignee" i] span:not([data-nickname-injected])',
      '[aria-label*="assignee" i] span:not([data-nickname-injected])',
      // ドロップダウンメニュー内のspan
      '[role="menu"] span:not([data-nickname-injected])',
      '[role="listbox"] span:not([data-nickname-injected])',
      '[role="combobox"] span:not([data-nickname-injected])'
    ];
    
    let foundSpecificLabels = false;
    
    // 特定セレクタでの検索
    specificLabelSelectors.forEach(selector => {
      const labels = document.querySelectorAll(selector);
      
      if (labels.length > 0) {
        // ログを最小限に抑制
        foundSpecificLabels = true;
        
        labels.forEach(label => {
          const text = label.textContent.trim();
          const username = text.replace(/^@/, '');
          
          // ユーザー名が有効で、マッピングに存在する場合
          if (username && mapping[username] && !text.includes(` ( ${mapping[username]} ) `)) {
            // ログを最小限に抑制
            label.textContent = `${username} ( ${mapping[username]} ) `;
            label.setAttribute('data-nickname-injected', 'true');
            // ログを最小限に抑制
          }
        });
      }
    });
    
    // 方法2: DOM全体から適切なユーザー名を持つspan要素を探す
    if (!foundSpecificLabels) {
      // ログを最小限に抑制
      const usernameSpans = findUsernameElements();
      
      if (usernameSpans.length > 0) {
        // ログを最小限に抑制
        
        usernameSpans.forEach(item => {
          const { element, username } = item;
          
          // 親要素がassigneeに関連するかを判断
          const isInAssigneeContext = (() => {
            // 最大5階層まで親をたどる
            let parent = element.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              // テキストコンテンツ、ID、クラス名などからassigneeっぽいか判断
              const parentText = parent.textContent.toLowerCase();
              const parentId = (parent.id || '').toLowerCase();
              const parentClass = (parent.className || '').toLowerCase();
              const parentAriaLabel = (parent.getAttribute('aria-label') || '').toLowerCase();
              
              if (
                parentText.includes('assignee') ||
                parentId.includes('assignee') ||
                parentClass.includes('assignee') ||
                parentAriaLabel.includes('assignee') ||
                parentText.includes('担当者') ||
                parent.getAttribute('role') === 'listbox' ||
                parent.getAttribute('role') === 'menu' ||
                parent.getAttribute('role') === 'combobox'
              ) {
                return true;
              }
              
              parent = parent.parentElement;
            }
            return false;
          })();
          
          // assigneeコンテキストにあるか、ドロップダウンが開いている状態（タイミング依存）なら処理
          if (isInAssigneeContext) {
            // ログを最小限に抑制
            element.textContent = `${username} ( ${mapping[username]} ) `;
            element.setAttribute('data-nickname-injected', 'true');
          }
        });
      } else {
        console.log('GitHub Nickname Wizard: ユーザー名に一致するスパン要素も見つかりませんでした');
      }
    }
    
    // 方法3: 旧来のセレクタパターン（以前のバージョンとの互換性のため）
    const assigneeSelectors = [
      // 新しいGitHubデザインのassigneeドロップダウン
      '[data-testid="assignees-menu"] [role="listbox"] [role="option"]:not([data-nickname-injected])',
      '.assignee-menu [role="listbox"] [role="option"]:not([data-nickname-injected])',
      // 新UI React実装パターン
      '[id*="assignee" i] [role="option"]:not([data-nickname-injected])',
      '[id*="Assignee" i] [role="option"]:not([data-nickname-injected])',
      '[class*="ActionList"]:not([data-nickname-injected])',
      '[class*="actionList"]:not([data-nickname-injected])',
      // 従来のデザインでのassigneeドロップダウン
      '.sidebar-assignee .select-menu-list .select-menu-item:not([data-nickname-injected])',
      // より一般的なセレクタ
      '[aria-label*="assignee" i] [role="menu"] [role="menuitem"]:not([data-nickname-injected])',
      '[aria-label*="Assignee" i] [role="menu"] [role="menuitem"]:not([data-nickname-injected])',
      // さらに一般的なセレクタ
      '.js-issues-sidebar-menu .select-menu-item:not([data-nickname-injected])',
      '.js-issue-sidebar-form .select-menu-item:not([data-nickname-injected])',
      // 直接リスト内の要素を対象
      '.js-issue-sidebar-form li:not([data-nickname-injected])'
    ];

    // 各セレクタでドロップダウンアイテムを検索
    let foundItems = false;
    
    assigneeSelectors.forEach(selector => {
      const dropdownItems = document.querySelectorAll(selector);
      
      // ログを最小限に抑制しつつ検出状態は維持
      if (dropdownItems.length > 0) {
        foundItems = true;
      }

      dropdownItems.forEach(item => {
        // アイテムが本当にユーザー関連かの確認（誤検出を減らす）
        const isUserRelated = item.textContent.includes('@') || 
                              item.querySelector('img.avatar') || 
                              item.querySelector('[data-hovercard-type="user"]') ||
                              item.hasAttribute('data-login');
                              
        if (!isUserRelated) {
          // おそらくユーザー関連の項目ではない
          return;
        }

        // ユーザー名を抽出するさまざまな方法を試す
        let username = null;
        
        // 1. data-login属性からの抽出
        if (item.hasAttribute('data-login')) {
          username = item.getAttribute('data-login');
          // ログを最小限に抑制
        }
        
        // 2. hovercard-url属性からの抽出
        if (!username && item.hasAttribute('data-hovercard-url')) {
          const hovercardUrl = item.getAttribute('data-hovercard-url');
          const match = hovercardUrl.match(/\/users\/([^/?]+)/);
          if (match) {
            username = match[1];
            // ログを最小限に抑制
          }
        }
        
        // 3. 内部のホバーカード要素からの抽出
        if (!username) {
          const hovercardEl = item.querySelector('[data-hovercard-type="user"]');
          if (hovercardEl && hovercardEl.hasAttribute('data-hovercard-url')) {
            const hovercardUrl = hovercardEl.getAttribute('data-hovercard-url');
            const match = hovercardUrl.match(/\/users\/([^/?]+)/);
            if (match) {
              username = match[1];
              // ログを最小限に抑制
            }
          }
        }
        
        // 4. ユーザー名を含む可能性のある要素からの抽出
        if (!username) {
          const userElements = item.querySelectorAll('.js-username, [data-hovercard-type="user"], .Link--primary, a[href^="/"]');
          userElements.forEach(el => {
            const text = el.textContent.trim().replace(/^@/, '');
            if (/^[a-zA-Z0-9-]+$/.test(text)) {
              username = text;
              // ログを最小限に抑制
            }
          });
        }
        
        // 5. アバター画像のalt属性からの抽出
        if (!username) {
          const avatarImg = item.querySelector('img.avatar, img.avatar-user');
          if (avatarImg && avatarImg.hasAttribute('alt')) {
            const alt = avatarImg.getAttribute('alt');
            const cleanAlt = alt.trim().replace(/^@/, '');
            if (/^[a-zA-Z0-9-]+$/.test(cleanAlt)) {
              username = cleanAlt;
              // ログを最小限に抑制
            }
          }
        }
        
        // 6. aria-label属性からの抽出
        if (!username && item.hasAttribute('aria-label')) {
          const ariaLabel = item.getAttribute('aria-label');
          const match = ariaLabel.match(/@([a-zA-Z0-9-]+)/);
          if (match) {
            username = match[1];
            // ログを最小限に抑制
          }
        }
        
        // 7. テキストコンテンツからの抽出
        if (!username) {
          const text = item.textContent.trim();
          const match = text.match(/@([a-zA-Z0-9-]+)/);
          if (match) {
            username = match[1];
            // ログを最小限に抑制
          } else {
            // @がない場合、単純なユーザー名のパターンを探す
            const simpleMatch = text.match(/\b([a-zA-Z0-9-]+)\b/);
            if (simpleMatch && !text.includes('(') && !text.includes(')')) {
              // これは誤検出のリスクが高いが、他に方法がない場合の最終手段
              username = simpleMatch[1];
              // ログを最小限に抑制
            }
          }
        }
        
        // ニックネームを追加
        if (username && mapping[username] && !item.textContent.includes(` ( ${mapping[username]} ) `)) {
          // ログを最小限に抑制
          
          // まず、すべてのテキストノードを検索
          let targetFound = false;
          
          // 関数: 要素内のすべてのテキストノードを見つけ、ユーザー名を含むものを処理
          const processTextNodes = (element) => {
            const walker = document.createTreeWalker(
              element, 
              NodeFilter.SHOW_TEXT, 
              { acceptNode: node => node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
            );
            
            let currentNode;
            while ((currentNode = walker.nextNode())) {
              const text = currentNode.textContent;
              if (text.includes(`@${username}`) || text.match(new RegExp(`\\b${username}\\b`))) {
                if (text.includes(`@${username}`)) {
                  currentNode.textContent = text.replace(
                    `@${username}`,
                    `@${username} ( ${mapping[username]} ) `
                  );
                } else {
                  currentNode.textContent = text.replace(
                    new RegExp(`\\b${username}\\b`),
                    `${username} ( ${mapping[username]} ) `
                  );
                }
                targetFound = true;
              }
            }
          };
          
          // テキストノードを処理
          processTextNodes(item);
          
          // テキストノードが見つからない/処理できない場合のフォールバック
          if (!targetFound) {
            // span要素やその他のユーザー名表示要素を探して処理
            const userEls = item.querySelectorAll('span, a, .js-username, [data-hovercard-type="user"]');
            userEls.forEach(el => {
              if (el.textContent.includes(username) || el.textContent.includes(`@${username}`)) {
                if (el.textContent.includes(`@${username}`)) {
                  el.textContent = el.textContent.replace(
                    `@${username}`,
                    `@${username} ( ${mapping[username]} ) `
                  );
                } else {
                  el.textContent = el.textContent.replace(
                    new RegExp(`\\b${username}\\b`),
                    `${username} ( ${mapping[username]} ) `
                  );
                }
                targetFound = true;
              }
            });
          }
          
          // 処理が成功したら、マークを設定
          if (targetFound) {
            item.setAttribute('data-nickname-injected', 'true');
            // ログを最小限に抑制
          } else {
            // ログを最小限に抑制
            
            // 最終手段：項目全体を再構築
            try {
              const originalHTML = item.innerHTML;
              if (item.textContent.includes(username)) {
                const newHTML = originalHTML.replace(
                  new RegExp(`(${username})(?![^<>]*>)`, 'g'),
                  `$1 ( ${mapping[username]} ) `
                );
                if (newHTML !== originalHTML) {
                  item.innerHTML = newHTML;
                  item.setAttribute('data-nickname-injected', 'true');
                  // ログを最小限に抑制
                }
              }
            } catch (err) {
              console.error('innerHTML置換エラー:', err);
            }
          }
        }
      });
    });
    
    if (!foundItems) {
      // ログを最小限に抑制
    }
  };

  // --- ポーリング方式で定期的に全spanをスキャンする関数 ---
  const setupPollingForAssignees = () => {
    if (!shouldApplyNicknames() || !isIssueOrPrPage()) return;
    
    // コンソールログを削除
    
    // すべてのテキストノードをスキャン
    const scanAllTextNodes = () => {
      if (!shouldApplyNicknames() || !isIssueOrPrPage()) return;
      
      // ドキュメント内のすべてのテキストノードを取得
      const allTextNodes = [];
      const walk = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      while (walk.nextNode()) {
        const node = walk.currentNode;
        const text = node.textContent.trim();
        
        // テキストノードに有効なテキストが含まれている場合のみ処理
        if (text.length > 0) {
          // マッピングに存在するユーザー名かどうかをチェック
          Object.keys(mapping).forEach(username => {
            // ドロップダウンメニューの一部かどうかを確認する要素
            if (
              (text === username || text === `@${username}`) && 
              !node.parentElement.hasAttribute('data-nickname-injected')
            ) {
              // この要素がAssigneeドロップダウンの一部かどうかをチェック
              let isAssigneeContext = false;
              let element = node.parentElement;
              
              // 7階層まで親をたどってAssignee関連かチェック
              for (let i = 0; i < 7 && element; i++) {
                const parentHTML = element.outerHTML?.toLowerCase() || '';
                if (
                  parentHTML.includes('assignee') || 
                  parentHTML.includes('担当') || 
                  parentHTML.includes('assign to') ||
                  parentHTML.includes('role="listbox"') ||
                  parentHTML.includes('role="menu"') ||
                  parentHTML.includes('role="option"') ||
                  parentHTML.includes('role="combobox"') ||
                  parentHTML.includes('listbox')
                ) {
                  isAssigneeContext = true;
                  break;
                }
                element = element.parentElement;
              }
              
              // Assigneeコンテキストと判断された場合、ニックネームを挿入
              if (isAssigneeContext) {
                // ログを最小限に抑制
                const nickname = mapping[username];
                
                // ニックネームが既に挿入されていないか確認
                if (!node.textContent.includes(` ( ${nickname} ) `)) {
                  // テキストノードの内容を置換
                  if (text === `@${username}`) {
                    node.textContent = `@${username} ( ${nickname} ) `;
                  } else {
                    node.textContent = `${username} ( ${nickname} ) `;
                  }
                  
                  // 親要素にマークを付ける
                  node.parentElement.setAttribute('data-nickname-injected', 'true');
                  // ログを最小限に抑制
                }
              }
            }
          });
        }
      }
    };
    
    // 1秒ごとにスキャン（UIの変更を検出するため）
    const pollingInterval = setInterval(scanAllTextNodes, 1000);
    
    // ページ遷移時にクリア
    window.addEventListener('beforeunload', () => {
      clearInterval(pollingInterval);
    });
    
    // 初回実行
    scanAllTextNodes();
  };

  // --- 初期実行 ---
  if (shouldApplyNicknames()) {
    processAvatars();
    injectNicknames();
    processOrgMemberLinks(mapping);
    processUserCards();
    processAssigneeDropdown();
    
    // ポーリングを開始
    setTimeout(() => {
      setupPollingForAssignees();
    }, 500);
  }

  // --- MutationObserver 設定 ---
  const observerCallback = (mutationsList) => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;

    let runOriginalInject = false;
    let runAvatarProcessing = false;
    let runOrgMemberProcessing = false;
    let runUserCardProcessing = false;
    let runAssigneeDropdownProcessing = false;

    // より効果的な検出のため、クリックイベントで実行するフラグも追加
    let potentialDropdownTrigger = false;

    for(const mutation of mutationsList) {
        // 新しいspan要素が追加されたら、それが重要な可能性があるため記録
        let spanAdded = false;
        
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            runOriginalInject = true;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // spanが追加された場合、assigneeドロップダウンの可能性がある
                    if (node.tagName === 'SPAN' || node.querySelector('span')) {
                        spanAdded = true;
                    }
                    
                    if (node.matches('img[data-component="Avatar"]') || node.querySelector('img[data-component="Avatar"]')) {
                        runAvatarProcessing = true;
                    }
                    if (isOrgMemberListPage() && (node.matches('a[data-hovercard-type="user"][href^="/orgs/"]') || node.querySelector('a[data-hovercard-type="user"][href^="/orgs/"]'))) {
                        runOrgMemberProcessing = true;
                    }
                    // ユーザーカード関連の要素が追加された場合
                    if (node.matches('.Popover-message, [data-hovercard-type="user"], .Overlay, .Profile-card') || 
                        node.querySelector('.Popover-message, [data-hovercard-type="user"], .Overlay, .Profile-card')) {
                        runUserCardProcessing = true;
                    }
                    // Assigneeドロップダウン関連の要素が追加された場合 - セレクタ拡張
                    if (isIssueOrPrPage() && (
                        node.matches('[role="listbox"], [role="menu"], .select-menu-list, .select-menu-modal, .SelectMenu-modal, .SelectMenu-list, [id*="assignee"], [id*="Assignee"], [class*="assignee"], [class*="Assignee"]') ||
                        node.querySelector('[role="listbox"], [role="menu"], .select-menu-list, .SelectMenu-modal, .SelectMenu-list, [id*="assignee"], [id*="Assignee"], [class*="assignee"], [class*="Assignee"]') ||
                        node.matches('[role="option"], [role="menuitem"], .select-menu-item, .SelectMenu-item') ||
                        node.querySelector('[role="option"], [role="menuitem"], .select-menu-item, .SelectMenu-item') ||
                        // Reactで使われる命名パターンに対応
                        node.matches('[class*="ActionList"], [class*="actionList"]') ||
                        node.querySelector('[class*="ActionList"], [class*="actionList"]') ||
                        // 特定のクラス名 (ユーザーが提供したパターン)
                        node.matches('.prc-ActionList-ItemLabel-TmBhn, [id$="--label"]') ||
                        node.querySelector('.prc-ActionList-ItemLabel-TmBhn, [id$="--label"]')
                    )) {
                        runAssigneeDropdownProcessing = true;
                    }
                    
                    // メニュー表示のトリガーとなる可能性のある要素が追加された場合
                    if (isIssueOrPrPage() && (
                        node.matches('.js-issue-sidebar-form, .js-issues-sidebar-menu, .sidebar-assignee, [data-testid="assignees-menu"]') ||
                        node.querySelector('.js-issue-sidebar-form, .js-issues-sidebar-menu, .sidebar-assignee, [data-testid="assignees-menu"]')
                    )) {
                        potentialDropdownTrigger = true;
                    }
                }
            });
            
            // issue詳細ページでspanが追加されたらドロップダウンの可能性があるとみなす
            if (spanAdded && isIssueOrPrPage()) {
                runAssigneeDropdownProcessing = true;
            }
        }
        else if (mutation.type === 'characterData') {
             runOriginalInject = true;
        }
        // Exit early if all flags are set
        if (runOriginalInject && runAvatarProcessing && runOrgMemberProcessing && 
            runUserCardProcessing && runAssigneeDropdownProcessing) break;
    }

    if (runAvatarProcessing) {
        processAvatars();
    }
    if (runOriginalInject) {
        injectNicknames();
    }
    if (runOrgMemberProcessing) {
        processOrgMemberLinks(mapping);
    }
    if (runUserCardProcessing) {
        processUserCards();
    }
    if (runAssigneeDropdownProcessing || potentialDropdownTrigger) {
        // Assigneeドロップダウンの処理は、わずかに遅延させて実行
        // これはDOMがレンダリングを完了する時間を確保するため
        setTimeout(() => {
            processAssigneeDropdown();
            
            // 短い間隔で複数回処理を試みることで、検出漏れを防ぐ
            setTimeout(processAssigneeDropdown, 300);
        }, 100);
    }
  };
  
  const observer = new MutationObserver(observerCallback);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // --- イベント委任リスナーの設定 ---
  document.body.addEventListener('mouseenter', (event) => {
    // 厳格モードチェックはハンドラ内で行う
    handleDelegatedAssigneeHover(event);
  }, true);
  
  // Assigneeドロップダウンのためのクリック検知 - 下記のいずれかがクリックされたらドロップダウンが表示された可能性がある
  document.body.addEventListener('click', (event) => {
    if (!shouldApplyNicknames()) return;
    if (!isIssueOrPrPage()) return;
    
    // クリックされた要素または親要素がAssignee関連のトリガーかどうかを確認
    const isAssigneeTrigger = (element) => {
      if (!element) return false;
      
      // トリガーとなりうる要素のセレクタ
      const triggerSelectors = [
        '.js-issue-sidebar-form',
        '.sidebar-assignee',
        '[data-testid="assignees-menu"]',
        '[aria-label*="assignee"]',
        '[aria-label*="Assignee"]',
        '.assignee-link',
        '.js-issues-sidebar-menu',
        // アイコンボタンなども考慮
        '.sidebar-assignee svg',
        '[data-testid="assignees-menu"] button',
        // 新UIの要素も追加
        '[id*="assignee"]',
        '[id*="Assignee"]',
        '[class*="assignee"]',
        '[class*="Assignee"]',
        // 汎用的なドロップダウントリガーも含める
        'button[aria-haspopup="true"]',
        '[role="combobox"]'
      ];
      
      // 要素自体がセレクタにマッチするか確認
      const isDirectMatch = triggerSelectors.some(selector => 
        element.matches && element.matches(selector)
      );
      
      if (isDirectMatch) return true;
      
      // 親要素がセレクタにマッチするか確認 (2段階まで)
      const parent = element.parentElement;
      if (parent) {
        const isParentMatch = triggerSelectors.some(selector => 
          parent.matches && parent.matches(selector)
        );
        
        if (isParentMatch) return true;
        
        const grandparent = parent.parentElement;
        if (grandparent) {
          return triggerSelectors.some(selector => 
            grandparent.matches && grandparent.matches(selector)
          );
        }
      }
      
      return false;
    };
    
    // クリックされた要素かその親がAssignee関連のトリガーかチェック
    if (isAssigneeTrigger(event.target)) {
      // ログを最小限に抑制
      
      // ドロップダウンの表示に時間がかかる場合があるため、複数回遅延実行
      setTimeout(() => {
        processAssigneeDropdown();
      }, 100);
      
      setTimeout(() => {
        processAssigneeDropdown();
      }, 300);
      
      setTimeout(() => {
        processAssigneeDropdown();
      }, 600);
    }
  });

  // --- 設定変更のリスナー ---
  // エラーハンドリングを強化：メッセージリスナーは一度だけ追加
  const messageHandler = (message, sender, sendResponse) => {
    try {
      // デバッグ時のみ有効にするログ
      // console.log('Content script received message:', message);
      
      // 言語変更メッセージは処理しない（ボタンテキストは固定）
      if (message.action === 'languageChanged') {
        // ログを最小限に抑制
        sendResponse({ success: true });
        return true;
      }
      // 厳格モード更新メッセージを処理
      else if (message.action === 'strictModeUpdated') {
        strictModeSettings = message.settings;
        
        // 設定が変更されたら、すべてのマークを削除して再適用
        if (shouldApplyNicknames()) {
          document.querySelectorAll('[data-nickname-injected], [data-tooltip-modified], [data-assignee-tooltip-modified], [data-nickname-button-added]').forEach(el => {
            el.removeAttribute('data-nickname-injected');
            el.removeAttribute('data-tooltip-modified');
            el.removeAttribute('data-assignee-tooltip-modified');
            el.removeAttribute('data-nickname-button-added');
          });
          
          // 再処理
          processAvatars();
          injectNicknames();
          processOrgMemberLinks(mapping);
          processUserCards();
        }
        
        // 応答を返す
        sendResponse({ success: true });
      }
      // ユーザーカードボタン設定が更新された場合の処理
      else if (message.action === 'userCardButtonSettingsUpdated') {
        // ログを最小限に抑制
        
        // 設定を更新
        userCardButtonEnabled = message.settings.enabled;
        
        // すべてのユーザーカードボタンを削除
        document.querySelectorAll('[data-nickname-button-added]').forEach(el => {
          // ボタンを探して削除
          const button = el.querySelector('.nickname-add-button');
          if (button) {
            button.remove();
          }
          el.removeAttribute('data-nickname-button-added');
        });
        
        // 必要に応じて再処理
        if (shouldApplyNicknames()) {
          processUserCards();
        }
        
        // 応答を返す
        sendResponse({ success: true });
      }
      // コンテキストメニューからニックネームが追加された場合の処理
      else if (message.action === 'refreshNicknames') {
        // ログを最小限に抑制
        const username = message.username;
        const nickname = message.nickname;
        
        // マッピング更新
        if (username && nickname) {
          try {
            // マッピングを更新
            chrome.storage.local.get('nameMapping', (data) => {
              // ログを最小限に抑制
              mapping = data.nameMapping || {};
              
              // すでに処理済みの要素のマークを削除して再適用
              try {
                const selector = `a[href="/${username}"], a[href="/${username}/"], a[data-hovercard-type="user"]`;
                document.querySelectorAll(selector).forEach(el => {
                  if (el.getAttribute('data-nickname-injected')) {
                    el.removeAttribute('data-nickname-injected');
                  }
                });
                
      // ツールチップのマークも削除
      document.querySelectorAll('[data-tooltip-modified], [data-assignee-tooltip-modified], [data-nickname-button-added]').forEach(el => {
        el.removeAttribute('data-tooltip-modified');
        el.removeAttribute('data-assignee-tooltip-modified');
        el.removeAttribute('data-nickname-button-added');
      });
      
      // Assigneeドロップダウンとすべてのテキスト要素の処理済みマークを削除
      try {
        // より広いセレクタを使用
        document.querySelectorAll('[data-nickname-injected]').forEach(el => {
          el.removeAttribute('data-nickname-injected');
        });
      } catch (e) {
        console.error('マーク削除中のエラー:', e);
      }
                
                // 再処理
                processAvatars();
                injectNicknames();
                processOrgMemberLinks(mapping);
                processUserCards();
                processAssigneeDropdown();
                
                // 成功メッセージをコンソールに表示
                // 重要なログは残す
                console.log(`GitHub Nickname Wizard: ニックネーム追加 - @${username} → ${nickname}`);
                
                // 応答を返す
                sendResponse({ success: true, message: 'Nicknames updated' });
              } catch (error) {
                console.error('Error updating DOM elements:', error);
                sendResponse({ success: false, error: error.message });
              }
            });
          } catch (error) {
            console.error('Error during storage operation:', error);
            sendResponse({ success: false, error: error.message });
          }
          
          // 非同期応答を許可するためにtrueを返す
          return true;
        } else {
          sendResponse({ success: false, message: 'Missing username' });
        }
      } else {
        // 不明なアクション
        sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    // 非同期応答を許可するためにtrueを返す
    return true;
  };

  // リスナーを登録
  try {
    chrome.runtime.onMessage.addListener(messageHandler);
  } catch (error) {
    console.error('Failed to register message listener:', error);
  }
})();

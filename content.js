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

  // --- 初期実行 ---
  if (shouldApplyNicknames()) {
    processAvatars();
    injectNicknames();
    processOrgMemberLinks(mapping);
    processUserCards();
  }

  // --- MutationObserver 設定 ---
  const observerCallback = (mutationsList) => {
    // 厳格モードで適用すべきでない場合は何もしない
    if (!shouldApplyNicknames()) return;

    let runOriginalInject = false;
    let runAvatarProcessing = false;
    let runOrgMemberProcessing = false;
    let runUserCardProcessing = false;

    for(const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            runOriginalInject = true;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
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
                }
            });
        }
        else if (mutation.type === 'characterData') {
             runOriginalInject = true;
        }
        // Exit early if all flags are set
        if (runOriginalInject && runAvatarProcessing && runOrgMemberProcessing && runUserCardProcessing) break;
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

  // --- 設定変更のリスナー ---
  // エラーハンドリングを強化：メッセージリスナーは一度だけ追加
  const messageHandler = (message, sender, sendResponse) => {
    try {
      console.log('Content script received message:', message);
      
      // 言語変更メッセージは処理しない（ボタンテキストは固定）
      if (message.action === 'languageChanged') {
        console.log('Language change detected, no UI updates needed for fixed English buttons');
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
        console.log('User card button settings update received:', message);
        
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
        console.log('Nickname update message received:', message);
        const username = message.username;
        const nickname = message.nickname;
        
        // マッピング更新
        if (username && nickname) {
          try {
            // マッピングを更新
            chrome.storage.local.get('nameMapping', (data) => {
              console.log('Retrieved latest mapping from storage:', data);
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
                
                // 再処理
                processAvatars();
                injectNicknames();
                processOrgMemberLinks(mapping);
                processUserCards();
                
                // 成功メッセージをコンソールに表示
                console.log(`GitHub Nickname Wizard: Nickname added - @${username} → ${nickname}`);
                
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

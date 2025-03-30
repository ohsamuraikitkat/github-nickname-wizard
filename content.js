// --- このファイルには強制リロード処理は含まれない ---

(async () => {
  const mapping = await new Promise(resolve => {
    chrome.storage.local.get('nameMapping', (data) => {
      resolve(data.nameMapping || {});
    });
  });

  // --- Project カンバンボード用アバター処理 ---
  const handleAvatarHover = (event) => {
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
            const newNicknameText = `${username}（${mapping[username]}）`;
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
    const avatarImages = document.querySelectorAll('img[data-component="Avatar"]:not([data-tooltip-listener-attached])');
    avatarImages.forEach(imgEl => {
      imgEl.addEventListener('mouseover', handleAvatarHover);
      imgEl.setAttribute('data-tooltip-listener-attached', 'true');
    });
  };

  // --- Project カンバンボード用アバター処理ここまで ---

  // --- Assignee アバター処理 (イベント委任バージョン) ---
  const handleDelegatedAssigneeHover = (event) => {
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

    // console.log('[Assignee Delegate DEBUG] Delegate hover detected for:', imgEl);

    // --- ここからホバー時リロードチェック --- 
    const prListPathRegex = /^\/[^/]+\/[^/]+\/pulls(\/?$|\?)/;
    const currentPath = window.location.pathname + window.location.search;
    const reloadFlag = 'gh-nickname-wizard-pr-reloaded';

    if (prListPathRegex.test(currentPath)) {
      if (!sessionStorage.getItem(reloadFlag)) {
        // console.log('[Assignee Delegate Reload] PR list & first hover. Scheduling reload...');
        sessionStorage.setItem(reloadFlag, 'true');
        setTimeout(() => {
            // console.log('[Assignee Delegate Reload] Executing deferred location.reload()');
            location.reload();
        }, 50);
        return; // リロードするので処理中断
      }
    }
    // --- ホバー時リロードチェックここまで ---

    // --- 既存のツールチップ処理ロジック (imgEl を使う) ---
    const originalAlt = imgEl.getAttribute('alt');
    // console.log('[Assignee Delegate DEBUG] Original alt:', originalAlt);

    if (originalAlt && !imgEl.getAttribute('data-assignee-processed')) {
      const usernameWithAt = originalAlt;
      const plainUsername = usernameWithAt.startsWith('@') ? usernameWithAt.substring(1) : usernameWithAt;
      // console.log('[Assignee Delegate DEBUG] Plain username:', plainUsername);
      // console.log('[Assignee Delegate DEBUG] Mapping exists?:', !!mapping[plainUsername]);

      imgEl.setAttribute('data-assignee-processed', 'true');

      setTimeout(() => {
        // console.log(`[Assignee Delegate DEBUG] Searching for tooltip after timeout (alt: ${originalAlt})`);
        let potentialTooltips = document.querySelectorAll('.tooltipped, [role="tooltip"], .Tooltip');
        // console.log(`[Assignee Delegate DEBUG] Found ${potentialTooltips.length} potential tooltips globally`);
        let foundTooltip = null;
        potentialTooltips.forEach(tip => {
          const tipAriaLabel = tip.getAttribute('aria-label');
          const tipTextContent = tip.textContent;
          const containsUsername = (tipAriaLabel && tipAriaLabel.includes(plainUsername)) || (tipTextContent && tipTextContent.includes(plainUsername));
          if (containsUsername && tip.offsetWidth > 0 && !tip.getAttribute('data-assignee-tooltip-modified')) {
             // console.log('[Assignee Delegate DEBUG] Potential tooltip found:', tip, 'textContent:', tipTextContent, 'aria-label:', tipAriaLabel);
             if (!foundTooltip) foundTooltip = tip;
          }
        });

        if (foundTooltip) {
          // console.log('[Assignee Delegate DEBUG] ---> Likely tooltip element identified:', foundTooltip);
          if (mapping[plainUsername]) {
            const newNicknameText = `${usernameWithAt}（${mapping[plainUsername]}）`;
            // console.log('[Assignee Delegate DEBUG] Attempting to modify identified tooltip with:', newNicknameText);
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
            // console.log('[Assignee Delegate DEBUG] Mapping not found for identified tooltip user.');
            foundTooltip.setAttribute('data-assignee-tooltip-modified', 'true');
          }
        } else {
          // console.log('[Assignee Delegate DEBUG] ---> No likely tooltip element identified containing the username after timeout.');
          if (mapping[plainUsername]) {
             const newAltString = `${usernameWithAt}（${mapping[plainUsername]}）`;
             // console.log('[Assignee Delegate DEBUG] Fallback: Attempting to modify img alt attribute.');
             imgEl.setAttribute('alt', newAltString);
          }
        }
        imgEl.removeAttribute('data-assignee-processed');
        // console.log('[Assignee Delegate DEBUG] Processed flag removed from image.');
      }, 150);

    } else if (imgEl.getAttribute('data-assignee-processed')) {
      // console.log('[Assignee Delegate DEBUG] Image already being processed (timeout pending).');
    } else {
      // console.log('[Assignee Delegate DEBUG] Alt attribute is missing or empty.');
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
    // Skip processing on team member pages as it's handled by processTeamMemberLinks
    // Although the data-realname-injected check should prevent duplicates,
    // this might offer a slight performance improvement.
    // if (isTeamMemberPage()) return; // Optional optimization

    // 一般ユーザーリンク
    const allUserLinks = document.querySelectorAll('a[href^="/"]:not([data-nickname-injected])');
    allUserLinks.forEach(el => {
      const href = el.getAttribute('href');
      const username = href?.split('/')[1];
      if (
        username &&
        mapping[username] &&
        /^\/[^/]+\/?$/.test(href) &&
        !el.textContent.includes(`（${mapping[username]}）`)
      ) {
        if (el.textContent.trim() === username) {
          el.textContent = `${username}（${mapping[username]}）`;
        } else if (el.textContent.includes(username)) {
          el.textContent = el.textContent.replace(
            new RegExp(`\\b${username}\\b`, 'g'),
            `${username}（${mapping[username]}）`
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
      // Exclude links already processed or specific to team pages if necessary
    ].join(','));
    openedByLinks.forEach(el => {
       // Check if already processed by team member logic
       if (el.getAttribute('data-nickname-injected')) {
        return;
       }
      const username = el.textContent.trim();
      if (
        mapping[username] &&
        !el.textContent.includes(`（${mapping[username]}）`)
      ) {
        el.textContent = `${username}（${mapping[username]}）`;
        el.setAttribute('data-nickname-injected', 'true');
      }
    });
  };

  // --- Processing for Org Team Member & People List Links ---
  const processOrgMemberLinks = (mapping) => {
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
            if (!currentText.includes(`（${mapping[username]}）`)){
                 node.nodeValue = `${currentText}（${mapping[username]}）`;
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
  // --- Org Member Link Processing End ---

  // --- 初期実行 ---
  processAvatars();
  // processAssigneeAvatars の呼び出しは削除
  injectNicknames();
  processOrgMemberLinks(mapping); // ★ Call the renamed function

  // --- MutationObserver 設定 ---
  const observerCallback = (mutationsList) => {
    let runOriginalInject = false;
    let runAvatarProcessing = false;
    let runOrgMemberProcessing = false; // ★ Renamed Flag
    // let runAssigneeAvatarProcessing = false; // Assignee 個別処理フラグは不要に

    for(const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            runOriginalInject = true;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('img[data-component="Avatar"]') || node.querySelector('img[data-component="Avatar"]')) {
                        runAvatarProcessing = true;
                    }
                    // ★ Check if added nodes might contain org member links using the renamed function
                    if (isOrgMemberListPage() && (node.matches('a[data-hovercard-type="user"][href^="/orgs/"]') || node.querySelector('a[data-hovercard-type="user"][href^="/orgs/"]'))) {
                        runOrgMemberProcessing = true; // ★ Use renamed flag
                    }
                    // Assignee アバターの個別チェックは不要になる
                }
            });
        }
        else if (mutation.type === 'characterData') {
             // Potentially relevant if profile names change, but might be too broad.
             // Consider if characterData changes should trigger team member processing.
             // For now, only trigger original inject.
             runOriginalInject = true;
        }
        // Exit early if all flags are set
        if (runOriginalInject && runAvatarProcessing && runOrgMemberProcessing) break; // ★ Use renamed flag
    }

    if (runAvatarProcessing) {
        processAvatars();
    }
    // processAssigneeAvatars の呼び出しは削除
    if (runOriginalInject) {
        injectNicknames();
    }
    if (runOrgMemberProcessing) { // ★ Call renamed function using renamed flag
        processOrgMemberLinks(mapping);
    }
  };
  const observer = new MutationObserver(observerCallback);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true // Keep monitoring characterData for general updates
  });

  // --- イベント委任リスナーの設定 ---
  // console.log('[Initialization] Setting up delegated mouseenter listener for assignee avatars.');
  document.body.addEventListener('mouseenter', handleDelegatedAssigneeHover, true); // ★ Captureフェーズで設定

})();
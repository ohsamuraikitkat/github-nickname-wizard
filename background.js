"use strict";
// i18nメッセージ取得のためのヘルパー関数
function getMessage(key, substitutions = []) {
  return chrome.i18n.getMessage(key, substitutions);
}

// コンテキストメニューの作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addNickname",
    title: getMessage("register_nickname_context"),
    contexts: ["selection"],
    documentUrlPatterns: ["*://github.com/*"]
  });
});

// コンテキストメニューがクリックされた時のハンドラ
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addNickname") {
    // 選択テキストをユーザー名として取得（@が先頭にある場合は除去）
    const username = info.selectionText.trim().replace(/^@/, '');
    
    // ユーザー名が空でないことを確認
    if (username) {
      // 既存のニックネームを取得して追加
      chrome.storage.local.get('nameMapping', (data) => {
        const mapping = data.nameMapping || {};
        const currentNickname = mapping[username] || '';
        
        // ポップアップでニックネーム入力を促す
        chrome.windows.create({
          url: `quick-add.html?username=${encodeURIComponent(username)}&nickname=${encodeURIComponent(currentNickname)}`,
          type: 'popup',
          width: 430,
          height: 280
        });
      });
    }
  }
});

// グローバル変数で言語設定を保持
let currentLanguage = 'auto';

// 言語設定を取得する関数
async function getCurrentLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get('language', (data) => {
      currentLanguage = data.language || 'auto';
      resolve(currentLanguage);
    });
  });
}

// デバッグログ関数
function logDebug(message) {
  console.log(`[GitHub Nickname Wizard] ${message}`);
}

// 拡張機能起動時に初期化
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    await getCurrentLanguage();
    logDebug(`拡張機能インストール/更新完了。言語設定: ${currentLanguage}`);
  }
});

// 拡張機能起動時に言語設定を初期化
chrome.runtime.onStartup.addListener(async () => {
  await getCurrentLanguage();
  logDebug(`拡張機能起動。言語設定: ${currentLanguage}`);
});

// 言語設定変更を全タブに通知
async function broadcastLanguageChange(newLocale) {
  logDebug(`言語変更を全タブに通知: ${newLocale}`);
  
  try {
    const tabs = await chrome.tabs.query({});
    
    // すべてのタブに通知
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith('http')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'languageChanged',
            locale: newLocale
          });
          logDebug(`Tab ${tab.id} に通知完了`);
        } catch (error) {
          logDebug(`Tab ${tab.id} への通知失敗: ${error.message}`);
        }
      }
    }
    
    // 現在のタブを再読み込み
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0) {
      await chrome.tabs.reload(activeTabs[0].id);
    }
    
    // ポップアップウィンドウを再読み込み
    chrome.runtime.reload();
    
  } catch (error) {
    logDebug(`言語変更通知中にエラー: ${error.message}`);
  }
}

// メッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logDebug(`メッセージを受信: ${JSON.stringify(message)}`);
  
  // 言語変更メッセージを処理
  if (message.action === "changeLanguage") {
    const newLocale = message.locale;
    logDebug(`言語変更リクエスト: ${newLocale}`);
    
    // 設定を保存
    chrome.storage.local.set({ language: newLocale }, async () => {
      currentLanguage = newLocale;
      
      // 言語変更通知
      await broadcastLanguageChange(newLocale);
      
      // 応答を返す
      sendResponse({ success: true, message: '言語が変更されました' });
    });
    
    return true; // 非同期応答のため
  }
  
  // ユーザーカードから「ニックネームを追加」ボタンがクリックされた場合
  if (message.action === "openQuickAddPopup") {
    const username = message.username;
    const currentNickname = message.currentNickname || '';
    
    if (username) {
      let url = `quick-add.html?username=${encodeURIComponent(username)}`;
      if (currentNickname) {
        url += `&nickname=${encodeURIComponent(currentNickname)}`;
      }
      
      chrome.windows.create({
        url: url,
        type: 'popup',
        width: 430,
        height: 280
      });
      
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: getMessage('missing_username') });
    }
    
    return true;
  }
  // ニックネームが追加された場合
  else if (message.action === "nicknameAdded") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        console.log('アクティブタブID:', tabs[0].id);
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "refreshNicknames",
          username: message.username,
          nickname: message.nickname
        }, (response) => {
          console.log('コンテンツスクリプトからの応答:', response);
          sendResponse({ success: true, message: 'ニックネームが更新されました' });
        });
      } else {
        console.warn('アクティブなタブが見つかりませんでした');
        sendResponse({ success: false, message: 'アクティブなタブが見つかりませんでした' });
      }
    });
    
    return true;
  }
  // closePopupメッセージを処理
  else if (message.action === "closePopup") {
    if (sender && sender.tab && sender.tab.windowId !== undefined) {
      chrome.windows.remove(sender.tab.windowId, function() {
        if (chrome.runtime.lastError) {
          console.error("Error closing popup window:", chrome.runtime.lastError);
          sendResponse({ success: false, message: "Error closing window." });
        } else {
          sendResponse({ success: true });
        }
      });
    } else {
      sendResponse({ success: false, message: "No sender.tab.windowId found." });
    }
    return true;
  }
  
  // すべてのメッセージに応答を返すようにする
  sendResponse({ success: false, message: '不明なアクション' });
  return true;
});

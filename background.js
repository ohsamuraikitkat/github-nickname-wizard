// コンテキストメニューの作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addNickname",
    title: "このユーザー名にニックネームを登録",
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
      // ポップアップでニックネーム入力を促す
      chrome.windows.create({
        url: `quick-add.html?username=${encodeURIComponent(username)}`,
        type: 'popup',
        width: 400,
        height: 250
      });
    }
  }
});

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('バックグラウンドスクリプトがメッセージを受信:', message);
  
  // ユーザーカードから「ニックネームを追加」ボタンがクリックされた場合
  if (message.action === "openQuickAddPopup") {
    const username = message.username;
    const currentNickname = message.currentNickname || '';
    
    // ユーザー名が空でないことを確認
    if (username) {
      // ポップアップでニックネーム入力を促す
      let url = `quick-add.html?username=${encodeURIComponent(username)}`;
      
      // 現在のニックネームがある場合はURLパラメータに追加
      if (currentNickname) {
        url += `&nickname=${encodeURIComponent(currentNickname)}`;
      }
      
      chrome.windows.create({
        url: url,
        type: 'popup',
        width: 400,
        height: 250
      });
      
      // 応答を返す
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: 'ユーザー名が不足しています' });
    }
    
    // 非同期応答を許可するためにtrueを返す
    return true;
  }
  // ニックネームが追加された場合
  else if (message.action === "nicknameAdded") {
    // アクティブなタブを取得して通知を送信
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        console.log('アクティブタブID:', tabs[0].id);
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "refreshNicknames",
          username: message.username,
          nickname: message.nickname
        }, (response) => {
          console.log('コンテンツスクリプトからの応答:', response);
          // 呼び出し元に応答
          sendResponse({ success: true, message: 'ニックネームが更新されました' });
        });
      } else {
        console.warn('アクティブなタブが見つかりませんでした');
        // 呼び出し元に応答
        sendResponse({ success: false, message: 'アクティブなタブが見つかりませんでした' });
      }
    });
    
    // 非同期応答を許可するためにtrueを返す
    return true;
  }
  
  // すべてのメッセージに応答を返すようにする
  sendResponse({ success: false, message: '不明なアクション' });
  return true;
});

// i18nオブジェクトを直接参照して重複宣言を避ける
const i18n = window.i18n;

// URLからユーザー名とニックネームを取得
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const initialNickname = urlParams.get('nickname');

// ページ読み込み完了時
document.addEventListener('DOMContentLoaded', () => {
  // ユーザー名を表示
  const usernameDisplay = document.getElementById('usernameDisplay');
  usernameDisplay.textContent = username ? '@' + username : '';

  // 各要素を取得
  const nicknameInput = document.getElementById('nickname');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  
  // URLから取得した初期ニックネームがあれば入力欄に設定
  if (initialNickname) {
    nicknameInput.value = initialNickname;
  }

  // 保存ボタンのイベントリスナー
  saveBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    
    // ニックネームが空でない場合のみ保存
    if (username && nickname) {
      // ニックネームの検証（popup.jsの関数を参考にシンプル化）
      function sanitizeNickname(name) {
        return name
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      const sanitizedNickname = sanitizeNickname(nickname);

      console.log(`Save process started: user ${username}, nickname ${sanitizedNickname}`);
      
      // ストレージに保存
      try {
        chrome.storage.local.get('nameMapping', (data) => {
          console.log('既存のマッピングデータを取得:', data);
          const mapping = data.nameMapping || {};
          mapping[username] = sanitizedNickname;
          
          chrome.storage.local.set({ nameMapping: mapping }, () => {
            console.log('Mapping data saved:', mapping);
            if (chrome.runtime.lastError) {
              console.error('保存エラー:', chrome.runtime.lastError);
              alert(`保存エラー: ${chrome.runtime.lastError.message}`);
              return;
            }
            
            // バックグラウンドスクリプトに通知
            chrome.runtime.sendMessage({
              action: "nicknameAdded",
              username: username,
              nickname: sanitizedNickname
            }, (response) => {
              console.log('メッセージ送信完了:', response);
              if (chrome.runtime.lastError) {
                console.error('Notification error:', chrome.runtime.lastError);
                // エラーが発生しても保存処理自体は完了しているので、成功として扱う
              }
              
              alert(i18n.getMessage('nickname_added', [username, sanitizedNickname]));
              // ウィンドウを閉じる
              window.close();
            });
          });
        });
      } catch (error) {
        console.error('予期せぬエラー:', error);
        alert(`エラーが発生しました: ${error.message}`);
      }
      } else if (!nickname) {
        alert(i18n.getMessage('enter_nickname'));
    }
  });

  // キャンセルボタンのイベントリスナー
  cancelBtn.addEventListener('click', () => {
    try {
      // ウィンドウを閉じる
      window.close();
      
      // バックアップとして明示的にウィンドウを閉じるメッセージを送信
      chrome.runtime.sendMessage({
        action: "closeQuickAddWindow",
        windowId: chrome.windows ? chrome.windows.WINDOW_ID_CURRENT : null
      });
    } catch (error) {
      console.error('ウィンドウを閉じる際にエラーが発生しました:', error);
    }
  });

  // 多言語化の初期処理
  i18n.localizeDocument();
  i18n.setupDynamicLocalization();
  
  // タイトルを更新（編集モード時）
  if (initialNickname) {
    document.title = i18n.getMessage('edit_nickname_title');
    const titleElement = document.querySelector('h3');
    if (titleElement) {
      titleElement.textContent = i18n.getMessage('edit_nickname_title');
    }
  }
  
  // Enterキー押下時に保存処理を実行
  nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });

  // GitHubのAPIを使用してユーザーの実名を自動的に提案（可能であれば）
  async function suggestNickname(username) {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      if (response.ok) {
        const userData = await response.json();
        if (userData.name) {
          nicknameInput.value = userData.name;
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data', error);
    }
  }

  // ユーザー名があり、かつ現在のニックネームが設定されていない場合のみ実名を提案
  if (username && !initialNickname) {
    suggestNickname(username);
  }
});

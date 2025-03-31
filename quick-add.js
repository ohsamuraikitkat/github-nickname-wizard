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

      console.log(`保存処理開始: ユーザー ${username}, ニックネーム ${sanitizedNickname}`);
      
      // ストレージに保存
      try {
        chrome.storage.local.get('nameMapping', (data) => {
          console.log('既存のマッピングデータを取得:', data);
          const mapping = data.nameMapping || {};
          mapping[username] = sanitizedNickname;
          
          chrome.storage.local.set({ nameMapping: mapping }, () => {
            console.log('マッピングデータを保存しました:', mapping);
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
                console.error('通知エラー:', chrome.runtime.lastError);
                // エラーが発生しても保存処理自体は完了しているので、成功として扱う
              }
              
              alert(`ニックネームを保存しました: @${username} → ${sanitizedNickname}`);
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
      alert('ニックネームを入力してください');
    }
  });

  // キャンセルボタンのイベントリスナー
  cancelBtn.addEventListener('click', () => {
    window.close();
  });

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

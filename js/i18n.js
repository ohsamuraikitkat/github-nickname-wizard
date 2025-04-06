/**
 * GitHub Nickname Wizard: 多言語対応ヘルパー関数
 */

// デフォルト言語
const DEFAULT_LOCALE = 'en';

/**
 * 言語設定
 */
let currentLanguage = null;
let customMessages = null;

async function loadCustomMessages(locale) {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  try {
    const response = await fetch(url);
    customMessages = await response.json();
    console.log(`Custom messages loaded for locale: ${locale}`);
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    customMessages = null;
  }
}

function applySubstitutions(message, substitutions) {
  return message.replace(/\$(\d+)/g, (match, number) => {
    return typeof substitutions[number - 1] !== 'undefined' ? substitutions[number - 1] : match;
  });
}

/**
 * 初期化処理
 */
async function initializeI18n() {
  // 言語設定を取得（存在しなければデフォルト言語）
  currentLanguage = await getCurrentLocale();
  console.log(`現在の言語: ${currentLanguage}`);
  await loadCustomMessages(currentLanguage);
}

/**
 * 設定から現在の言語を取得
 */
async function getCurrentLocale() {
  return new Promise(resolve => {
    chrome.storage.local.get('language', (data) => {
      if (!data.language || data.language === 'auto') {
        // 自動設定の場合はブラウザの言語を使用
        const browserLocale = chrome.i18n.getUILanguage();
        console.log(`ブラウザの言語を使用: ${browserLocale}`);
        resolve(browserLocale || DEFAULT_LOCALE);
      } else {
        console.log(`保存された言語設定を使用: ${data.language}`);
        resolve(data.language);
      }
    });
  });
}

/**
 * メッセージを取得
 */
function getMessage(key, substitutions = []) {
  if (customMessages && customMessages[key] && customMessages[key].message) {
    return applySubstitutions(customMessages[key].message, substitutions);
  }
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * HTML要素のテキストを多言語化
 */
function localizeElement(element, key, substitutions = []) {
  if (!element) return;
  element.textContent = getMessage(key, substitutions);
}

/**
 * 要素の属性を多言語化
 */
function localizeAttribute(element, attribute, key, substitutions = []) {
  if (!element) return;
  element.setAttribute(attribute, getMessage(key, substitutions));
}

/**
 * document内の要素を多言語化
 */
function localizeAllElements(selector, key, substitutions = []) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(element => {
    localizeElement(element, key, substitutions);
  });
}

/**
 * data-i18n属性を使ってドキュメント全体を多言語化
 */
function localizeDocument() {
  console.log('ドキュメントの多言語化を開始');
  
  // テキストコンテンツの多言語化
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = getMessage(key);
    element.textContent = message;
    console.log(`多言語化: ${key} => ${message}`);
  });
  
  // プレースホルダの多言語化
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    localizeAttribute(element, 'placeholder', key);
  });
  
  // タイトル属性の多言語化
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    localizeAttribute(element, 'title', key);
  });
  
  // value属性の多言語化
  document.querySelectorAll('[data-i18n-value]').forEach(element => {
    const key = element.getAttribute('data-i18n-value');
    localizeAttribute(element, 'value', key);
  });
  
  // その他の属性の多言語化
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const key = element.getAttribute('data-i18n-aria-label');
    localizeAttribute(element, 'aria-label', key);
  });
  
  console.log('ドキュメントの多言語化完了');
}

/**
 * 動的に追加された要素を監視して多言語化
 */
function setupDynamicLocalization(targetNode = document.body) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 新しく追加されたノードの多言語化処理
            if (node.hasAttribute('data-i18n')) {
              const key = node.getAttribute('data-i18n');
              localizeElement(node, key);
            }
            
            // 子要素の多言語化処理
            node.querySelectorAll('[data-i18n]').forEach(element => {
              const key = element.getAttribute('data-i18n');
              localizeElement(element, key);
            });
            
            // その他の多言語化属性の処理
            const attrTypes = ['placeholder', 'title', 'value', 'aria-label'];
            attrTypes.forEach(attr => {
              const dataAttr = `data-i18n-${attr}`;
              if (node.hasAttribute(dataAttr)) {
                const key = node.getAttribute(dataAttr);
                localizeAttribute(node, attr, key);
              }
              
              node.querySelectorAll(`[${dataAttr}]`).forEach(element => {
                const key = element.getAttribute(dataAttr);
                localizeAttribute(element, attr, key);
              });
            });
          }
        });
      }
    });
  });
  
  observer.observe(targetNode, { childList: true, subtree: true });
  return observer;
}

/**
 * 言語選択UIを生成
 */
function createLanguageSelector(locales, currentLocale) {
  const select = document.createElement('select');
  select.id = 'language-selector';
  select.className = 'language-selector';
  
  // 自動オプション
  const autoOption = document.createElement('option');
  autoOption.value = 'auto';
  autoOption.textContent = getMessage('language_auto');
  select.appendChild(autoOption);
  
  // 各言語オプション
  locales.forEach(locale => {
    const option = document.createElement('option');
    option.value = locale;
    
    // 言語名は各言語のネイティブ名を使用
    switch (locale) {
      case 'en':
        option.textContent = 'English';
        break;
      case 'ja':
        option.textContent = '日本語';
        break;
      default:
        option.textContent = locale;
    }
    
    select.appendChild(option);
  });
  
  // 現在の言語を選択
  select.value = currentLocale === chrome.i18n.getUILanguage() ? 'auto' : currentLocale;
  
  // イベントリスナの設定
  select.addEventListener('change', () => {
    const newLocale = select.value;
    console.log(`言語を変更: ${newLocale}`);
    
    // 言語設定を保存
    chrome.storage.local.set({ language: newLocale }, () => {
      console.log('言語設定を保存しました');
      
      // extensionをリロード
      chrome.runtime.reload();
    });
  });
  
  return select;
}

function initLocalization() {
  initializeI18n().then(() => {
    localizeDocument();
    setupDynamicLocalization();
    // Additional call after delay to ensure all dynamic elements are localized
    setTimeout(localizeDocument, 500);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLocalization);
  window.addEventListener("load", initLocalization);
} else {
  initLocalization();
}

// エクスポート
window.i18n = {
  getCurrentLocale,
  getMessage,
  localizeElement,
  localizeAttribute,
  localizeAllElements,
  localizeDocument,
  setupDynamicLocalization,
  createLanguageSelector
};

/**
 * 外部連結封裝。用 tauri-plugin-opener 在系統預設瀏覽器開啟 URL,
 * 不讓 webview 自身導航離開 app(元件不直接碰平台 API,集中在 shell/)。
 */

import { openUrl } from '@tauri-apps/plugin-opener';

/** 專案資訊(署名與原始碼位置),供設定面板「關於」區與其他地方共用。 */
export const APP_AUTHOR = 'Zaious';
export const APP_REPO_URL = 'https://github.com/Zaious/chroniclelife';

/** 在系統預設瀏覽器開啟外部連結。 */
export async function openExternal(url: string): Promise<void> {
  await openUrl(url);
}

/**
 * 前端 ↔ Rust 持久化橋接。
 * 只有這個檔案准許 import @tauri-apps/api(src/lib/core 禁止平台依賴)。
 *
 * Rust 端契約(見 CLAUDE.md / PLANNING.md §5.2):
 * - invoke<string | null>('load_data')       讀 data.json 原始字串;不存在 → resolve null;
 *                                            檔案存在但讀取失敗(鎖定/權限問題等)→ reject(字串訊息)
 * - invoke('save_data', { json })            寫 data.json(Rust 端負責原子寫入)
 * - invoke<string | null>('load_settings')   讀 settings.json,同上約定
 * - invoke('save_settings', { json })        寫 settings.json
 *
 * 讀取:
 * - resolve null(檔案不存在,正常新檔情境)→ 回傳 DEFAULT_DATA / DEFAULT_SETTINGS。
 * - reject(讀取失敗)或 JSON.parse 失敗(檔案在但內容壞掉)→ 回傳預設值**並將 `degraded` 設為 true**,
 *   進入唯讀降級模式:saveDataDebounced / saveSettingsDebounced 之後一律 no-op,避免用預設值覆寫磁碟上
 *   還救得回來的原檔。這兩種情況都不可回傳 null 冒充「檔案不存在」,否則會被誤判為新檔而覆寫真資料。
 * 寫入:debounce 800ms,合併連續變更只送最後一次;degraded 為 true 時直接不排程。
 */

import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_DATA, DEFAULT_SETTINGS, type AppData, type Settings } from '../core/types';

const SAVE_DEBOUNCE_MS = 800;

/** true = 唯讀降級模式(讀檔失敗或壞檔):畫面照常顯示,但不再寫入磁碟。 */
export const degraded = writable(false);

function cloneDefault<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 去除開頭的 UTF-8 BOM(U+FEFF)。使用者用記事本等工具手動編輯資料檔時,存檔常會帶 BOM,
 * 而 JSON.parse 遇到開頭 BOM 會直接拋錯 → 若不處理,一個其實完好的檔案會讓 app 永遠卡在唯讀降級模式。
 */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** 從 Rust 載入 data.json;讀取失敗或壞檔時回傳預設值並進入降級模式,不覆寫磁碟上的原檔。 */
export async function loadData(): Promise<AppData> {
  try {
    const raw = await invoke<string | null>('load_data');
    if (raw == null) return cloneDefault(DEFAULT_DATA);
    const parsed = JSON.parse(stripBom(raw)) as Partial<AppData>;
    return {
      schemaVersion: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch (err) {
    console.error('loadData failed, entering degraded (read-only) mode', err);
    degraded.set(true);
    return cloneDefault(DEFAULT_DATA);
  }
}

/** 從 Rust 載入 settings.json;讀取失敗或壞檔時回傳預設值並進入降級模式,不覆寫磁碟上的原檔。 */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await invoke<string | null>('load_settings');
    if (raw == null) return cloneDefault(DEFAULT_SETTINGS);
    const parsed = JSON.parse(stripBom(raw)) as Partial<Settings>;
    return { ...cloneDefault(DEFAULT_SETTINGS), ...parsed, schemaVersion: 1 };
  } catch (err) {
    console.error('loadSettings failed, entering degraded (read-only) mode', err);
    degraded.set(true);
    return cloneDefault(DEFAULT_SETTINGS);
  }
}

let dataSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingData: AppData | null = null;

/** debounce 800ms 寫入 data.json;連續呼叫只保留最後一次資料。降級模式下 no-op(不寫檔)。 */
export function saveDataDebounced(data: AppData): void {
  if (get(degraded)) return;
  pendingData = data;
  if (dataSaveTimer != null) clearTimeout(dataSaveTimer);
  dataSaveTimer = setTimeout(() => {
    const toSave = pendingData;
    dataSaveTimer = null;
    pendingData = null;
    if (toSave == null || get(degraded)) return;
    invoke('save_data', { json: JSON.stringify(toSave) }).catch((err) => {
      console.error('save_data failed', err);
    });
  }, SAVE_DEBOUNCE_MS);
}

let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: Settings | null = null;

/** debounce 800ms 寫入 settings.json;連續呼叫只保留最後一次資料。降級模式下 no-op(不寫檔)。 */
export function saveSettingsDebounced(settings: Settings): void {
  if (get(degraded)) return;
  pendingSettings = settings;
  if (settingsSaveTimer != null) clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    const toSave = pendingSettings;
    settingsSaveTimer = null;
    pendingSettings = null;
    if (toSave == null || get(degraded)) return;
    invoke('save_settings', { json: JSON.stringify(toSave) }).catch((err) => {
      console.error('save_settings failed', err);
    });
  }, SAVE_DEBOUNCE_MS);
}

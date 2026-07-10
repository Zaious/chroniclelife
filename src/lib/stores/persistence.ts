/**
 * 前端 ↔ Rust 持久化橋接。
 * 只有這個檔案准許 import @tauri-apps/api(src/lib/core 禁止平台依賴)。
 *
 * Rust 端契約(見 CLAUDE.md / PLANNING.md §5.2):
 * - invoke<string | null>('load_data')       讀 data.json 原始字串,不存在回 null
 * - invoke('save_data', { json })            寫 data.json(Rust 端負責原子寫入)
 * - invoke<string | null>('load_settings')   讀 settings.json 原始字串,不存在回 null
 * - invoke('save_settings', { json })        寫 settings.json
 *
 * 讀取:null 或 JSON.parse 失敗 → 回傳 DEFAULT_DATA / DEFAULT_SETTINGS(壞檔不覆寫,先保留原檔在磁碟上)。
 * 寫入:debounce 800ms,合併連續變更只送最後一次。
 */

import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_DATA, DEFAULT_SETTINGS, type AppData, type Settings } from '../core/types';

const SAVE_DEBOUNCE_MS = 800;

function cloneDefault<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 從 Rust 載入 data.json;壞檔或不存在時回傳預設值,不覆寫磁碟上的原檔。 */
export async function loadData(): Promise<AppData> {
  try {
    const raw = await invoke<string | null>('load_data');
    if (raw == null) return cloneDefault(DEFAULT_DATA);
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      schemaVersion: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch (err) {
    console.error('loadData failed, falling back to defaults', err);
    return cloneDefault(DEFAULT_DATA);
  }
}

/** 從 Rust 載入 settings.json;壞檔或不存在時回傳預設值,不覆寫磁碟上的原檔。 */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await invoke<string | null>('load_settings');
    if (raw == null) return cloneDefault(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...cloneDefault(DEFAULT_SETTINGS), ...parsed, schemaVersion: 1 };
  } catch (err) {
    console.error('loadSettings failed, falling back to defaults', err);
    return cloneDefault(DEFAULT_SETTINGS);
  }
}

let dataSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingData: AppData | null = null;

/** debounce 800ms 寫入 data.json;連續呼叫只保留最後一次資料。 */
export function saveDataDebounced(data: AppData): void {
  pendingData = data;
  if (dataSaveTimer != null) clearTimeout(dataSaveTimer);
  dataSaveTimer = setTimeout(() => {
    const toSave = pendingData;
    dataSaveTimer = null;
    pendingData = null;
    if (toSave == null) return;
    invoke('save_data', { json: JSON.stringify(toSave) }).catch((err) => {
      console.error('save_data failed', err);
    });
  }, SAVE_DEBOUNCE_MS);
}

let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: Settings | null = null;

/** debounce 800ms 寫入 settings.json;連續呼叫只保留最後一次資料。 */
export function saveSettingsDebounced(settings: Settings): void {
  pendingSettings = settings;
  if (settingsSaveTimer != null) clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    const toSave = pendingSettings;
    settingsSaveTimer = null;
    pendingSettings = null;
    if (toSave == null) return;
    invoke('save_settings', { json: JSON.stringify(toSave) }).catch((err) => {
      console.error('save_settings failed', err);
    });
  }, SAVE_DEBOUNCE_MS);
}

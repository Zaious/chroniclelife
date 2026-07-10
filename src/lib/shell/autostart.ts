/**
 * 開機自啟封裝(tauri-plugin-autostart)。
 * 規格見 docs/PLANNING.md §3.1 F9、§6(行為 → 開機自啟)。
 * settings.autostart 是使用者意圖的唯一事實來源;這裡只負責讓實際系統狀態(登錄機碼)追上它。
 */

import { isEnabled, enable, disable } from '@tauri-apps/plugin-autostart';

/** 依 wanted 直接設定開機自啟狀態(設定面板切換開關時呼叫)。 */
export async function setAutostart(wanted: boolean): Promise<void> {
  if (wanted) {
    await enable();
  } else {
    await disable();
  }
}

/** 啟動時呼叫:讓系統的實際開機自啟狀態與 `wanted`(= settings.autostart)一致,已一致時不做事。 */
export async function syncAutostart(wanted: boolean): Promise<void> {
  const actual = await isEnabled();
  if (actual === wanted) return;
  await setAutostart(wanted);
}

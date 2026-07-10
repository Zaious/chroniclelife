/**
 * 時間軸核心計算 — 純函式,零 DOM / Svelte / Tauri 依賴。
 * 這是跨平台防腐層:未來 macOS / 行動端直接重用此模組。
 * 規格見 docs/PLANNING.md §2。所有時間運算一律用 epoch ms,禁止字串日期比較。
 *
 * ⚠️ 本檔目前為介面契約(架構定稿),函式主體由 M1 實作並補齊單元測試。
 */

import type { Checkpoint, Task } from './types';

export const MS_PER_DAY = 86_400_000;

/** 列的顯示模式 */
export type RowMode = 'normal' | 'countdown' | 'overdue';
/** 檢查點狀態:未到 / 已到未確認 / 已確認 */
export type CheckpointState = 'upcoming' | 'due' | 'acked';

/**
 * 條長比例 ∈ [0, 1]。
 * ratio = clamp((deadlineMs - nowMs) / (windowDays * MS_PER_DAY), 0, 1)
 * 已逾期 (deadline < now) 回傳 0。
 */
export function barRatio(deadlineMs: number, nowMs: number, windowDays: number): number {
  const remaining = deadlineMs - nowMs;
  const windowMs = windowDays * MS_PER_DAY;
  const ratio = remaining / windowMs;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * 檢查點直線位置:距「錨定端(= 截止日端)」的比例 ∈ [0, 1]。
 * offset = (deadlineMs - checkpointMs) / (windowDays * MS_PER_DAY)
 * 位置固定不隨 now 移動;條尾端縮到此處 = 檢查時間到 (PLANNING.md §2.4)。
 * 超出範圍(checkpoint 晚於 deadline 或早於視窗)回傳 null = 不顯示。
 */
export function checkpointOffsetRatio(
  deadlineMs: number,
  checkpointMs: number,
  windowDays: number,
): number | null {
  const windowMs = windowDays * MS_PER_DAY;
  const offset = (deadlineMs - checkpointMs) / windowMs;
  if (offset < 0 || offset > 1) return null;
  return offset;
}

/**
 * 列模式判定:
 * - deadline < now            → 'overdue'
 * - 剩餘 ≤ thresholdHours     → 'countdown'
 * - 其餘                      → 'normal'
 */
export function rowMode(deadlineMs: number, nowMs: number, thresholdHours: number): RowMode {
  if (deadlineMs < nowMs) return 'overdue';
  const remaining = deadlineMs - nowMs;
  const thresholdMs = thresholdHours * 3_600_000;
  if (remaining <= thresholdMs) return 'countdown';
  return 'normal';
}

/**
 * 倒數字串 "HH:MM:SS"(向下取整秒,HH 可 > 99 不進位天)。
 * msRemaining ≤ 0 回傳 "00:00:00"。
 */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '00:00:00';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/**
 * 逾期天數(無條件進位:逾期 1 小時 = 1 天),用於「已逾期 N 天」。
 */
export function overdueDays(deadlineMs: number, nowMs: number): number {
  const overdueMs = nowMs - deadlineMs;
  if (overdueMs <= 0) return 0;
  return Math.ceil(overdueMs / MS_PER_DAY);
}

/**
 * 顯示排序 (PLANNING.md §2.2):
 * 1. 排除 done === true
 * 2. 未逾期者在前,依剩餘時間 多 → 少(最緊急沉到最底)
 * 3. 逾期者一律置底,彼此依逾期久 → 新排列
 * 回傳新陣列,不改動輸入。
 */
export function sortTasksForDisplay(tasks: Task[], nowMs: number): Task[] {
  const active = tasks.filter((t) => !t.done);

  const upcoming: Task[] = [];
  const overdue: Task[] = [];
  for (const t of active) {
    const deadlineMs = isoToMs(t.deadline);
    if (deadlineMs < nowMs) {
      overdue.push(t);
    } else {
      upcoming.push(t);
    }
  }

  // 未逾期:剩餘時間 多 → 少(最緊急沉到最底)
  upcoming.sort((a, b) => isoToMs(b.deadline) - isoToMs(a.deadline));
  // 逾期:逾期久(deadline 較早) → 新(deadline 較晚)
  overdue.sort((a, b) => isoToMs(a.deadline) - isoToMs(b.deadline));

  return [...upcoming, ...overdue];
}

/** 檢查點狀態判定:acked → 'acked';at ≤ now → 'due';否則 'upcoming'。 */
export function checkpointState(cp: Checkpoint, nowMs: number): CheckpointState {
  if (cp.acked) return 'acked';
  const atMs = isoToMs(cp.at);
  if (atMs <= nowMs) return 'due';
  return 'upcoming';
}

/**
 * 檢查點時間合法範圍判定 (PLANNING.md §2.4):必須介於「現在 ~ 截止日」之間(含邊界)。
 */
export function isCheckpointTimeValid(atMs: number, nowMs: number, deadlineMs: number): boolean {
  return atMs >= nowMs && atMs <= deadlineMs;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 由本地日期/時間欄位字串組出含本地時區偏移的 ISO 8601 字串。
 * time 為空字串時使用 fallbackTime(預設 "23:59",對應「未填時間視為當日 23:59」的規則)。
 * 例:toLocalIso('2026-07-15', '09:30') → "2026-07-15T09:30:00+08:00"(依執行環境時區)。
 */
export function toLocalIso(dateStr: string, timeStr: string, fallbackTime = '23:59'): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || fallbackTime).split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);

  const offsetMin = -dt.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const offH = pad2(Math.floor(Math.abs(offsetMin) / 60));
  const offM = pad2(Math.abs(offsetMin) % 60);

  return (
    `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}` +
    `T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

/**
 * ISO 8601 字串 → 本地日期/時間欄位字串(供表單 <input type="date"> / <input type="time"> 顯示用)。
 * 與 toLocalIso 互為反函式。
 */
export function isoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(isoToMs(iso));
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * 合法年份範圍(含邊界)。用於擋掉 `<input type="date">` 逐字輸入年份時的中間態
 * (例如打「2026」的第一個「2」時,瀏覽器已把值視為 "0002-07-12" 並觸發 change/input 事件)。
 * 不在此範圍內的年份一律視為「使用者還沒打完」,不得提交寫入。
 */
export const MIN_VALID_YEAR = 2000;
export const MAX_VALID_YEAR = 2200;

/** 年份是否落在合法範圍 [MIN_VALID_YEAR, MAX_VALID_YEAR](含邊界)。 */
export function isYearInValidRange(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_VALID_YEAR && year <= MAX_VALID_YEAR;
}

/**
 * 驗證後的 toLocalIso:年份不在 [MIN_VALID_YEAR, MAX_VALID_YEAR] 或 dateStr 為空時回傳 null,
 * 呼叫端應視為「不合法輸入」— 顯示錯誤、還原欄位為原值、不寫入 store。
 * 合法時回傳與 toLocalIso 相同的 ISO 8601 字串。
 */
export function toLocalIsoValidated(dateStr: string, timeStr: string, fallbackTime = '23:59'): string | null {
  if (!dateStr) return null;
  const year = Number(dateStr.split('-')[0]);
  if (!isYearInValidRange(year)) return null;
  return toLocalIso(dateStr, timeStr, fallbackTime);
}

/** 今天的本地日期字串(YYYY-MM-DD),供表單日期欄預設值使用。 */
export function todayLocalDateStr(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 嚴格 ISO 8601 格式(含時區 Z 或 ±HH:MM),拒絕如 "YYYY/MM/DD" 等非 ISO 寫法。 */
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** ISO 8601 字串 → epoch ms。無效輸入丟 Error(資料層應在寫入前就擋掉)。 */
export function isoToMs(iso: string): number {
  if (typeof iso !== 'string' || !ISO_8601_RE.test(iso)) {
    throw new Error(`isoToMs: invalid ISO 8601 string: ${JSON.stringify(iso)}`);
  }
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`isoToMs: invalid ISO 8601 string: ${JSON.stringify(iso)}`);
  }
  return ms;
}

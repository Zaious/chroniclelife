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

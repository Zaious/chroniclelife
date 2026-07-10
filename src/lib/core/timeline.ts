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
  throw new Error('TODO(M1)');
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
  throw new Error('TODO(M1)');
}

/**
 * 列模式判定:
 * - deadline < now            → 'overdue'
 * - 剩餘 ≤ thresholdHours     → 'countdown'
 * - 其餘                      → 'normal'
 */
export function rowMode(deadlineMs: number, nowMs: number, thresholdHours: number): RowMode {
  throw new Error('TODO(M1)');
}

/**
 * 倒數字串 "HH:MM:SS"(向下取整秒,HH 可 > 99 不進位天)。
 * msRemaining ≤ 0 回傳 "00:00:00"。
 */
export function formatCountdown(msRemaining: number): string {
  throw new Error('TODO(M1)');
}

/**
 * 逾期天數(無條件進位:逾期 1 小時 = 1 天),用於「已逾期 N 天」。
 */
export function overdueDays(deadlineMs: number, nowMs: number): number {
  throw new Error('TODO(M1)');
}

/**
 * 顯示排序 (PLANNING.md §2.2):
 * 1. 排除 done === true
 * 2. 未逾期者在前,依剩餘時間 多 → 少(最緊急沉到最底)
 * 3. 逾期者一律置底,彼此依逾期久 → 新排列
 * 回傳新陣列,不改動輸入。
 */
export function sortTasksForDisplay(tasks: Task[], nowMs: number): Task[] {
  throw new Error('TODO(M1)');
}

/** 檢查點狀態判定:acked → 'acked';at ≤ now → 'due';否則 'upcoming'。 */
export function checkpointState(cp: Checkpoint, nowMs: number): CheckpointState {
  throw new Error('TODO(M1)');
}

/** ISO 8601 字串 → epoch ms。無效輸入丟 Error(資料層應在寫入前就擋掉)。 */
export function isoToMs(iso: string): number {
  throw new Error('TODO(M1)');
}

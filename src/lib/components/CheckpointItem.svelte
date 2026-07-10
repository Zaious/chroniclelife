<script lang="ts">
  /**
   * 編輯 popover 內的單一檢查點列:名稱、日期時間、ack 打勾、移除。
   * 日期/時間欄位 blur(focusout)才 commit(避免 <input type="date"> 逐字輸入年份時
   * 每敲一位數字就觸發 change 寫入);commit 前先驗證年份範圍(toLocalIsoValidated),
   * 再通過 isCheckpointTimeValid(現在~截止日)才寫入 store,任一不合法都 inline 顯示錯誤
   * 並還原欄位(PLANNING.md §2.4)。
   */
  import type { Checkpoint } from '../core/types';
  import {
    toLocalIsoValidated,
    isoToLocalParts,
    isCheckpointTimeValid,
    isoToMs,
    MIN_VALID_YEAR,
    MAX_VALID_YEAR,
  } from '../core/timeline';
  import { updateCheckpoint, removeCheckpoint } from '../stores/app';

  interface Props {
    taskId: string;
    checkpoint: Checkpoint;
    /** 目前時間 epoch ms */
    nowMs: number;
    /** 所屬任務的截止日 epoch ms */
    deadlineMs: number;
  }

  const { taskId, checkpoint, nowMs, deadlineMs }: Props = $props();

  let label = $state('');
  let dateStr = $state('');
  let timeStr = $state('');
  let error = $state('');

  /** checkpoint 內容變動(含我方自己 commit 後的回灌)時,重新同步本地編輯緩衝。 */
  $effect(() => {
    label = checkpoint.label;
    const parts = isoToLocalParts(checkpoint.at);
    dateStr = parts.date;
    timeStr = parts.time;
    error = '';
  });

  function resetTime(): void {
    const parts = isoToLocalParts(checkpoint.at);
    dateStr = parts.date;
    timeStr = parts.time;
  }

  function commitLabel(): void {
    const trimmed = label.trim();
    if (!trimmed) {
      label = checkpoint.label;
      return;
    }
    if (trimmed !== checkpoint.label) updateCheckpoint(taskId, checkpoint.id, { label: trimmed });
  }

  function commitTime(): void {
    if (!dateStr || !timeStr) {
      error = '請填寫日期與時間';
      resetTime();
      return;
    }
    const iso = toLocalIsoValidated(dateStr, timeStr);
    if (!iso) {
      error = `年份需介於 ${MIN_VALID_YEAR} ~ ${MAX_VALID_YEAR} 之間`;
      resetTime();
      return;
    }
    const atMs = isoToMs(iso);
    if (!isCheckpointTimeValid(atMs, nowMs, deadlineMs)) {
      error = '檢查點時間須介於現在與截止日之間';
      resetTime();
      return;
    }
    error = '';
    if (iso !== checkpoint.at) updateCheckpoint(taskId, checkpoint.id, { at: iso });
  }

  function handleAckChange(event: Event): void {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    updateCheckpoint(taskId, checkpoint.id, { acked: checked });
  }

  function handleRemove(): void {
    removeCheckpoint(taskId, checkpoint.id);
  }
</script>

<div class="checkpoint-item">
  <div class="row1">
    <input
      type="checkbox"
      checked={checkpoint.acked}
      onchange={handleAckChange}
      aria-label="確認檢查點"
      title="確認"
    />
    <input
      class="label-input"
      type="text"
      bind:value={label}
      onchange={commitLabel}
      aria-label="檢查點名稱"
    />
    <button type="button" class="remove-btn" onclick={handleRemove} aria-label="移除檢查點">✕</button>
  </div>
  <div class="row2">
    <input type="date" bind:value={dateStr} onblur={commitTime} />
    <input type="time" bind:value={timeStr} onblur={commitTime} />
  </div>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .checkpoint-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  }

  .row1,
  .row2 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .label-input {
    flex: 1 1 auto;
    min-width: 0;
  }

  .row2 input[type='date'],
  .row2 input[type='time'] {
    flex: 1 1 auto;
    min-width: 0;
  }

  .remove-btn {
    flex: 0 0 auto;
    cursor: pointer;
    line-height: 1;
    opacity: 0.7;
  }

  .remove-btn:hover {
    opacity: 1;
  }

  input,
  button {
    font: inherit;
  }

  .error {
    margin: 0;
    color: #ff6b6b;
    font-size: 0.85em;
  }
</style>

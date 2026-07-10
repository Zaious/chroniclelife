<script lang="ts">
  /**
   * 列編輯 popover(PLANNING.md §2.5):貼齊被點擊的列展開。
   * 標題/日期時間/分類即時生效;檢查點清單管理;標記完成/刪除任務。
   * Esc 或點擊 popover 外關閉;由呼叫端(Timeline)保證一次只開一個。
   */
  import { onMount, onDestroy } from 'svelte';
  import type { Task, Category } from '../core/types';
  import { toLocalIso, isoToLocalParts, isCheckpointTimeValid, isoToMs } from '../core/timeline';
  import { updateTask, removeTask, toggleTaskDone, addCheckpoint } from '../stores/app';
  import CheckpointItem from './CheckpointItem.svelte';

  interface Props {
    task: Task;
    categories: Category[];
    /** 目前時間 epoch ms,用於檢查點時間合法範圍判定 */
    nowMs: number;
    /** 被點擊列的 viewport 座標(getBoundingClientRect) */
    anchorTop: number;
    anchorBottom: number;
    onClose: () => void;
  }

  const { task, categories, nowMs, anchorTop, anchorBottom, onClose }: Props = $props();

  let popoverEl: HTMLDivElement | undefined = $state();

  // ---- 標題 / 日期時間(本地緩衝,commit 時才寫入 store) ----
  let title = $state('');
  let dateStr = $state('');
  let timeStr = $state('');

  $effect(() => {
    title = task.title;
    const parts = isoToLocalParts(task.deadline);
    dateStr = parts.date;
    timeStr = parts.time;
  });

  function commitTitle(): void {
    const trimmed = title.trim();
    if (!trimmed) {
      title = task.title;
      return;
    }
    if (trimmed !== task.title) updateTask(task.id, { title: trimmed });
  }

  function commitDeadline(): void {
    if (!dateStr) {
      const parts = isoToLocalParts(task.deadline);
      dateStr = parts.date;
      timeStr = parts.time;
      return;
    }
    const iso = toLocalIso(dateStr, timeStr);
    if (iso !== task.deadline) updateTask(task.id, { deadline: iso });
  }

  function handleCategoryChange(event: Event): void {
    const value = (event.currentTarget as HTMLSelectElement).value;
    updateTask(task.id, { categoryId: value === '' ? null : value });
  }

  function handleMarkDone(): void {
    toggleTaskDone(task.id);
    onClose();
  }

  function handleDelete(): void {
    removeTask(task.id);
    onClose();
  }

  // ---- 新增檢查點 ----
  let newLabel = $state('');
  let newDate = $state('');
  let newTime = $state('');
  let addError = $state('');

  function handleAddCheckpoint(event: SubmitEvent): void {
    event.preventDefault();
    const trimmed = newLabel.trim();
    if (!trimmed || !newDate) {
      addError = '請填寫名稱與日期';
      return;
    }
    const iso = toLocalIso(newDate, newTime, '23:59');
    const atMs = isoToMs(iso);
    const deadlineMs = isoToMs(task.deadline);
    if (!isCheckpointTimeValid(atMs, nowMs, deadlineMs)) {
      addError = '檢查點時間須介於現在與截止日之間';
      return;
    }
    addCheckpoint(task.id, { label: trimmed, at: iso });
    newLabel = '';
    newDate = '';
    newTime = '';
    addError = '';
  }

  // ---- 定位:貼齊列,視窗窄時左右滿版,依上下可用空間決定往上或往下展開 ----
  const GAP = 6;
  const MARGIN = 8;

  interface Placement {
    top?: number;
    bottom?: number;
    maxHeight: number;
  }

  const placement = $derived.by((): Placement => {
    const winH = typeof window !== 'undefined' ? window.innerHeight : 600;
    const spaceBelow = winH - anchorBottom - GAP - MARGIN;
    const spaceAbove = anchorTop - GAP - MARGIN;
    if (spaceBelow >= spaceAbove) {
      return { top: anchorBottom + GAP, maxHeight: Math.max(120, spaceBelow) };
    }
    return { bottom: winH - anchorTop + GAP, maxHeight: Math.max(120, spaceAbove) };
  });

  // ---- 關閉:Esc / 點擊外部 ----
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onClose();
  }

  function handleDocumentMousedown(event: MouseEvent): void {
    if (popoverEl && !popoverEl.contains(event.target as Node)) onClose();
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleDocumentMousedown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleDocumentMousedown);
  });
</script>

<div
  class="popover"
  bind:this={popoverEl}
  style:top={placement.top != null ? `${placement.top}px` : undefined}
  style:bottom={placement.bottom != null ? `${placement.bottom}px` : undefined}
  style:max-height="{placement.maxHeight}px"
  role="dialog"
  aria-label="編輯任務"
>
  <div class="field-row">
    <input class="title-input" type="text" bind:value={title} onchange={commitTitle} aria-label="標題" />
  </div>
  <div class="field-row">
    <input type="date" bind:value={dateStr} onchange={commitDeadline} aria-label="截止日期" />
    <input type="time" bind:value={timeStr} onchange={commitDeadline} aria-label="截止時間" />
  </div>
  <div class="field-row">
    <select value={task.categoryId ?? ''} onchange={handleCategoryChange} aria-label="分類">
      <option value="">未分類</option>
      {#each categories as c (c.id)}
        <option value={c.id}>{c.name}</option>
      {/each}
    </select>
  </div>

  <div class="checkpoints">
    <h4>檢查點</h4>
    {#each task.checkpoints as cp (cp.id)}
      <CheckpointItem taskId={task.id} checkpoint={cp} {nowMs} deadlineMs={isoToMs(task.deadline)} />
    {:else}
      <p class="empty">尚無檢查點</p>
    {/each}

    <form class="add-checkpoint" onsubmit={handleAddCheckpoint}>
      <input type="text" placeholder="檢查點名稱" bind:value={newLabel} aria-label="新檢查點名稱" />
      <input type="date" bind:value={newDate} aria-label="新檢查點日期" />
      <input type="time" bind:value={newTime} aria-label="新檢查點時間" />
      <button type="submit">新增檢查點</button>
    </form>
    {#if addError}
      <p class="error">{addError}</p>
    {/if}
  </div>

  <div class="actions">
    <button type="button" onclick={handleMarkDone}>標記完成</button>
    <button type="button" class="danger" onclick={handleDelete}>刪除任務</button>
  </div>
</div>

<style>
  .popover {
    position: fixed;
    left: 8px;
    right: 8px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    overflow-y: auto;
    background: var(--surface-bg, rgba(24, 24, 28, 0.98));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    font-size: 12px;
    color: inherit;
  }

  .field-row {
    display: flex;
    gap: 6px;
  }

  .title-input {
    flex: 1 1 auto;
    min-width: 0;
  }

  .field-row input,
  .field-row select {
    flex: 1 1 auto;
    min-width: 0;
  }

  input,
  select,
  button {
    font: inherit;
    padding: 0.3rem 0.4rem;
  }

  button {
    cursor: pointer;
  }

  .checkpoints h4 {
    margin: 2px 0 4px 0;
    font-size: 0.95em;
    opacity: 0.8;
  }

  .checkpoints .empty {
    margin: 0 0 4px 0;
    opacity: 0.55;
  }

  .add-checkpoint {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .add-checkpoint input[type='text'] {
    flex: 1 1 auto;
    min-width: 0;
  }

  .error {
    margin: 4px 0 0 0;
    color: #ff6b6b;
    font-size: 0.9em;
  }

  .actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    padding-top: 8px;
  }

  .actions .danger {
    color: #ff6b6b;
    border-color: rgba(255, 107, 107, 0.5);
  }
</style>

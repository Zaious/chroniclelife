<script lang="ts">
  /**
   * 時間軸列容器:排序、列間距、超出時間視窗的隱藏規則 (PLANNING.md §2.2、§6)。
   * 直接訂閱 stores(與 TaskForm / CategoryManager 一致的元件風格),不經 props 轉手。
   */
  import type { Task, RowSpacing } from '../core/types';
  import { UNCATEGORIZED_COLOR } from '../core/types';
  import { tasks, categories, settings } from '../stores/app';
  import { now } from '../stores/now';
  import { sortTasksForDisplay, barRatio, isoToMs, MS_PER_DAY } from '../core/timeline';
  import TimelineRow from './TimelineRow.svelte';
  import EditPopover from './EditPopover.svelte';

  interface Props {
    /** 目前生效的主題(system 已解析成實際的 dark/light);逾期灰階樣式需要據此調整對比度。 */
    themeMode: 'dark' | 'light';
  }

  const { themeMode }: Props = $props();

  const ROW_SPACING_PX: Record<RowSpacing, number> = { compact: 4, normal: 9, loose: 16 };

  function isOverflowing(task: Task, nowMs: number, windowDays: number): boolean {
    const deadlineMs = isoToMs(task.deadline);
    const ratio = barRatio(deadlineMs, nowMs, windowDays);
    const remainingMs = deadlineMs - nowMs;
    return ratio === 1 && remainingMs > windowDays * MS_PER_DAY;
  }

  const nowMs = $derived($now);
  const sortedTasks = $derived(sortTasksForDisplay($tasks, nowMs));
  const visibleTasks = $derived(
    $settings.overflowDisplay === 'hidden'
      ? sortedTasks.filter((t) => !isOverflowing(t, nowMs, $settings.windowDays))
      : sortedTasks,
  );

  const categoryColorMap = $derived(new Map($categories.map((c) => [c.id, c.color])));

  function colorFor(task: Task): string {
    if (!task.categoryId) return UNCATEGORIZED_COLOR;
    return categoryColorMap.get(task.categoryId) ?? UNCATEGORIZED_COLOR;
  }

  const gapPx = $derived(ROW_SPACING_PX[$settings.rowSpacing]);

  /**
   * 條長跨列必須嚴格可比 (PLANNING §2.1):edge 模式下所有列共用同一個標籤欄
   * (max-content = 最寬標籤的寬度),因此所有 track 等寬、同 ratio = 同像素寬、
   * 條的起點切齊同一條線。列本身用 subgrid 貼齊這裡定義的欄位;tail 模式維持單欄。
   */
  const gridTemplate = $derived(
    $settings.labelPosition === 'tail'
      ? '1fr'
      : $settings.dockSide === 'left'
        ? 'max-content 1fr'
        : '1fr max-content',
  );

  /**
   * 列編輯 popover 狀態(PLANNING §2.5):一次只開一個,貼齊被點擊列的 viewport 座標。
   * anchor 只在開啟當下取一次 getBoundingClientRect(),不隨後續 reflow 追蹤 —— popover 開啟期間
   * 使用者多半在編輯,不會大幅調整版面;Esc / 點外部關閉已足以應付。
   */
  let openTaskId = $state<string | null>(null);
  let anchor = $state<{ top: number; bottom: number } | null>(null);

  function handleRowOpen(task: Task, rowEl: HTMLElement): void {
    if (openTaskId === task.id) {
      openTaskId = null;
      anchor = null;
      return;
    }
    const rect = rowEl.getBoundingClientRect();
    anchor = { top: rect.top, bottom: rect.bottom };
    openTaskId = task.id;
  }

  function closePopover(): void {
    openTaskId = null;
    anchor = null;
  }

  const openTask = $derived(visibleTasks.find((t) => t.id === openTaskId) ?? null);
</script>

<div class="timeline-wrap">
  <div class="timeline" style:row-gap="{gapPx}px" style:grid-template-columns={gridTemplate}>
    {#if visibleTasks.length === 0}
      <p class="empty">尚無任務,點擊右上角「+」新增一筆。</p>
    {:else}
      {#each visibleTasks as task (task.id)}
        <TimelineRow
          {task}
          now={nowMs}
          settings={$settings}
          categoryColor={colorFor(task)}
          {themeMode}
          onOpen={handleRowOpen}
        />
      {/each}
    {/if}
  </div>

  {#if openTask && anchor}
    <EditPopover
      task={openTask}
      categories={$categories}
      nowMs={nowMs}
      anchorTop={anchor.top}
      anchorBottom={anchor.bottom}
      onClose={closePopover}
    />
  {/if}
</div>

<style>
  .timeline-wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .timeline {
    display: grid;
    align-content: start;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .empty {
    grid-column: 1 / -1;
    margin: 1rem 0 0 0;
    text-align: center;
    font-size: 0.85rem;
    opacity: 0.55;
  }
</style>

<script lang="ts">
  /**
   * 時間軸單列。純呈現元件:輸入 task + now + settings + 分類色,自行算出
   * 長度比例 / 列模式 / 檢查點狀態(呼叫 core/timeline.ts 的純函式),不碰 store。
   * 規格見 docs/PLANNING.md §2。
   */
  import type { Task, Settings } from '../core/types';
  import {
    barRatio,
    checkpointOffsetRatio,
    checkpointState,
    rowMode as computeRowMode,
    overdueDays as computeOverdueDays,
    formatCountdown,
    isoToMs,
  } from '../core/timeline';
  import { secondNow } from '../stores/secondNow';

  /** 即使剩餘時間趨近於 0,也保留一小截可見殘條 (PLANNING.md §2.1)。 */
  const MIN_BAR_WIDTH_PX = 6;

  const OVERDUE_COLORS = { red: '#e24b4a', gray: '#888888' } as const;
  const CHECKPOINT_DUE_COLOR = '#ff453a';
  const LABEL_COLOR_NORMAL = 'var(--label-color, rgba(240, 240, 240, 0.92))';

  interface Props {
    task: Task;
    /** 目前時間 epoch ms(分鐘級,由 Timeline 的 now store 提供) */
    now: number;
    settings: Settings;
    /** 該任務所屬分類的顯示色(未分類已由呼叫端解析為 UNCATEGORIZED_COLOR) */
    categoryColor: string;
    /** 點擊整列 → 通知呼叫端開啟編輯 popover(PLANNING.md §2.5) */
    onOpen?: (task: Task, rowEl: HTMLElement) => void;
  }

  const { task, now, settings, categoryColor, onOpen }: Props = $props();

  let trackWidth = $state(0);
  let rowEl: HTMLDivElement | undefined = $state();

  const deadlineMs = $derived(isoToMs(task.deadline));
  const mode = $derived(computeRowMode(deadlineMs, now, settings.countdownThresholdHours));

  /**
   * 秒級 tick(CLAUDE.md 硬規則 6):只有在 mode === 'countdown' 時才訂閱 secondNow,
   * 離開倒數模式(或元件卸載)立刻取消訂閱 —— 這是「只有 countdown 列才跑秒級 tick」的實際落點。
   */
  let secondTick = $state<number | null>(null);
  $effect(() => {
    if (mode !== 'countdown') {
      secondTick = null;
      return;
    }
    const unsubscribe = secondNow.subscribe((v) => {
      secondTick = v;
    });
    return () => unsubscribe();
  });

  /** 倒數列用秒級時間計算長度與標籤;其餘列維持分鐘級 now(省電)。 */
  const effectiveNow = $derived(mode === 'countdown' && secondTick != null ? secondTick : now);

  const ratio = $derived(barRatio(deadlineMs, effectiveNow, settings.windowDays));
  const barWidthPx = $derived(Math.max(ratio * trackWidth, MIN_BAR_WIDTH_PX));
  const overdueDaysVal = $derived(mode === 'overdue' ? computeOverdueDays(deadlineMs, now) : 0);
  const isBlinking = $derived(mode === 'countdown' && settings.blinkEnabled);

  function handleRowClick(): void {
    if (rowEl) onOpen?.(task, rowEl);
  }

  function handleRowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick();
    }
  }

  const anchorSide = $derived(settings.dockSide === 'left' ? 'left' : 'right');
  /**
   * 標籤是否為外側(固定於停靠側標籤欄)的 grid 兄弟元素;true = edge 模式。
   * 列本身是 subgrid,貼齊 Timeline 容器定義的共用欄位(標籤欄 = 所有列最寬標籤),
   * 因此所有 track 等寬 → 同 ratio 的條像素等寬且起點切齊 (PLANNING §2.1)。
   */
  const labelIsEdgeSibling = $derived(settings.labelPosition === 'edge');
  /** edge 模式下,標籤應排在 track 之前(dockSide=left)或之後(dockSide=right)。 */
  const edgeLabelBeforeTrack = $derived(settings.labelPosition === 'edge' && settings.dockSide === 'left');
  const edgeLabelAfterTrack = $derived(settings.labelPosition === 'edge' && settings.dockSide === 'right');

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  function formatMD(ms: number): string {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function formatMDHm(ms: number): string {
    const d = new Date(ms);
    return `${formatMD(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const labelText = $derived(
    mode === 'overdue'
      ? `已逾期 ${overdueDaysVal} 天 ${task.title}`
      : mode === 'countdown'
        ? `${formatCountdown(deadlineMs - effectiveNow)} ${task.title}`
        : `${formatMD(deadlineMs)} ${task.title}`,
  );

  const barColor = $derived(
    mode === 'overdue' ? OVERDUE_COLORS[settings.overdueStyle] : categoryColor,
  );
  const labelColor = $derived(mode === 'overdue' ? barColor : LABEL_COLOR_NORMAL);

  /** 簡易變暗:往黑色方向混色 amount ∈ [0,1]。 */
  function darken(hex: string, amount: number): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const num = parseInt(m[1], 16);
    const r = Math.round(((num >> 16) & 0xff) * (1 - amount));
    const g = Math.round(((num >> 8) & 0xff) * (1 - amount));
    const b = Math.round((num & 0xff) * (1 - amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  interface CheckpointVisual {
    id: string;
    offsetPx: number;
    color: string;
    widthPx: number;
    opacity: number;
    title: string;
  }

  const checkpointVisuals = $derived.by((): CheckpointVisual[] => {
    const result: CheckpointVisual[] = [];
    for (const cp of task.checkpoints) {
      const cpMs = isoToMs(cp.at);
      const offset = checkpointOffsetRatio(deadlineMs, cpMs, settings.windowDays);
      if (offset == null) continue;
      const state = checkpointState(cp, now);
      const base =
        state === 'due'
          ? { color: CHECKPOINT_DUE_COLOR, widthPx: 3, opacity: 1 }
          : state === 'acked'
            ? { color: darken(categoryColor, 0.35), widthPx: 2, opacity: 0.4 }
            : { color: darken(categoryColor, 0.35), widthPx: 2, opacity: 1 };
      result.push({
        id: cp.id,
        offsetPx: offset * trackWidth,
        title: `${cp.label} ${formatMDHm(cpMs)}`,
        ...base,
      });
    }
    return result;
  });
</script>

<div
  class="row"
  role="button"
  tabindex="0"
  bind:this={rowEl}
  style:font-size="{settings.fontSizePx}px"
  onclick={handleRowClick}
  onkeydown={handleRowKeydown}
>
  {#if edgeLabelBeforeTrack}
    <span class="label" style:color={labelColor}>{labelText}</span>
  {/if}

  <div
    class="track"
    style:height="{settings.barHeightPx}px"
    bind:clientWidth={trackWidth}
  >
    <div
      class="bar"
      class:blink={isBlinking}
      style="{anchorSide}: 0px;"
      style:background={barColor}
      style:height="{settings.barHeightPx}px"
      style:width="{barWidthPx}px"
    ></div>

    {#each checkpointVisuals as cp (cp.id)}
      <div
        class="checkpoint-line"
        title={cp.title}
        style="{anchorSide}: {cp.offsetPx - cp.widthPx / 2}px;"
        style:background={cp.color}
        style:opacity={cp.opacity}
        style:width="{cp.widthPx}px"
        style:height="{settings.barHeightPx + 6}px"
      ></div>
    {/each}

    {#if !labelIsEdgeSibling}
      <span
        class="label label-tail"
        style="{anchorSide}: {barWidthPx}px;"
        style:color={labelColor}
      >{labelText}</span>
    {/if}
  </div>

  {#if edgeLabelAfterTrack}
    <span class="label" style:color={labelColor}>{labelText}</span>
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    align-items: center;
    min-width: 0;
    cursor: pointer;
  }

  .row:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.04));
  }

  .row:focus-visible {
    outline: 1px solid rgba(79, 142, 247, 0.8);
    outline-offset: -1px;
  }

  .track {
    position: relative;
    min-width: 0;
  }

  .bar {
    position: absolute;
    top: 0;
    border-radius: 999px;
  }

  .bar.blink {
    animation: bar-blink 1s ease-in-out infinite;
  }

  @keyframes bar-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  .checkpoint-line {
    position: absolute;
    top: -3px;
    border-radius: 1px;
    pointer-events: auto;
  }

  .label {
    white-space: nowrap;
    padding: 0 6px;
  }

  .label-tail {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }
</style>

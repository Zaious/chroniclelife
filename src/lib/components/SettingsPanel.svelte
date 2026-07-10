<script lang="ts">
  /**
   * 設定面板(PLANNING.md §6):倒數/外觀/版面/行為設定,全部即時生效(updateSettings 已自動持久化)。
   * 分類管理(CategoryManager)附於底部,與設定面板共用同一個滾動容器。
   * autostart 為 M4 範圍,此處不顯示。
   */
  import { settings, updateSettings } from '../stores/app';
  import type { RowSpacing, Theme, DockSide, LabelPosition, OverflowDisplay, OverdueStyle } from '../core/types';
  import CategoryManager from './CategoryManager.svelte';

  const THRESHOLD_PRESETS = [12, 24, 48] as const;

  function setThreshold(hours: number): void {
    if (hours > 0) updateSettings({ countdownThresholdHours: hours });
  }

  function handleCustomThreshold(event: Event): void {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value) && value > 0) updateSettings({ countdownThresholdHours: value });
  }

  function handleBlinkChange(event: Event): void {
    updateSettings({ blinkEnabled: (event.currentTarget as HTMLInputElement).checked });
  }

  function handleRowSpacingChange(event: Event): void {
    updateSettings({ rowSpacing: (event.currentTarget as HTMLSelectElement).value as RowSpacing });
  }

  function handleBarHeightChange(event: Event): void {
    updateSettings({ barHeightPx: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function handleFontSizeChange(event: Event): void {
    updateSettings({ fontSizePx: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function handleOpacityChange(event: Event): void {
    updateSettings({ windowOpacity: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function handleThemeChange(event: Event): void {
    updateSettings({ theme: (event.currentTarget as HTMLSelectElement).value as Theme });
  }

  function setDockSide(side: DockSide): void {
    updateSettings({ dockSide: side });
  }

  function setLabelPosition(pos: LabelPosition): void {
    updateSettings({ labelPosition: pos });
  }

  function handleWindowDaysChange(event: Event): void {
    updateSettings({ windowDays: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function handleOverflowChange(event: Event): void {
    updateSettings({ overflowDisplay: (event.currentTarget as HTMLSelectElement).value as OverflowDisplay });
  }

  function handlePinnedChange(event: Event): void {
    updateSettings({ alwaysOnTop: (event.currentTarget as HTMLInputElement).checked });
  }

  function handleOverdueStyleChange(event: Event): void {
    updateSettings({ overdueStyle: (event.currentTarget as HTMLSelectElement).value as OverdueStyle });
  }
</script>

<div class="settings-panel">
  <section>
    <h4>倒數</h4>
    <div class="row">
      <span class="label">門檻</span>
      <div class="btn-group">
        {#each THRESHOLD_PRESETS as h (h)}
          <button
            type="button"
            class:active={$settings.countdownThresholdHours === h}
            onclick={() => setThreshold(h)}
          >{h}h</button>
        {/each}
      </div>
      <label class="custom-number">
        自訂
        <input
          type="number"
          min="1"
          max="720"
          value={$settings.countdownThresholdHours}
          onchange={handleCustomThreshold}
        />h
      </label>
    </div>
    <div class="row">
      <label>
        <input type="checkbox" checked={$settings.blinkEnabled} onchange={handleBlinkChange} />
        閃爍效果
      </label>
    </div>
  </section>

  <section>
    <h4>外觀</h4>
    <div class="row">
      <span class="label">行距</span>
      <select value={$settings.rowSpacing} onchange={handleRowSpacingChange}>
        <option value="compact">緊湊</option>
        <option value="normal">標準</option>
        <option value="loose">寬鬆</option>
      </select>
    </div>
    <div class="row">
      <span class="label">條高度</span>
      <input
        type="range"
        min="12"
        max="28"
        step="1"
        value={$settings.barHeightPx}
        oninput={handleBarHeightChange}
      />
      <span class="value">{$settings.barHeightPx}px</span>
    </div>
    <div class="row">
      <span class="label">字體大小</span>
      <input
        type="range"
        min="10"
        max="16"
        step="1"
        value={$settings.fontSizePx}
        oninput={handleFontSizeChange}
      />
      <span class="value">{$settings.fontSizePx}px</span>
    </div>
    <div class="row">
      <span class="label">視窗不透明度</span>
      <input
        type="range"
        min="0.3"
        max="1"
        step="0.05"
        value={$settings.windowOpacity}
        oninput={handleOpacityChange}
      />
      <span class="value">{Math.round($settings.windowOpacity * 100)}%</span>
    </div>
    <div class="row">
      <span class="label">主題</span>
      <select value={$settings.theme} onchange={handleThemeChange}>
        <option value="system">跟隨系統</option>
        <option value="dark">深色</option>
        <option value="light">淺色</option>
      </select>
    </div>
  </section>

  <section>
    <h4>版面</h4>
    <div class="row">
      <span class="label">停靠側</span>
      <div class="btn-group">
        <button type="button" class:active={$settings.dockSide === 'left'} onclick={() => setDockSide('left')}>靠左</button>
        <button type="button" class:active={$settings.dockSide === 'right'} onclick={() => setDockSide('right')}>靠右</button>
      </div>
    </div>
    <div class="row">
      <span class="label">標籤位置</span>
      <div class="btn-group">
        <button type="button" class:active={$settings.labelPosition === 'edge'} onclick={() => setLabelPosition('edge')}>切邊</button>
        <button type="button" class:active={$settings.labelPosition === 'tail'} onclick={() => setLabelPosition('tail')}>條尾端</button>
      </div>
    </div>
    <div class="row">
      <span class="label">時間視窗</span>
      <input
        type="range"
        min="7"
        max="90"
        step="1"
        value={$settings.windowDays}
        oninput={handleWindowDaysChange}
      />
      <span class="value">{$settings.windowDays} 天</span>
    </div>
    <div class="row">
      <span class="label">超出視窗項目</span>
      <select value={$settings.overflowDisplay} onchange={handleOverflowChange}>
        <option value="full">滿條顯示</option>
        <option value="hidden">隱藏</option>
      </select>
    </div>
  </section>

  <section>
    <h4>行為</h4>
    <div class="row">
      <label>
        <input type="checkbox" checked={$settings.alwaysOnTop} onchange={handlePinnedChange} />
        視窗置頂
      </label>
    </div>
    <div class="row">
      <span class="label">逾期樣式</span>
      <select value={$settings.overdueStyle} onchange={handleOverdueStyleChange}>
        <option value="red">紅</option>
        <option value="gray">灰</option>
      </select>
    </div>
  </section>

  <section>
    <CategoryManager />
  </section>
</div>

<style>
  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 12px;
  }

  section + section {
    padding-top: 8px;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  h4 {
    margin: 0 0 6px 0;
    font-size: 0.95em;
    opacity: 0.75;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .row:last-child {
    margin-bottom: 0;
  }

  .label {
    flex: 0 0 auto;
    min-width: 4.5em;
    opacity: 0.85;
  }

  .value {
    flex: 0 0 auto;
    min-width: 3em;
    opacity: 0.7;
    text-align: right;
  }

  .custom-number {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .custom-number input {
    width: 3.5em;
  }

  .btn-group {
    display: flex;
    gap: 4px;
  }

  .btn-group button {
    border-radius: 6px;
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    background: var(--hover-bg, rgba(255, 255, 255, 0.06));
    color: inherit;
    padding: 0.25rem 0.5rem;
  }

  .btn-group button.active {
    background: rgba(79, 142, 247, 0.55);
    border-color: rgba(79, 142, 247, 0.8);
  }

  input,
  select,
  button {
    font: inherit;
  }

  input[type='range'] {
    flex: 1 1 80px;
    min-width: 60px;
  }

  button {
    cursor: pointer;
  }
</style>

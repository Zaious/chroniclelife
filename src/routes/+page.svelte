<script lang="ts">
  /**
   * 組裝層(M2):啟動流程還原視窗位置/停靠、頂部握把(置頂/停靠/管理面板開關)、
   * 管理面板(TaskForm + CategoryManager,暫時樣式,M3 會換成正式設定面板)、Timeline 主體。
   * 邏輯不寫這裡 — 排序/長度計算在 core,CRUD 在 stores,視窗行為在 shell。
   */
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { dockTo, setPinned, onWindowMoved, setWindowPos } from '$lib/shell/window';
  import { initStores, settings, updateSettings } from '$lib/stores/app';
  import type { DockSide } from '$lib/core/types';
  import Timeline from '$lib/components/Timeline.svelte';
  import TaskForm from '$lib/components/TaskForm.svelte';
  import CategoryManager from '$lib/components/CategoryManager.svelte';

  let ready = $state(false);
  let panelOpen = $state(false);
  let unlistenMoved: (() => void) | null = null;

  // 用來偵測「使用者變更了設定」而非「啟動時的初始值」,避免啟動流程與 $effect 重複呼叫。
  let previousAlwaysOnTop: boolean | null = null;
  let previousDockSide: DockSide | null = null;

  onMount(() => {
    void (async () => {
      await initStores();
      const s = get(settings);
      if (s.windowPos) {
        await setWindowPos(s.windowPos.x, s.windowPos.y);
      } else {
        await dockTo(s.dockSide);
      }
      await setPinned(s.alwaysOnTop);
      unlistenMoved = await onWindowMoved((pos) => updateSettings({ windowPos: pos }));
      ready = true;
    })();
  });

  onDestroy(() => {
    unlistenMoved?.();
  });

  // 設定即時生效 (CLAUDE.md 硬規則 5):alwaysOnTop / dockSide 之後的任何變更都同步到實際視窗狀態。
  $effect(() => {
    const alwaysOnTop = $settings.alwaysOnTop;
    if (ready && previousAlwaysOnTop !== null && previousAlwaysOnTop !== alwaysOnTop) {
      void setPinned(alwaysOnTop);
    }
    previousAlwaysOnTop = alwaysOnTop;
  });

  $effect(() => {
    const dockSide = $settings.dockSide;
    if (ready && previousDockSide !== null && previousDockSide !== dockSide) {
      void dockTo(dockSide);
    }
    previousDockSide = dockSide;
  });

  function togglePinned(): void {
    updateSettings({ alwaysOnTop: !$settings.alwaysOnTop });
  }

  function setDock(side: DockSide): void {
    updateSettings({ dockSide: side });
  }

  function togglePanel(): void {
    panelOpen = !panelOpen;
  }

  /** 避免點擊握把上的按鈕時,mousedown 冒泡觸發 data-tauri-drag-region 開始拖曳視窗。 */
  function stopDrag(event: MouseEvent): void {
    event.stopPropagation();
  }
</script>

<main class="shell" style:background={`rgba(20, 20, 24, ${$settings.windowOpacity})`}>
  <div class="handle" data-tauri-drag-region>
    <span class="title">ChronicleLife</span>
    <div class="handle-actions" role="toolbar" aria-label="視窗操作" tabindex="-1" onmousedown={stopDrag}>
      <button
        type="button"
        class="icon-btn"
        class:active={$settings.alwaysOnTop}
        title={$settings.alwaysOnTop ? '取消置頂' : '置頂'}
        onclick={togglePinned}
      >頂</button>
      <button
        type="button"
        class="icon-btn"
        class:active={$settings.dockSide === 'left'}
        title="停靠左側"
        onclick={() => setDock('left')}
      >左</button>
      <button
        type="button"
        class="icon-btn"
        class:active={$settings.dockSide === 'right'}
        title="停靠右側"
        onclick={() => setDock('right')}
      >右</button>
      <button
        type="button"
        class="icon-btn"
        class:active={panelOpen}
        title={panelOpen ? '收合管理面板' : '展開管理面板(新增任務/分類)'}
        onclick={togglePanel}
      >{panelOpen ? '−' : '+'}</button>
    </div>
  </div>

  {#if panelOpen}
    <div class="panel">
      <TaskForm />
      <CategoryManager />
    </div>
  {/if}

  <div class="body">
    <Timeline />
  </div>
</main>

<style>
  :global(html),
  :global(body) {
    background: transparent;
    margin: 0;
    padding: 0;
  }

  .shell {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    border-radius: 12px;
    overflow: hidden;
    color: #f0f0f0;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
  }

  .handle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    font-size: 12px;
    color: rgba(240, 240, 240, 0.7);
    background: rgba(255, 255, 255, 0.06);
    cursor: move;
    user-select: none;
  }

  .title {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .handle-actions {
    flex: 0 0 auto;
    display: flex;
    gap: 4px;
    cursor: default;
  }

  .icon-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    font: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  .icon-btn.active {
    background: rgba(79, 142, 247, 0.55);
    border-color: rgba(79, 142, 247, 0.8);
  }

  .panel {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
  }
</style>

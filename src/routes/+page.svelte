<script lang="ts">
  /**
   * 組裝層(M2):啟動流程還原視窗位置/停靠、頂部握把(置頂/停靠/管理面板開關)、
   * 管理面板(TaskForm + CategoryManager,暫時樣式,M3 會換成正式設定面板)、Timeline 主體。
   * 邏輯不寫這裡 — 排序/長度計算在 core,CRUD 在 stores,視窗行為在 shell。
   */
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { dockTo, setPinned, onWindowMoved, setWindowPos } from '$lib/shell/window';
  import { syncAutostart } from '$lib/shell/autostart';
  import { initStores, settings, updateSettings } from '$lib/stores/app';
  import { degraded } from '$lib/stores/persistence';
  import type { DockSide } from '$lib/core/types';
  import Timeline from '$lib/components/Timeline.svelte';
  import TaskForm from '$lib/components/TaskForm.svelte';
  import SettingsPanel from '$lib/components/SettingsPanel.svelte';

  let ready = $state(false);
  /** 「+」(新增任務)與「⚙」(設定)兩個頂部面板互斥,同時只開一個。 */
  let activePanel = $state<'none' | 'add' | 'settings'>('none');
  let unlistenMoved: (() => void) | null = null;
  let systemPrefersLight = $state(false);

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
      // 開機自啟:讓系統實際登錄狀態追上 settings.autostart(可能因手動改機碼、或上次設定未成功套用而不一致)。
      syncAutostart(s.autostart).catch((err) => {
        console.error('syncAutostart failed', err);
      });
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

  // 主題:system 時跟隨 prefers-color-scheme,並在系統偏好變更時即時反映 (PLANNING.md §6)。
  $effect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    systemPrefersLight = mq.matches;
    const handleChange = (e: MediaQueryListEvent) => {
      systemPrefersLight = e.matches;
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  });

  const effectiveThemeMode = $derived<'dark' | 'light'>(
    $settings.theme === 'system' ? (systemPrefersLight ? 'light' : 'dark') : $settings.theme,
  );

  /** 深色 = 現行配色;淺色 = 白底深字,對比夠即可 (PLANNING.md §6)。 */
  const THEME_PALETTE = {
    dark: { bg: '20, 20, 24', fg: '240, 240, 240', overlay: '255, 255, 255', border: '255, 255, 255' },
    light: { bg: '255, 255, 255', fg: '28, 28, 32', overlay: '0, 0, 0', border: '0, 0, 0' },
  } as const;

  const palette = $derived(THEME_PALETTE[effectiveThemeMode]);
  const shellBg = $derived(`rgba(${palette.bg}, ${$settings.windowOpacity})`);
  const shellFg = $derived(`rgb(${palette.fg})`);
  const labelColorVar = $derived(`rgba(${palette.fg}, 0.92)`);
  /**
   * 標籤文字色塊底色:固定 0.8 alpha(不隨 windowOpacity 變透),讓每條中文標籤
   * 都有自己的可讀底色,無論視窗背後是白網頁或深色桌布 (使用者回饋)。
   */
  const labelBgVar = $derived(`rgba(${palette.bg}, 0.8)`);
  /**
   * 常駐時間軸的文字直接疊在桌布上,給一層與文字色相反的細陰影,
   * 讓黑字/白字在任何桌布底色上都看得清 (使用者回饋 §文字對比)。
   */
  const labelShadowVar = $derived(
    effectiveThemeMode === 'dark'
      ? '0 1px 2px rgba(0, 0, 0, 0.75)'
      : '0 1px 2px rgba(255, 255, 255, 0.85)',
  );
  const hoverBgVar = $derived(`rgba(${palette.overlay}, 0.06)`);
  const iconHoverBgVar = $derived(`rgba(${palette.overlay}, 0.16)`);
  /**
   * 握把列(拖曳區)背景:視窗不透明度可調到 0(全透明),但握把仍需維持一個可見、可辨識的
   * 拖曳把手 —— 底色 alpha 設一個不隨 windowOpacity 降到 0 的地板值(0.15,高於一般 hover
   * 疊色的 0.06),讓使用者在任何不透明度設定下都看得到、抓得到這條拖曳區。
   */
  const handleBgVar = $derived(`rgba(${palette.overlay}, 0.15)`);
  const borderColorVar = $derived(`rgba(${palette.border}, 0.15)`);
  /**
   * 頂部管理面板(新增/設定)一律用不透明實色底:windowOpacity 只作用於常駐時間軸,
   * 面板必須完全可讀,不隨透明度變透 (使用者回饋 §面板不透明)。
   */
  const panelBgVar = $derived(`rgb(${palette.bg})`);
  const panelBorderVar = $derived(`rgba(${palette.border}, 0.08)`);
  /** 列編輯 popover 浮在 Timeline 之上,用不透明實色底才清楚可讀。 */
  const surfaceBgVar = $derived(`rgb(${palette.bg})`);

  function togglePinned(): void {
    updateSettings({ alwaysOnTop: !$settings.alwaysOnTop });
  }

  function toggleAddPanel(): void {
    activePanel = activePanel === 'add' ? 'none' : 'add';
  }

  function toggleSettingsPanel(): void {
    activePanel = activePanel === 'settings' ? 'none' : 'settings';
  }

  /** 避免點擊握把上的按鈕時,mousedown 冒泡觸發 data-tauri-drag-region 開始拖曳視窗。 */
  function stopDrag(event: MouseEvent): void {
    event.stopPropagation();
  }

  /** 完全退出應用程式(非隱藏)——托盤選單「離開」以外,握把列也提供一個直接入口。 */
  function handleQuit(): void {
    void invoke('quit_app').catch((err) => {
      console.error('quit_app failed', err);
    });
  }
</script>

<main
  class="shell"
  style:background={shellBg}
  style:color={shellFg}
  style:--label-color={labelColorVar}
  style:--hover-bg={hoverBgVar}
  style:--icon-hover-bg={iconHoverBgVar}
  style:--border-color={borderColorVar}
  style:--panel-bg={panelBgVar}
  style:--panel-border={panelBorderVar}
  style:--surface-bg={surfaceBgVar}
  style:--handle-bg={handleBgVar}
  style:--label-shadow={labelShadowVar}
  style:--label-bg={labelBgVar}
>
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
        class:active={activePanel === 'add'}
        title={activePanel === 'add' ? '收合新增任務面板' : '新增任務'}
        onclick={toggleAddPanel}
      >{activePanel === 'add' ? '−' : '+'}</button>
      <button
        type="button"
        class="icon-btn"
        class:active={activePanel === 'settings'}
        title={activePanel === 'settings' ? '收合設定面板' : '設定'}
        onclick={toggleSettingsPanel}
      >⚙</button>
      <button
        type="button"
        class="icon-btn"
        title="離開 ChronicleLife"
        onclick={handleQuit}
      >×</button>
    </div>
  </div>

  {#if $degraded}
    <div class="degraded-banner" role="alert">
      ⚠ 資料檔讀取失敗,已進入唯讀模式,重啟後重試
    </div>
  {/if}

  {#if activePanel === 'add'}
    <div class="panel">
      <TaskForm />
    </div>
  {:else if activePanel === 'settings'}
    <div class="panel settings">
      <SettingsPanel />
    </div>
  {/if}

  <div class="body">
    <Timeline themeMode={effectiveThemeMode} />
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
    color: inherit;
    opacity: 0.85;
    background: var(--handle-bg, rgba(255, 255, 255, 0.15));
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
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    background: var(--hover-bg, rgba(255, 255, 255, 0.06));
    color: inherit;
    font: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--icon-hover-bg, rgba(255, 255, 255, 0.16));
  }

  .icon-btn.active {
    background: rgba(79, 142, 247, 0.55);
    border-color: rgba(79, 142, 247, 0.8);
  }

  .degraded-banner {
    flex-shrink: 0;
    padding: 4px 10px;
    font-size: 11px;
    line-height: 1.4;
    color: #fff;
    background: rgba(210, 60, 50, 0.9);
  }

  .panel {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px;
    max-height: 45vh;
    overflow-y: auto;
    background: var(--panel-bg, rgba(0, 0, 0, 0.2));
    border-bottom: 1px solid var(--panel-border, rgba(255, 255, 255, 0.08));
    font-size: 12px;
    color: inherit;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    text-shadow: var(--label-shadow, none);
  }
</style>

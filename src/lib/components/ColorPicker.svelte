<script lang="ts">
  /**
   * App 內建色票選擇器 — 取代原生 <input type="color">。
   *
   * ★ 為什麼不用原生:<input type="color"> 會叫出 Windows 系統調色盤(OS modal),
   *   在透明 + 置頂 + 無邊框的 WebView2 視窗上開啟原生彈窗會導致渲染器崩潰(整個 app 閃退)。
   *   改用純 DOM 的色票面板,永遠不觸發原生 modal,從結構上消除該類崩潰。
   *
   * 面板為絕對定位(相對於自身 wrapper,非 fixed),點擊外部 / Esc / 選色後關閉。
   */
  import { onDestroy } from 'svelte';

  interface Props {
    value: string;
    onchange: (hex: string) => void;
    ariaLabel?: string;
  }

  const { value, onchange, ariaLabel = '選擇顏色' }: Props = $props();

  /** 預設色票(扁平、彼此可辨識)。使用者仍可用 hex 欄位自訂任意色。 */
  const PRESETS = [
    '#4F8EF7', '#378ADD', '#1D9E75', '#5DCAA5',
    '#639922', '#97C459', '#EF9F27', '#E2A03F',
    '#D85A30', '#E24B4A', '#D4537E', '#7F77DD',
    '#9B8CFF', '#888888',
  ];

  const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  let open = $state(false);
  let wrapperEl: HTMLDivElement | undefined = $state();
  let hexDraft = $state('');

  /** #RGB → #RRGGBB;合法時回傳正規化 6 碼小寫,否則 null。 */
  function normalizeHex(input: string): string | null {
    const s = input.trim();
    if (!HEX_RE.test(s)) return null;
    if (s.length === 4) {
      return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    }
    return s.toLowerCase();
  }

  function toggle(): void {
    open = !open;
    if (open) hexDraft = value;
  }

  function pick(hex: string): void {
    onchange(hex);
    open = false;
  }

  function commitHex(): void {
    const norm = normalizeHex(hexDraft);
    if (norm) {
      onchange(norm);
      open = false;
    } else {
      hexDraft = value; // 不合法 → 還原,不寫入
    }
  }

  function handleDocMousedown(event: MouseEvent): void {
    if (wrapperEl && !wrapperEl.contains(event.target as Node)) open = false;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') open = false;
  }

  $effect(() => {
    if (open) {
      document.addEventListener('mousedown', handleDocMousedown);
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('mousedown', handleDocMousedown);
      document.removeEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    document.removeEventListener('mousedown', handleDocMousedown);
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="wrapper" bind:this={wrapperEl}>
  <button
    type="button"
    class="swatch"
    style:background={value}
    aria-label={ariaLabel}
    aria-haspopup="true"
    aria-expanded={open}
    onclick={toggle}
  ></button>

  {#if open}
    <div class="palette" role="dialog" aria-label={ariaLabel}>
      <div class="swatches">
        {#each PRESETS as p (p)}
          <button
            type="button"
            class="preset"
            class:selected={p.toLowerCase() === value.toLowerCase()}
            style:background={p}
            title={p}
            aria-label={p}
            onclick={() => pick(p)}
          ></button>
        {/each}
      </div>
      <div class="hex-row">
        <input
          type="text"
          class="hex-input"
          bind:value={hexDraft}
          onchange={commitHex}
          placeholder="#4F8EF7"
          aria-label="自訂 hex 色碼"
          spellcheck="false"
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .wrapper {
    position: relative;
    display: inline-flex;
  }

  .swatch {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid rgba(128, 128, 128, 0.5);
    border-radius: 6px;
    cursor: pointer;
  }

  .palette {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    padding: 8px;
    border-radius: 8px;
    background: var(--panel-bg, #2a2a30);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .preset {
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: 1px solid rgba(128, 128, 128, 0.4);
    border-radius: 4px;
    cursor: pointer;
  }

  .preset.selected {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }

  .hex-row {
    margin-top: 6px;
  }

  .hex-input {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    font-size: 12px;
  }
</style>

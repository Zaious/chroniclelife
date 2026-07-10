<!-- M0 harness,M2 會整組換掉 -->
<script lang="ts">
  import { dockTo, setPinned } from '$lib/shell/window';

  let pinned = $state(true);

  async function togglePinned() {
    pinned = !pinned;
    await setPinned(pinned);
  }
</script>

<main class="shell">
  <div class="handle" data-tauri-drag-region>
    <span>ChronicleLife</span>
  </div>

  <div class="body">
    <button type="button" onclick={togglePinned}>
      {pinned ? '取消置頂' : '置頂'}
    </button>
    <button type="button" onclick={() => dockTo('left')}>靠左</button>
    <button type="button" onclick={() => dockTo('right')}>靠右</button>
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
    background: rgba(20, 20, 24, 0.75);
    color: #f0f0f0;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
  }

  .handle {
    height: 28px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    color: rgba(240, 240, 240, 0.7);
    background: rgba(255, 255, 255, 0.06);
    cursor: move;
    user-select: none;
  }

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  button {
    width: 140px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
    color: #f0f0f0;
    font-size: 14px;
    cursor: pointer;
  }

  button:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  button:active {
    background: rgba(255, 255, 255, 0.22);
  }
</style>

/**
 * 秒級 tick store — 只給倒數模式列使用(CLAUDE.md 硬規則 6:normal 列每分鐘 tick,
 * 只有 countdown 列才跑秒級 tick)。
 *
 * 與 now.ts 的分鐘級 store 用同一套「排程 + visibility 暫停」模式,只是間隔改成 1 秒。
 * readable() 只在有訂閱者時啟動 interval、最後一個訂閱者離開時自動停止排程 ——
 * 呼叫端(TimelineRow)只在自身 rowMode === 'countdown' 時才訂閱這個 store,
 * 藉此確保「只有 countdown 列才跑秒級 tick」:沒有任何列處於倒數模式時,這裡的計時器完全不會啟動。
 */

import { readable } from 'svelte/store';

const SECOND_MS = 1000;

/** 距離下一個整秒邊界還有多少 ms */
function msUntilNextSecond(): number {
  const rem = Date.now() % SECOND_MS;
  return SECOND_MS - rem;
}

/** 目前的 epoch ms,每秒刷新一次;分頁/視窗隱藏時暫停。 */
export const secondNow = readable(Date.now(), (set) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function isHidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  function scheduleNext(): void {
    if (isHidden()) {
      timer = null;
      return;
    }
    timer = setTimeout(() => {
      set(Date.now());
      scheduleNext();
    }, msUntilNextSecond());
  }

  function handleVisibilityChange(): void {
    if (isHidden()) {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    // 恢復可見:立即刷新一次,再重新排程下一個整秒。
    set(Date.now());
    if (timer == null) scheduleNext();
  }

  // 首次訂閱時立刻刷新一次,避免沿用 store 建立當下(可能已陳舊)的初始值。
  set(Date.now());
  scheduleNext();

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    if (timer != null) clearTimeout(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
});

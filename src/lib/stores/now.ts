/**
 * 分鐘級 tick store — 提供目前的 epoch ms,每分鐘整分對齊更新一次。
 * 省電規則 (CLAUDE.md 硬規則 6):視窗隱藏 (document.visibilityState === 'hidden') 時暫停排程,
 * 恢復可見時立即刷新一次並重新排程。
 *
 * 秒級 tick(倒數模式列專用)是 M3 的範圍;本模組只保留單一分鐘級 store,
 * 未來若需要秒級刷新,可在 M3 另外用同樣的「排程 + visibility 暫停」模式加一個 secondNow store,
 * 或讓需要秒級更新的元件（倒數列）自行疊加一個較短間隔的 setInterval,不影響這裡的分鐘級介面。
 */

import { readable } from 'svelte/store';

const MINUTE_MS = 60_000;

/** 距離下一個整分邊界還有多少 ms */
function msUntilNextMinute(): number {
  const rem = Date.now() % MINUTE_MS;
  return MINUTE_MS - rem;
}

/** 目前的 epoch ms,每分鐘整分對齊刷新一次;分頁/視窗隱藏時暫停。 */
export const now = readable(Date.now(), (set) => {
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
    }, msUntilNextMinute());
  }

  function handleVisibilityChange(): void {
    if (isHidden()) {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    // 恢復可見:立即刷新一次,再重新排程下一個整分。
    set(Date.now());
    if (timer == null) scheduleNext();
  }

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

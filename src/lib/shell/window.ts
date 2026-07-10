/**
 * 視窗行為封裝 — 置頂、停靠、拖曳、位置記憶。
 * 規格見 docs/PLANNING.md §7(Windows 視窗實作要點)。
 * 所有座標一律以「邏輯像素(logical pixels)」為單位對外曝露,
 * 內部與 currentMonitor() / outerPosition() 回傳的物理像素互轉時皆用該視窗的 scaleFactor()。
 */

import { currentMonitor, getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

const appWindow = getCurrentWindow();

/** 停靠側:靠左 / 靠右。 */
export type DockSide = 'left' | 'right';

/** 切換視窗是否「永遠置頂」。 */
export async function setPinned(on: boolean): Promise<void> {
  await appWindow.setAlwaysOnTop(on);
}

/**
 * 停靠到螢幕工作區(扣除工作列)的左緣或右緣,視窗尺寸不變、垂直位置不變。
 * 以 currentMonitor() 取得工作區座標(物理像素),用 scaleFactor 換算成邏輯像素後計算。
 * 若拿不到目前螢幕資訊(理論上不應發生),則靜默放棄。
 */
export async function dockTo(side: DockSide): Promise<void> {
  const monitor = await currentMonitor();
  if (!monitor) return;

  const scaleFactor = monitor.scaleFactor;
  const workAreaPos = monitor.workArea.position.toLogical(scaleFactor);
  const workAreaSize = monitor.workArea.size.toLogical(scaleFactor);

  const outerSizePhysical = await appWindow.outerSize();
  const windowSize = outerSizePhysical.toLogical(scaleFactor);

  const currentPosPhysical = await appWindow.outerPosition();
  const currentPos = currentPosPhysical.toLogical(scaleFactor);

  const x =
    side === 'left'
      ? workAreaPos.x
      : workAreaPos.x + workAreaSize.width - windowSize.width;

  await appWindow.setPosition(new LogicalPosition(x, currentPos.y));
}

/** 開始拖曳視窗(供自訂標題列/握把區呼叫,取代原生標題列拖曳)。 */
export async function startDrag(): Promise<void> {
  await appWindow.startDragging();
}

/**
 * 監聽視窗移動,debounce 500ms 後才觸發回呼(供之後寫入 settings 用,避免拖曳過程頻繁存檔)。
 * 回傳 unlisten 函式,呼叫它可取消監聽。
 */
export async function onWindowMoved(
  cb: (pos: { x: number; y: number }) => void,
  debounceMs = 500,
): Promise<UnlistenFn> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unlisten = await appWindow.onMoved(({ payload }) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        const scaleFactor = await appWindow.scaleFactor();
        const logical = payload.toLogical(scaleFactor);
        cb({ x: logical.x, y: logical.y });
      })();
    }, debounceMs);
  });

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    unlisten();
  };
}

/** 取得目前視窗位置(邏輯像素)。 */
export async function getWindowPos(): Promise<{ x: number; y: number }> {
  const scaleFactor = await appWindow.scaleFactor();
  const physical = await appWindow.outerPosition();
  const logical = physical.toLogical(scaleFactor);
  return { x: logical.x, y: logical.y };
}

/** 設定視窗位置(邏輯像素)。 */
export async function setWindowPos(x: number, y: number): Promise<void> {
  await appWindow.setPosition(new LogicalPosition(x, y));
}

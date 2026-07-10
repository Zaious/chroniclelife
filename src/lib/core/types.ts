/**
 * 領域型別 — 唯一事實來源。
 * 規格見 docs/PLANNING.md §5。
 * 此目錄 (src/lib/core) 禁止任何 DOM / Svelte / Tauri 依賴。
 */

/** 檢查點:任務截止日前的中途提醒點 (PLANNING.md §2.4) */
export interface Checkpoint {
  id: string;
  label: string;
  /** ISO 8601 含時區,例如 "2026-07-13T20:00:00+08:00" */
  at: string;
  /** 使用者已確認(打勾) */
  acked: boolean;
}

export interface Task {
  id: string;
  title: string;
  /** ISO 8601 含時區;使用者未填時間時存當日 23:59 */
  deadline: string;
  categoryId: string | null;
  done: boolean;
  createdAt: string;
  checkpoints: Checkpoint[];
}

export interface Category {
  id: string;
  name: string;
  /** hex 色碼,例如 "#4F8EF7" */
  color: string;
}

/** data.json 的完整內容 */
export interface AppData {
  schemaVersion: 1;
  tasks: Task[];
  categories: Category[];
}

export type DockSide = 'left' | 'right';
/** edge = 標籤切齊停靠側(預設);tail = 標籤跟在條尾端 */
export type LabelPosition = 'edge' | 'tail';
export type RowSpacing = 'compact' | 'normal' | 'loose';
export type Theme = 'system' | 'light' | 'dark';
export type OverdueStyle = 'red' | 'gray';
/** 超過時間視窗的項目:full = 滿條顯示,hidden = 隱藏 */
export type OverflowDisplay = 'full' | 'hidden';

/** settings.json 的完整內容 (PLANNING.md §6) */
export interface Settings {
  schemaVersion: 1;
  /** 倒數模式門檻,小時 (12 / 24 / 48 / 自訂) */
  countdownThresholdHours: number;
  blinkEnabled: boolean;
  rowSpacing: RowSpacing;
  barHeightPx: number;
  fontSizePx: number;
  /** 0 ~ 1.0(0 = 容器全透明,只剩內容可見) */
  windowOpacity: number;
  theme: Theme;
  dockSide: DockSide;
  labelPosition: LabelPosition;
  /** 時間視窗:滿條 = N 天 */
  windowDays: number;
  overflowDisplay: OverflowDisplay;
  alwaysOnTop: boolean;
  autostart: boolean;
  overdueStyle: OverdueStyle;
  /** 上次視窗位置;null = 未記錄(首次啟動吸附預設停靠側) */
  windowPos: { x: number; y: number } | null;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  countdownThresholdHours: 24,
  blinkEnabled: false,
  rowSpacing: 'normal',
  barHeightPx: 18,
  fontSizePx: 12,
  windowOpacity: 0.9,
  theme: 'system',
  dockSide: 'right',
  labelPosition: 'edge',
  windowDays: 30,
  overflowDisplay: 'full',
  alwaysOnTop: true,
  autostart: false,
  overdueStyle: 'red',
  windowPos: null,
};

export const DEFAULT_DATA: AppData = {
  schemaVersion: 1,
  tasks: [],
  categories: [],
};

/** 未分類任務的顯示色 */
export const UNCATEGORIZED_COLOR = '#9aa0a6';

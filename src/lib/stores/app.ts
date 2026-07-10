/**
 * 應用層級 Svelte stores:tasks / categories / settings。
 * 所有變更皆透過這裡的 action 函式進行(不要在元件內直接 .set/.update 底層陣列),
 * 這樣才能保證每次變更都會觸發 debounced 持久化。
 */

import { writable, get } from 'svelte/store';
import type { AppData, Category, Checkpoint, Settings, Task } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { loadData, loadSettings, saveDataDebounced, saveSettingsDebounced } from './persistence';

export const tasks = writable<Task[]>([]);
export const categories = writable<Category[]>([]);
export const settings = writable<Settings>(DEFAULT_SETTINGS);

/** initStores() 完成前不持久化,避免用空白初始狀態覆寫磁碟上的既有資料。 */
let initialized = false;

/** 啟動時載入 data.json / settings.json 並灌入 stores。App 啟動流程呼叫一次即可。 */
export async function initStores(): Promise<void> {
  const [data, loadedSettings] = await Promise.all([loadData(), loadSettings()]);
  tasks.set(data.tasks);
  categories.set(data.categories);
  settings.set(loadedSettings);
  initialized = true;
}

function persistData(): void {
  if (!initialized) return;
  const data: AppData = {
    schemaVersion: 1,
    tasks: get(tasks),
    categories: get(categories),
  };
  saveDataDebounced(data);
}

function persistSettings(): void {
  if (!initialized) return;
  saveSettingsDebounced(get(settings));
}

function newId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 任務 (Task) CRUD
// ---------------------------------------------------------------------------

export interface AddTaskInput {
  title: string;
  /** ISO 8601 含時區字串 */
  deadline: string;
  categoryId: string | null;
}

export function addTask(input: AddTaskInput): Task {
  const task: Task = {
    id: newId(),
    title: input.title,
    deadline: input.deadline,
    categoryId: input.categoryId,
    done: false,
    createdAt: new Date().toISOString(),
    checkpoints: [],
  };
  tasks.update((list) => [...list, task]);
  persistData();
  return task;
}

export function updateTask(
  id: string,
  patch: Partial<Pick<Task, 'title' | 'deadline' | 'categoryId' | 'done'>>,
): void {
  tasks.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  persistData();
}

export function removeTask(id: string): void {
  tasks.update((list) => list.filter((t) => t.id !== id));
  persistData();
}

export function toggleTaskDone(id: string): void {
  tasks.update((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  persistData();
}

// ---------------------------------------------------------------------------
// 檢查點 (Checkpoint) CRUD — 以 task id + checkpoint id 操作
// ---------------------------------------------------------------------------

export interface AddCheckpointInput {
  label: string;
  /** ISO 8601 含時區字串 */
  at: string;
}

export function addCheckpoint(taskId: string, input: AddCheckpointInput): void {
  const checkpoint: Checkpoint = {
    id: newId(),
    label: input.label,
    at: input.at,
    acked: false,
  };
  tasks.update((list) =>
    list.map((t) => (t.id === taskId ? { ...t, checkpoints: [...t.checkpoints, checkpoint] } : t)),
  );
  persistData();
}

export function updateCheckpoint(
  taskId: string,
  checkpointId: string,
  patch: Partial<Pick<Checkpoint, 'label' | 'at' | 'acked'>>,
): void {
  tasks.update((list) =>
    list.map((t) =>
      t.id === taskId
        ? {
            ...t,
            checkpoints: t.checkpoints.map((c) => (c.id === checkpointId ? { ...c, ...patch } : c)),
          }
        : t,
    ),
  );
  persistData();
}

export function removeCheckpoint(taskId: string, checkpointId: string): void {
  tasks.update((list) =>
    list.map((t) =>
      t.id === taskId ? { ...t, checkpoints: t.checkpoints.filter((c) => c.id !== checkpointId) } : t,
    ),
  );
  persistData();
}

/** 確認(打勾)檢查點 */
export function ackCheckpoint(taskId: string, checkpointId: string): void {
  updateCheckpoint(taskId, checkpointId, { acked: true });
}

// ---------------------------------------------------------------------------
// 分類 (Category) CRUD
// ---------------------------------------------------------------------------

export interface AddCategoryInput {
  name: string;
  color: string;
}

export function addCategory(input: AddCategoryInput): Category {
  const category: Category = { id: newId(), name: input.name, color: input.color };
  categories.update((list) => [...list, category]);
  persistData();
  return category;
}

export function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): void {
  categories.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  persistData();
}

/** 刪分類:該分類底下的任務 categoryId 一併設為 null(歸入「未分類」,PLANNING.md §3.1 F2)。 */
export function removeCategory(id: string): void {
  categories.update((list) => list.filter((c) => c.id !== id));
  tasks.update((list) => list.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)));
  persistData();
}

// ---------------------------------------------------------------------------
// 設定 (Settings)
// ---------------------------------------------------------------------------

export function updateSettings(partial: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...partial }));
  persistSettings();
}

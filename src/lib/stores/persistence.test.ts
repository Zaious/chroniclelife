/**
 * 驗證 M4 資料安全加固的降級模式(degraded/read-only mode)行為:
 * - invoke 被拒絕(對應 Rust 端 Err,例如檔案被鎖定/權限問題)→ 回傳預設值,且進入降級模式。
 * - invoke 成功但內容不是合法 JSON(壞檔)→ 同樣回傳預設值並進入降級模式。
 * - invoke 成功且內容合法 → 正常回傳,不進入降級模式。
 * - 降級模式下,saveDataDebounced / saveSettingsDebounced 必須是 no-op(不得呼叫 invoke)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { loadData, loadSettings, saveDataDebounced, saveSettingsDebounced, degraded } from './persistence';
import { DEFAULT_DATA, DEFAULT_SETTINGS, type AppData } from '../core/types';

describe('persistence degraded mode', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    degraded.set(false);
    vi.useRealTimers();
  });

  it('loadData: invoke reject (locked/permission error) -> defaults + degraded=true', async () => {
    invokeMock.mockRejectedValueOnce('讀取 data.json 失敗: 權限被拒');
    const data = await loadData();
    expect(data).toEqual(DEFAULT_DATA);
    expect(get(degraded)).toBe(true);
  });

  it('loadData: invoke resolves corrupt (non-JSON) content -> defaults + degraded=true, original left untouched', async () => {
    invokeMock.mockResolvedValueOnce('not valid json {{{');
    const data = await loadData();
    expect(data).toEqual(DEFAULT_DATA);
    expect(get(degraded)).toBe(true);
  });

  it('loadData: invoke resolves null (file genuinely absent) -> defaults, degraded stays false', async () => {
    invokeMock.mockResolvedValueOnce(null);
    const data = await loadData();
    expect(data).toEqual(DEFAULT_DATA);
    expect(get(degraded)).toBe(false);
  });

  it('loadData: invoke resolves valid JSON -> parsed data, degraded stays false', async () => {
    const stored: AppData = { schemaVersion: 1, tasks: [], categories: [] };
    invokeMock.mockResolvedValueOnce(JSON.stringify(stored));
    const data = await loadData();
    expect(data).toEqual(stored);
    expect(get(degraded)).toBe(false);
  });

  it('loadData: valid JSON with leading UTF-8 BOM (hand-edited file) -> parsed normally, not degraded', async () => {
    const stored: AppData = { schemaVersion: 1, tasks: [], categories: [] };
    invokeMock.mockResolvedValueOnce('\uFEFF' + JSON.stringify(stored));
    const data = await loadData();
    expect(data).toEqual(stored);
    expect(get(degraded)).toBe(false);
  });

  it('loadSettings: invoke reject -> defaults + degraded=true', async () => {
    invokeMock.mockRejectedValueOnce('讀取 settings.json 失敗: 檔案被鎖定');
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(get(degraded)).toBe(true);
  });

  it('saveDataDebounced is a no-op once degraded (no invoke call scheduled)', async () => {
    vi.useFakeTimers();
    degraded.set(true);
    saveDataDebounced({ schemaVersion: 1, tasks: [], categories: [] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(invokeMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('saveSettingsDebounced is a no-op once degraded (no invoke call scheduled)', async () => {
    vi.useFakeTimers();
    degraded.set(true);
    saveSettingsDebounced(DEFAULT_SETTINGS);
    await vi.advanceTimersByTimeAsync(2000);
    expect(invokeMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('saveDataDebounced still writes normally when not degraded', async () => {
    vi.useFakeTimers();
    invokeMock.mockResolvedValueOnce(undefined);
    saveDataDebounced({ schemaVersion: 1, tasks: [], categories: [] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(invokeMock).toHaveBeenCalledWith('save_data', expect.objectContaining({ json: expect.any(String) }));
    vi.useRealTimers();
  });
});

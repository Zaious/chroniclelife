import { describe, it, expect } from 'vitest';
import {
  MS_PER_DAY,
  barRatio,
  checkpointOffsetRatio,
  rowMode,
  formatCountdown,
  overdueDays,
  sortTasksForDisplay,
  checkpointState,
  isoToMs,
  isCheckpointTimeValid,
  toLocalIso,
  isoToLocalParts,
  isYearInValidRange,
  toLocalIsoValidated,
  todayLocalDateStr,
} from './timeline';
import type { Task, Checkpoint } from './types';

const HOUR = 3_600_000;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'id',
    title: overrides.title ?? 'title',
    deadline: overrides.deadline ?? '2026-07-15T23:59:00+08:00',
    categoryId: overrides.categoryId ?? null,
    done: overrides.done ?? false,
    createdAt: overrides.createdAt ?? '2026-07-01T00:00:00+08:00',
    checkpoints: overrides.checkpoints ?? [],
  };
}

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: overrides.id ?? 'cp-id',
    label: overrides.label ?? 'label',
    at: overrides.at ?? '2026-07-10T00:00:00+08:00',
    acked: overrides.acked ?? false,
  };
}

describe('barRatio', () => {
  it('回傳 0.5 當剩餘時間為視窗一半', () => {
    const now = 0;
    const windowDays = 10;
    const deadline = 5 * MS_PER_DAY;
    expect(barRatio(deadline, now, windowDays)).toBeCloseTo(0.5);
  });

  it('剛好等於視窗長度時回傳 1(上界)', () => {
    const now = 0;
    const windowDays = 10;
    const deadline = 10 * MS_PER_DAY;
    expect(barRatio(deadline, now, windowDays)).toBe(1);
  });

  it('超過視窗時 clamp 到 1', () => {
    const now = 0;
    const windowDays = 10;
    const deadline = 20 * MS_PER_DAY;
    expect(barRatio(deadline, now, windowDays)).toBe(1);
  });

  it('已逾期 (deadline < now) 回傳 0', () => {
    const now = 10 * MS_PER_DAY;
    const deadline = 5 * MS_PER_DAY;
    expect(barRatio(deadline, now, 10)).toBe(0);
  });

  it('deadline 恰等於 now 回傳 0', () => {
    const now = 12345;
    expect(barRatio(now, now, 10)).toBe(0);
  });
});

describe('checkpointOffsetRatio', () => {
  const windowDays = 10;
  const deadline = 10 * MS_PER_DAY;

  it('checkpoint 在視窗中間回傳 0.5', () => {
    const checkpoint = deadline - 5 * MS_PER_DAY;
    expect(checkpointOffsetRatio(deadline, checkpoint, windowDays)).toBeCloseTo(0.5);
  });

  it('checkpoint 恰在 deadline 時回傳 0(邊界合法)', () => {
    expect(checkpointOffsetRatio(deadline, deadline, windowDays)).toBe(0);
  });

  it('checkpoint 晚於 deadline 回傳 null', () => {
    expect(checkpointOffsetRatio(deadline, deadline + 1, windowDays)).toBeNull();
  });

  it('checkpoint 恰在視窗起點回傳 1(邊界合法)', () => {
    const windowStart = deadline - windowDays * MS_PER_DAY;
    expect(checkpointOffsetRatio(deadline, windowStart, windowDays)).toBe(1);
  });

  it('checkpoint 早於視窗起點回傳 null', () => {
    const beforeWindow = deadline - windowDays * MS_PER_DAY - 1;
    expect(checkpointOffsetRatio(deadline, beforeWindow, windowDays)).toBeNull();
  });
});

describe('rowMode', () => {
  it('deadline < now 為 overdue', () => {
    expect(rowMode(0, 1, 24)).toBe('overdue');
  });

  it('deadline 恰等於 now 不算 overdue,落入 countdown', () => {
    expect(rowMode(1000, 1000, 24)).toBe('countdown');
  });

  it('剩餘恰等於門檻為 countdown(邊界)', () => {
    const now = 0;
    const deadline = 24 * HOUR;
    expect(rowMode(deadline, now, 24)).toBe('countdown');
  });

  it('剩餘略高於門檻為 normal', () => {
    const now = 0;
    const deadline = 24 * HOUR + 1;
    expect(rowMode(deadline, now, 24)).toBe('normal');
  });

  it('剩餘略低於門檻為 countdown', () => {
    const now = 0;
    const deadline = 24 * HOUR - 1;
    expect(rowMode(deadline, now, 24)).toBe('countdown');
  });
});

describe('formatCountdown', () => {
  it('格式化為 HH:MM:SS', () => {
    expect(formatCountdown(3661_000)).toBe('01:01:01');
  });

  it('msRemaining <= 0 回傳 00:00:00', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-1000)).toBe('00:00:00');
  });

  it('向下取整秒(忽略毫秒餘數)', () => {
    expect(formatCountdown(1999)).toBe('00:00:01');
  });

  it('HH 可超過 99 且不進位成天', () => {
    const ms = 100 * HOUR + 30 * 60_000 + 5_000;
    expect(formatCountdown(ms)).toBe('100:30:05');
  });
});

describe('overdueDays', () => {
  it('未逾期(remaining > 0)回傳 0', () => {
    expect(overdueDays(1000, 0)).toBe(0);
  });

  it('deadline 恰等於 now 回傳 0', () => {
    expect(overdueDays(1000, 1000)).toBe(0);
  });

  it('逾期 1 小時無條件進位為 1 天', () => {
    expect(overdueDays(0, HOUR)).toBe(1);
  });

  it('逾期恰好 24 小時為 1 天', () => {
    expect(overdueDays(0, MS_PER_DAY)).toBe(1);
  });

  it('逾期 24 小時又 1ms 為 2 天', () => {
    expect(overdueDays(0, MS_PER_DAY + 1)).toBe(2);
  });
});

describe('sortTasksForDisplay', () => {
  it('排除 done 的任務', () => {
    const now = 0;
    const tasks = [
      makeTask({ id: 'a', deadline: new Date(now + MS_PER_DAY).toISOString(), done: true }),
      makeTask({ id: 'b', deadline: new Date(now + MS_PER_DAY).toISOString(), done: false }),
    ];
    const result = sortTasksForDisplay(tasks, now);
    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('未逾期依剩餘時間多到少排序(最緊急在最底)', () => {
    const now = 0;
    const tasks = [
      makeTask({ id: 'soon', deadline: new Date(now + 1 * MS_PER_DAY).toISOString() }),
      makeTask({ id: 'far', deadline: new Date(now + 10 * MS_PER_DAY).toISOString() }),
      makeTask({ id: 'mid', deadline: new Date(now + 5 * MS_PER_DAY).toISOString() }),
    ];
    const result = sortTasksForDisplay(tasks, now);
    expect(result.map((t) => t.id)).toEqual(['far', 'mid', 'soon']);
  });

  it('逾期任務一律置底,依逾期久到新排序', () => {
    const now = 10 * MS_PER_DAY;
    const tasks = [
      makeTask({ id: 'notdue', deadline: new Date(now + MS_PER_DAY).toISOString() }),
      makeTask({ id: 'overdue-new', deadline: new Date(now - 1 * MS_PER_DAY).toISOString() }),
      makeTask({ id: 'overdue-old', deadline: new Date(now - 5 * MS_PER_DAY).toISOString() }),
    ];
    const result = sortTasksForDisplay(tasks, now);
    expect(result.map((t) => t.id)).toEqual(['notdue', 'overdue-old', 'overdue-new']);
  });

  it('deadline 恰等於 now 不算逾期', () => {
    const now = 1_000_000;
    const tasks = [makeTask({ id: 'exact', deadline: new Date(now).toISOString() })];
    const result = sortTasksForDisplay(tasks, now);
    expect(result.map((t) => t.id)).toEqual(['exact']);
  });

  it('不改動輸入陣列(回傳新陣列)', () => {
    const now = 0;
    const tasks = [
      makeTask({ id: 'a', deadline: new Date(now + MS_PER_DAY).toISOString() }),
      makeTask({ id: 'b', deadline: new Date(now + 2 * MS_PER_DAY).toISOString() }),
    ];
    const original = [...tasks];
    const result = sortTasksForDisplay(tasks, now);
    expect(tasks).toEqual(original);
    expect(result).not.toBe(tasks);
  });

  it('剩餘時間相同時維持原始相對順序(排序穩定)', () => {
    const now = 0;
    const sameDeadline = new Date(now + MS_PER_DAY).toISOString();
    const tasks = [
      makeTask({ id: 'first', deadline: sameDeadline }),
      makeTask({ id: 'second', deadline: sameDeadline }),
      makeTask({ id: 'third', deadline: sameDeadline }),
    ];
    const result = sortTasksForDisplay(tasks, now);
    expect(result.map((t) => t.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('checkpointState', () => {
  it('acked 為 true 時一律回傳 acked', () => {
    const cp = makeCheckpoint({ at: '2026-07-01T00:00:00+08:00', acked: true });
    const now = isoToMs('2020-01-01T00:00:00+08:00');
    expect(checkpointState(cp, now)).toBe('acked');
  });

  it('at 恰等於 now 為 due(邊界)', () => {
    const at = '2026-07-10T00:00:00+08:00';
    const cp = makeCheckpoint({ at, acked: false });
    expect(checkpointState(cp, isoToMs(at))).toBe('due');
  });

  it('at 早於 now 為 due', () => {
    const cp = makeCheckpoint({ at: '2026-07-10T00:00:00+08:00', acked: false });
    expect(checkpointState(cp, isoToMs('2026-07-11T00:00:00+08:00'))).toBe('due');
  });

  it('at 晚於 now 為 upcoming', () => {
    const cp = makeCheckpoint({ at: '2026-07-10T00:00:00+08:00', acked: false });
    expect(checkpointState(cp, isoToMs('2026-07-01T00:00:00+08:00'))).toBe('upcoming');
  });
});

describe('isoToMs', () => {
  it('正確轉換含時區的 ISO 8601 字串', () => {
    expect(isoToMs('2026-07-15T23:59:00+08:00')).toBe(Date.parse('2026-07-15T23:59:00+08:00'));
  });

  it('無效字串會 throw', () => {
    expect(() => isoToMs('not-a-date')).toThrow();
  });

  it('非 ISO 格式的日期字串(YYYY/MM/DD)會 throw', () => {
    expect(() => isoToMs('2026/07/15')).toThrow();
  });

  it('空字串會 throw', () => {
    expect(() => isoToMs('')).toThrow();
  });
});

describe('isCheckpointTimeValid', () => {
  it('介於現在與截止日之間(含邊界)回傳 true', () => {
    expect(isCheckpointTimeValid(500, 0, 1000)).toBe(true);
    expect(isCheckpointTimeValid(0, 0, 1000)).toBe(true);
    expect(isCheckpointTimeValid(1000, 0, 1000)).toBe(true);
  });

  it('早於現在回傳 false', () => {
    expect(isCheckpointTimeValid(-1, 0, 1000)).toBe(false);
  });

  it('晚於截止日回傳 false', () => {
    expect(isCheckpointTimeValid(1001, 0, 1000)).toBe(false);
  });
});

describe('toLocalIso / isoToLocalParts', () => {
  it('組出的 ISO 字串轉回 epoch ms 等於本地時間建構的 Date', () => {
    const iso = toLocalIso('2026-07-15', '09:30');
    const expected = new Date(2026, 6, 15, 9, 30, 0, 0).getTime();
    expect(isoToMs(iso)).toBe(expected);
  });

  it('時間留空時預設 23:59', () => {
    const iso = toLocalIso('2026-07-15', '');
    const expected = new Date(2026, 6, 15, 23, 59, 0, 0).getTime();
    expect(isoToMs(iso)).toBe(expected);
  });

  it('可自訂 fallbackTime', () => {
    const iso = toLocalIso('2026-07-15', '', '08:00');
    const expected = new Date(2026, 6, 15, 8, 0, 0, 0).getTime();
    expect(isoToMs(iso)).toBe(expected);
  });

  it('輸出符合含時區的 ISO 8601 格式', () => {
    const iso = toLocalIso('2026-07-15', '09:30');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('isoToLocalParts 為 toLocalIso 的反函式', () => {
    const iso = toLocalIso('2026-07-15', '09:30');
    expect(isoToLocalParts(iso)).toEqual({ date: '2026-07-15', time: '09:30' });
  });

  it('isoToLocalParts 正確還原分鐘個位數補零', () => {
    const iso = toLocalIso('2026-01-05', '08:05');
    expect(isoToLocalParts(iso)).toEqual({ date: '2026-01-05', time: '08:05' });
  });
});

describe('isYearInValidRange', () => {
  it('下界 2000 與上界 2200 皆合法(含邊界)', () => {
    expect(isYearInValidRange(2000)).toBe(true);
    expect(isYearInValidRange(2200)).toBe(true);
  });

  it('一般年份合法', () => {
    expect(isYearInValidRange(2026)).toBe(true);
  });

  it('低於下界不合法', () => {
    expect(isYearInValidRange(1999)).toBe(false);
    expect(isYearInValidRange(2)).toBe(false);
    expect(isYearInValidRange(0)).toBe(false);
  });

  it('高於上界不合法', () => {
    expect(isYearInValidRange(2201)).toBe(false);
  });

  it('非整數(NaN)不合法', () => {
    expect(isYearInValidRange(NaN)).toBe(false);
  });
});

describe('toLocalIsoValidated', () => {
  it('合法輸入回傳與 toLocalIso 相同結果', () => {
    expect(toLocalIsoValidated('2026-07-15', '09:30')).toBe(toLocalIso('2026-07-15', '09:30'));
  });

  it('年份逐字輸入的中間態(如 "0002")回傳 null', () => {
    expect(toLocalIsoValidated('0002-07-12', '10:00')).toBeNull();
  });

  it('年份低於下界回傳 null', () => {
    expect(toLocalIsoValidated('1999-07-12', '10:00')).toBeNull();
  });

  it('年份高於上界回傳 null', () => {
    expect(toLocalIsoValidated('2201-07-12', '10:00')).toBeNull();
  });

  it('空日期字串回傳 null', () => {
    expect(toLocalIsoValidated('', '10:00')).toBeNull();
  });

  it('時間留空時沿用 fallbackTime', () => {
    expect(toLocalIsoValidated('2026-07-15', '')).toBe(toLocalIso('2026-07-15', ''));
  });
});

describe('todayLocalDateStr', () => {
  it('回傳本地時區的 YYYY-MM-DD', () => {
    const nowMs = new Date(2026, 6, 15, 13, 45, 0, 0).getTime();
    expect(todayLocalDateStr(nowMs)).toBe('2026-07-15');
  });

  it('月份與日期個位數補零', () => {
    const nowMs = new Date(2026, 0, 5, 0, 0, 0, 0).getTime();
    expect(todayLocalDateStr(nowMs)).toBe('2026-01-05');
  });
});

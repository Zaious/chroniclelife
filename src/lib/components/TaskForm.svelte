<script lang="ts">
  /**
   * 新增任務表單。只依賴 stores(不依賴 shell/或 routes/),M2 再決定如何掛入頁面。
   * 日期必填,時間選填 — 未填時間時存當日 23:59(本地時區)。
   * 存檔一律轉為含時區偏移的 ISO 8601 字串(CLAUDE.md 硬規則 1)。
   */
  import { categories, addTask } from '../stores/app';

  let title = $state('');
  let dateStr = $state('');
  let timeStr = $state('');
  let categoryId = $state<string | null>(null);

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  /** 由本地日期/時間欄位組出含本地時區偏移的 ISO 8601 字串,例如 2026-07-15T23:59:00+08:00 */
  function toLocalIso(date: string, time: string): string {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (time || '23:59').split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);

    const offsetMin = -dt.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
    const offM = pad(Math.abs(offsetMin) % 60);

    return (
      `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
      `T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}` +
      `${sign}${offH}:${offM}`
    );
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !dateStr) return;

    const deadline = toLocalIso(dateStr, timeStr);
    addTask({ title: trimmedTitle, deadline, categoryId });

    title = '';
    dateStr = '';
    timeStr = '';
    categoryId = null;
  }
</script>

<form class="task-form" onsubmit={handleSubmit}>
  <input class="title-input" type="text" placeholder="任務標題" bind:value={title} required />
  <input type="date" bind:value={dateStr} required />
  <input type="time" bind:value={timeStr} title="未填則為當日 23:59" />
  <select bind:value={categoryId}>
    <option value={null}>未分類</option>
    {#each $categories as c (c.id)}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
  <button type="submit">新增任務</button>
</form>

<style>
  .task-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .title-input {
    flex: 1 1 160px;
    min-width: 0;
  }

  input,
  select,
  button {
    font: inherit;
    padding: 0.35rem 0.5rem;
  }

  button {
    cursor: pointer;
  }
</style>

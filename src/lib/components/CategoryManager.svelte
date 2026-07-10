<script lang="ts">
  /**
   * 分類管理:清單 + 新增/改名/改色/刪除。
   * 只依賴 stores(不依賴 shell/或 routes/),M2/M3 再打磨樣式。
   * 刪除分類時,該分類底下任務的 categoryId 由 store 端(removeCategory)設為 null(PLANNING.md §3.1 F2)。
   */
  import { categories, addCategory, updateCategory, removeCategory } from '../stores/app';

  const DEFAULT_COLOR = '#4F8EF7';

  let newName = $state('');
  let newColor = $state(DEFAULT_COLOR);

  function handleAdd(event: SubmitEvent): void {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    addCategory({ name: trimmed, color: newColor });
    newName = '';
    newColor = DEFAULT_COLOR;
  }

  function handleRename(id: string, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    updateCategory(id, { name: value });
  }

  function handleColorChange(id: string, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    updateCategory(id, { color: value });
  }

  function handleRemove(id: string): void {
    removeCategory(id);
  }
</script>

<div class="category-manager">
  <h3>分類管理</h3>

  <ul class="category-list">
    {#each $categories as c (c.id)}
      <li>
        <input
          class="color-input"
          type="color"
          value={c.color}
          onchange={(e) => handleColorChange(c.id, e)}
          aria-label="分類顏色"
        />
        <input
          class="name-input"
          type="text"
          value={c.name}
          onchange={(e) => handleRename(c.id, e)}
          aria-label="分類名稱"
        />
        <button type="button" onclick={() => handleRemove(c.id)}>刪除</button>
      </li>
    {:else}
      <li class="empty">尚未建立分類</li>
    {/each}
  </ul>

  <form class="add-form" onsubmit={handleAdd}>
    <input class="color-input" type="color" bind:value={newColor} aria-label="新分類顏色" />
    <input class="name-input" type="text" placeholder="新分類名稱" bind:value={newName} required />
    <button type="submit">新增分類</button>
  </form>
</div>

<style>
  .category-manager h3 {
    margin: 0 0 0.5rem 0;
  }

  .category-list {
    list-style: none;
    margin: 0 0 0.5rem 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .category-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .empty {
    opacity: 0.6;
  }

  .add-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .name-input {
    flex: 1 1 140px;
    min-width: 0;
  }

  .color-input {
    width: 2rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  input,
  button {
    font: inherit;
  }

  button {
    cursor: pointer;
  }
</style>

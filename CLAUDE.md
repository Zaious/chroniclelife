# ChronicleLife — 開發規範

桌面倒數時間軸 Widget(Tauri 2 + Svelte 5 + TypeScript)。
**完整產品規格在 [docs/PLANNING.md](docs/PLANNING.md),動工前必讀。**

## 指令

- `npm run tauri dev` — 開發模式(啟動視窗)
- `npm run check` — svelte-check 型別檢查(改完 TS/Svelte 必跑)
- `npm test` — vitest 單元測試(core 模組必須有測試)
- `cargo check` (在 src-tauri/) — Rust 快速編譯檢查

## 架構地圖與檔案歸屬

```
src/lib/core/        純函式領域邏輯(types.ts, timeline.ts)
                     ★ 硬規則:禁止 import DOM / Svelte / @tauri-apps。
                     ★ 這是跨平台防腐層,所有時間計算集中於此,必配 vitest 測試。
src/lib/stores/      Svelte stores(tasks, categories, settings)+ 持久化橋接
src/lib/shell/       視窗行為 TS 封裝(置頂、停靠、拖曳、位置記憶)
src/lib/components/  UI 元件(TimelineRow, EditPopover, SettingsPanel, ...)
src/routes/          SvelteKit 頁面(組裝層,邏輯不寫這裡)
src-tauri/src/       Rust:視窗/tray/持久化 commands
```

## 硬規則

1. **時間**:一律存 ISO 8601 含時區字串;計算一律轉 epoch ms。禁止字串日期比較、禁止 `new Date('YYYY/MM/DD')` 這類非 ISO 解析。
2. **持久化**:只透過 Rust commands(`load_data` / `save_data` / `load_settings` / `save_settings`),寫入必須原子(先寫 `.tmp` 再 rename)。前端不直接碰檔案系統。資料檔在 app data dir:`data.json`、`settings.json`(分離,見 PLANNING.md §5.2)。
3. **core 純淨**:`src/lib/core/` 內不得出現任何平台 API。timeline.ts 的函式契約(JSDoc)即規格,實作不得偷改簽名。
4. **UI 文字**:繁體中文。
5. **設定即時生效**:所有 Settings 欄位變更立刻反映,不需重啟。
6. **省電**:normal 列每分鐘 tick 一次;只有 countdown 列才跑秒級 tick;視窗隱藏時暫停。
7. 不新增 npm/cargo 依賴,除非任務說明明確允許。

## 驗證

- 改 core → `npm test` 全綠
- 改 Svelte/TS → `npm run check` 零錯誤
- 改 Rust → `cargo check` 零錯誤
- 視窗行為改動 → `npm run tauri dev` 實際啟動確認

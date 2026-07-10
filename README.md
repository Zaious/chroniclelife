# ChronicleLife

一個釘選在桌面邊緣的輕量倒數時間軸 Widget。以「隨時間縮短的橫向長條」呈現多個截止日倒數,越接近截止的項目排在越下方;支援自訂分類與顏色、任務檢查點、24h/48h 倒數計時模式、無邊框透明視窗、置頂、靠左/靠右停靠、開機自啟。所有資料存在本機 JSON 檔,離線運作,無帳號、無雲端。

完整產品規格見 [docs/PLANNING.md](docs/PLANNING.md)。

技術棧:Tauri 2(Rust)+ SvelteKit 5 + TypeScript + Vite。

作者:[Zaious](https://github.com/Zaious) · 授權:[MIT](LICENSE)

## 下載

到 [Releases](https://github.com/Zaious/chroniclelife/releases) 頁下載最新版:

- `ChronicleLife_x.y.z_x64-setup.exe` — Windows 安裝版
- `chroniclelife.exe` — 免安裝單一執行檔,雙擊即用(Win11 內建 WebView2,無需額外安裝)

資料存在 `%APPDATA%\life.chronicle.app\`,與安裝/移除無關。

## 開發

前置需求:Node.js、Rust toolchain(Windows 上另需 WebView2,Win11 內建)。

```bash
npm install          # 安裝前端依賴(首次或依賴變動後)
npm run tauri dev    # 開發模式,啟動桌面視窗
npm run check        # svelte-check 型別檢查
npm test             # vitest 單元測試(core 模組)
```

Rust 端變更後,可在 `src-tauri/` 下執行 `cargo check` 做快速編譯檢查。

## 打包

```bash
npm run tauri build
```

編譯完成後,安裝檔位於 `src-tauri/target/release/bundle/nsis/*.exe`,免安裝執行檔位於 `src-tauri/target/release/chroniclelife.exe`。

## 發布

推送 `v*` 標籤即由 GitHub Actions 自動編譯並建立 Release(見 `.github/workflows/release.yml`):

```bash
npm version patch          # 更新版號並產生 commit + tag(或手動 git tag v0.1.1)
git push --follow-tags
```

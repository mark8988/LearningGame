# 森知冒險 LearningGame

國小學科複習的 3D 學習冒險。依據 [ARCHITECTURE.md](ARCHITECTURE.md) 分階段開發；**小屋、地圖、角色與戰鬥使用真正的 WebGL 3D**，題目及功能面板使用 React DOM。

## 本機執行

需求：Node.js 22.12+（目前以 Node 24 驗證）、npm、支援 WebGL 2 的現代瀏覽器。

```sh
npm ci
npm run dev
```

開啟終端列出的本機網址。滑鼠拖曳／單指拖曳旋轉場景，滾輪／雙指縮放。遊戲適用平板橫向，也提供手機版面。

```sh
npm test          # 純函數、資料包、存檔、狀態機測試
npm run build    # TypeScript 檢查與正式靜態網站建置
npm run preview  # 預覽 dist 正式建置
npm run test:e2e # Edge 瀏覽器，平板觸控與手機主流程測試
```

E2E 預設使用本機 Microsoft Edge，不會自動安裝瀏覽器；若環境沒有 Edge，請在 `playwright.config.ts` 改用已安裝的 Playwright Chromium。測試會自行啟動 4173 埠的本機網站。

## GitHub Pages 部署

推送到 `main` 後，`.github/workflows/pages.yml` 會使用 Node.js 24 安裝鎖定依賴、執行單元測試、建置並部署 `dist/`。GitHub 儲存庫 Settings → Pages 的 Source 須設為 **GitHub Actions**。

Vite 使用相對資源路徑 `base: './'`，可部署在 `/LearningGame/` 子目錄。網站只發布 `dist/` 靜態檔案；本機憑證、測試產物、工作紀錄及舊專案流程模板均不納入版本控制。瀏覽器存檔依網站來源區分，本機開發的進度不會自動轉移到線上網站。

## 開發範圍

- Phase 0：React 18、Vite、TypeScript、Tailwind、Zustand；JSON 型別與內容驗證、`SaveRepository`、starter 家具庫存、3D 空小屋與角色。
- Phase 1：線性解鎖地圖、3D Boss 戰鬥、答題解析、錯題池、等級／傷害公式、勝敗與金幣／經驗／星等。
- 後續 Phase 2–6：掉落與商店、格子佈置、3D 換裝、圖鑑／複習／成就、家長模式與 PWA。
- CF-A–CF-C：獨立的 ASP.NET Core 教材內容工廠，尚未實作。遊戲不依賴後端即可運行。

此版本尚未提供 PWA 離線、匯出／匯入、商店或家具擺放。新遊戲有四件 starter 家具庫存，房間依 Phase 0 規格先保持空場景。

## 程式組織

`src/app/` 畫面；`src/components/` 程序式 3D 場景與模型；`src/stores/` Zustand 遊戲狀態；`src/logic/` 可測試純函數及存檔介面；`src/data/` Zod 型別、格式與跨檔引用驗證；`content-packs/science-g3/` 五單元、60 題示範資料；`tests/` Playwright 流程。

示範題庫僅供開發測試，非課本擷取內容，正式教材須經未來內容工廠及人工審核。`scripts/generate-demo-pack.mjs` 可重新產生展示包，執行會覆寫內建展示 JSON，請勿用於保留人工編修的內容。

## 存檔與數值

存檔 key：`learning-adventure:save:v1`，變更後 debounce 500ms 寫入，頁面隱藏或關閉前補寫。損毀檔備份到 `:corrupt:<時間>`；不支援的版本保留原檔並停用覆寫。瀏覽器限制儲存時會提示；無帳號與雲端備份，清除網站資料會移除存檔。

等級在進戰鬥時固定，答對即得 10 XP，通關再得 50 XP；未結算金幣在敗退時不發。提前擊敗 Boss 的全對獎勵與星等，依本場實際作答題數計算。最多優先混入三題錯題；若一般題不足，從其餘錯題補滿十道不重複題。進度與戰鬥數值不受外觀影響。

3D 採 React Three Fiber 8 搭配 React 18（[官方版本相容說明](https://r3f.docs.pmnd.rs/getting-started/installation)），不需要外部模型、貼圖或字體服務。未提供 WebGL 時會顯示明確提示。

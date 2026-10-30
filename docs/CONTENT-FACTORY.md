# 本機教材內容工廠（CF-A–CF-C）

## 範圍與資料位置

CF-A 處理教材上傳、文字擷取／OCR、單元切分及歸類；CF-B 以本機模型產生題目及知識草稿，供家長逐項審核。CF-C 將已核准單元打包為可直接匯入遊戲的 JSON，詳見 [CONTENT-PACKAGING.md](CONTENT-PACKAGING.md)。原有已核准草稿檔仍是中間格式，不能直接匯入遊戲。

依本次使用者選擇，預設在 Windows x64 本機執行 ASP.NET Core 8。服務只綁定 loopback，不開放區域網路；上傳原檔、文字、歸類與確認紀錄放在儲存庫根目錄 `factory-data/`，不會提交 GitHub 或發布到 Pages。本機 OCR 不需要雲端金鑰，歸類使用明確規則與證據，不假稱已呼叫語言模型。

GitHub Pages 繼續提供 3D 遊戲；家長模式新增「開啟本機內容工廠」。請在執行工廠的同一台電腦使用，平板上的 localhost 指向平板本身。

## 安裝與啟動

需求：Windows x64、.NET SDK 8 或更新且具 .NET 8 執行階段、Node.js 24、npm。首次準備需要連網安裝 NuGet／npm 依賴及下載 OCR 語言包；之後的預設教材處理不對外傳送內容。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Setup-Factory.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Factory.ps1
```

開啟 `http://127.0.0.1:5088/`。可用 `Start-Factory.ps1 -Port 5090` 更換連接埠，並在遊戲家長模式調整本機服務位址。停止終端服務不會刪除教材；重啟後會恢復未完成的處理佇列。

繁中採官方 `tessdata_best`、英文採 `tessdata_fast`，固定 Git commit 並檢查 SHA-256，放在 `.tools/tessdata/`。程式使用 PDFPig 擷取文字、PDFium／Skia 轉圖與 Tesseract OCR。掃描 PDF 參考原圖解析度轉圖，避免無效放大；辨識結果保留頁碼、方法及 OCR 信心。相容字形正規化及中文字間空白整理不改變來源頁序。

## 操作流程

1. 新增教材，選擇一份 PDF／EPUB，或依序選擇 JPG／PNG 圖片；圖片可調整順序。合計最多 200 MB、最多 600 頁。
2. 指定不同的封面與目錄頁碼。PDF 以檔案頁序編號；EPUB 第 1 頁為書籍資訊、第 2 頁為目錄，之後依 spine 閱讀順序編頁，不假稱是紙本頁碼。
3. 上傳後由背景 Worker 擷取。頁面每 1.5 秒更新狀態；原檔與階段結果持久保存。
4. 封面、目錄或內頁文字不足時停在「需要補頁」，可補傳該頁清晰 JPG／PNG，再按重新擷取。若原檔根本缺少頁面，請重新上傳完整教材。
5. 依正文標題切分單元；無標題時嘗試目錄頁碼；仍不明確則每三頁暫分一個「待確認單元」，保留來源範圍並要求家長命名。
6. 科目／年級不明、歸類信心低於 0.7、單元不明，或包含 OCR 內容時，停在家長確認。可修正學制、年級、科目、出版社及單元頁碼；單元不可空白、重複或重疊。確認結果與原始建議分開保存。

本機規則能讀取明示的課程標記；對模糊教材採低信心及人工確認，不會憑關鍵字編造完整課程。信心值是流程判斷依據，不能當作經過校準的辨識正確率。

## API 與擴充介面

| API | 用途 |
| --- | --- |
| `GET /api/health` | 本機模式、OCR 就緒狀態與可用分類 |
| `POST /api/documents` | multipart 上傳：`title`、`coverPage`、`tocPage`、`files` |
| `GET /api/documents/{id}` | 狀態、逐頁文字、單元、片段、歸類及確認紀錄 |
| `POST /api/documents/{id}/pages/{number}` | 補傳一頁圖片，不覆寫原檔 |
| `POST /api/documents/{id}/retry` | 指定封面／目錄頁碼，重新擷取 |
| `POST /api/documents/{id}/confirm` | 帶 revision 確認分類與單元，拒絕過期編輯 |
| `GET /api/documents/{id}/export` | 匯出 SourceDocument 紀錄，供後續 CF-B 使用 |

`IOcrProvider` 提供本機 Tesseract 與 Azure Document Intelligence 實作；`ILlmProvider` 提供本機規則與 Anthropic 實作。預設均為 Local，設定雲端供應商才會傳出教材。雲端 HTTP 合約以測試伺服回應驗證，尚未使用真實雲端金鑰驗收。

若日後選擇雲端，可在不納版控的 `factory/ContentFactory/appsettings.Local.json` 或環境變數設定 `Factory__OcrProvider=Azure`、`Factory__AzureEndpoint`、`Factory__AzureKey`，或 `Factory__ClassificationProvider=Anthropic`、`Factory__AnthropicApiKey`、`Factory__AnthropicModel`。模型名稱由使用者指定。此本機版本仍不開放對外主機；正式遠端託管需要另行處理身分與存取隔離。

## 測試素材與保留

```sh
node scripts/generate-factory-fixtures.mjs
npm run test:factory
npm run build:factory
npm run test:factory:e2e
```

素材由自寫內容產生，放在 `.local/factory-fixtures/`：十種學制／年級／科目的電子 PDF、對應掃描 PDF、逐頁圖片及缺封面／無課程標示案例。`case-3-text.pdf`、`case-3-scan.pdf` 為三年級自然。這不是出版教材，也不能代替真實課本的辨識率驗收。

依使用者指示，測試完成後保留教材，不執行清除；再次執行產生器也保留既有同名檔案，只新增缺少的素材。後端單元測試素材另存 `.local/factory-unit-data/`，瀏覽器測試紀錄存 `.local/factory-e2e-data/`；人工批次驗證紀錄可存 `.local/factory-api-data/`。這些目錄均排除版本控制。

後端單元測試涵蓋明示／模糊歸類、分頁切分、持久保存、檔案驗證及供應商合約；瀏覽器流程使用實際本機 OCR。正式驗收仍需要使用者的真實電子與掃描教材樣本，確認至少十份的科目／年級歸類表現。

CF-B 本機模型、國中課程、混合題型、逐項審核與保留測試教材說明見 [QUESTION-DRAFTS.md](QUESTION-DRAFTS.md)。

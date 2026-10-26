# 混合題型與國中教材（CF-B）

產題支援台灣國小 1–6、國中 7–9 年級。國中「國文」歸為國語文，「理化／生物／地球科學」可歸為自然科學；家長可修正歸類。模型依確認後的年級、科目和教材出題，不會自行補齊整套課綱。內建遊戲仍是小三自然展示包，沒有內附完整國中題庫。

## 本機模型與產題

完成教材擷取及必要的人工確認，選單元與模型，再按「產生新批次草稿」。預設從 llama.cpp `http://127.0.0.1:8080/v1/models` 與 Ollama `http://127.0.0.1:11434/api/tags` 讀取模型清單，優先選已提供服務的 Qwen，也可切換 Gemma。只允許 loopback，不下載或更換已安裝模型；教材保留本機。

可用 `Factory__LocalModelEndpoint`、`Factory__OllamaEndpoint` 調整模型服務連接埠。模型必須先啟動，單純下載完成不代表已提供服務。

每單元產生 **8 題四選一、4 題填空、3 篇知識草稿**，附解析及來源頁碼／摘錄。難度為易 4／中 6／難 2；選擇題 A–D 正解比例各須 15%–35%，填空不計入選項分佈。逐題指定考點與輸出結構，不合格最多重生三次，失敗保留內容並可重試；文字不足不會硬湊題數。

## 填空作答與審核

填空草稿依來源摘錄挖空：模型挑選原文與答案，程式確認答案只出現一次後替換，避免漏掉空格或整段複製。題幹有一個 `___`，提供 1–8 個可接受答案，第一個為參考答案且須能在原文找到。遊戲戰鬥與錯題複習皆支援文字輸入、正誤回饋與參考答案；空白提交不扣血、不計次，重複提交不重複發獎。選擇題舊格式保持相容。

比對採全半形、英文大小寫與前後空白正規化。例如 `H₂O` 與 `ｈ２ｏ` 相符；`1/2` 與 `0.5`、其他同義詞須由家長明列，不使用模型即時評分。

逐項對照教材頁，核准、編輯、退回或重生。修改／重生會撤銷該項核准，其他項目保留；版本及模型嘗試保存在 `factory-data/drafts/`。格式通過不代表學術正確，仍須人工檢查正解、別名、干擾項及解析。

十二題及至少兩篇知識核准、檢查通過，才可下載 `learning-adventure:approved-drafts`。未核准及退回內容不會混入；教材文字、歸類或單元變更，舊批次停止放行。這份草稿供 **CF-C 打包**，尚不能直接匯入遊戲。

## API

| API | 用途 |
| --- | --- |
| `GET /api/generation/models` | 已啟用本機模型 |
| `POST /api/documents/{id}/batches` | 帶教材 revision、unitIndex、model 開始產題 |
| `GET /api/batches/{id}` | 草稿、進度、錯誤與放行條件 |
| `PUT /api/batches/{id}/{kind}/{itemId}` | 保存編輯，kind 為 questions／entries |
| `POST /api/batches/{id}/{kind}/{itemId}/review` | 帶項目 revision，approve／return（退回附 note） |
| `POST /api/batches/{id}/{kind}/{itemId}/regenerate` | 帶項目 revision、instruction 重生單項 |
| `POST /api/batches/{id}/cancel`、`/retry` | 停止或接續未完成工作 |
| `GET /api/batches/{id}/approved` | 通過條件後下載已核准草稿 |

## 保留測試教材

執行 `node scripts/generate-review-fixture.mjs`、`node scripts/generate-junior-fixture.mjs`，新增自編小三植物與國二理化 PDF／文字稿。檔案保存在 `.local/factory-fixtures/generation-plant.*`、`generation-junior.*`；既有同名檔案不覆寫，測試後不刪除。這些素材供流程驗證，不能當作真實出版教材的正確率驗收。

`npm run test:factory:e2e` 的實際產題測試需要本機 Qwen；未啟動時會標示略過，不會偷偷改用雲端。啟動與 OCR 設定見 [CONTENT-FACTORY.md](CONTENT-FACTORY.md)。

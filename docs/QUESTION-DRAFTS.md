# 混合題型與國中教材（CF-B）

產題支援台灣國小 1–6、國中 7–9 年級。國中「國文」歸為國語文，「理化／生物／地球科學」可歸為自然科學；家長可修正歸類。模型依確認後的年級、科目和教材出題，不會自行補齊整套課綱。內建遊戲仍是小三自然展示包，沒有內附完整國中題庫。

## 本機模型與產題

完成教材擷取及必要的人工確認，選單元與模型，再按「產生新批次草稿」。預設從 llama.cpp `http://127.0.0.1:8080/v1/models` 與 Ollama `http://127.0.0.1:11434/api/tags` 讀取模型清單，優先選已提供服務的 Qwen，也可切換 Gemma。只允許 loopback，不下載或更換已安裝模型；教材保留本機。

可用 `Factory__LocalModelEndpoint`、`Factory__OllamaEndpoint` 調整模型服務連接埠。模型必須先啟動，單純下載完成不代表已提供服務。

題量依單元內容規劃，**沒有固定十二題或固定難度配比**。產題前顯示候選知識點、來源頁及估算依據：

- 去除重複文字及 PDF 換行，逐頁辨識有內容的敘述，不只依頁數或字數判斷。
- 基本理解每點規劃一題；出現因果／條件／比較、實驗／程序／推論、公式／計算等訊號時，每點增加至二或三種考法。
- 選擇與填空混合，約三分之一為原文回想；保留較複雜考點的應用與推論選擇題。單元很短時可只有一或兩題，知識草稿亦依來源為一至三篇。
- 估算是可檢查的規則，不是校準過的學術難度。模型判定某考點來源不足時記錄並略過，實際題數可能低於估算，不硬湊。格式或重複題等錯誤最多重試三次，仍失敗則保留工作供續跑。
- 選擇題正解位置按實際題數平均，各位置相差不超過一題；平衡時只交換選項位置，保留正確答案內容與歷史，不改動已核准項目。填空不計入此分佈。

原有批次保留舊規劃及所有審核結果；從同一教材產生新批次即可套用動態題量。

## 填空作答與審核

填空草稿依來源摘錄挖空：模型挑選原文與答案，程式確認答案只出現一次後替換，避免漏掉空格或整段複製。題幹有一個 `___`，提供 1–8 個可接受答案，第一個為參考答案且須能在原文找到。遊戲戰鬥與錯題複習皆支援文字輸入、正誤回饋與參考答案；空白提交不扣血、不計次，重複提交不重複發獎。選擇題舊格式保持相容。

比對採全半形、英文大小寫與前後空白正規化。例如 `H₂O` 與 `ｈ２ｏ` 相符；`1/2` 與 `0.5`、其他同義詞須由家長明列，不使用模型即時評分。

逐項對照教材頁，核准、編輯、退回或重生。修改／重生會撤銷該項核准，其他項目保留；版本及模型嘗試保存在 `factory-data/drafts/`。格式通過不代表學術正確，仍須人工檢查正解、別名、干擾項及解析。

本批所有實際產生的題目核准，且知識條目達到來源支持的最低數量並檢查通過，才可下載 `learning-adventure:approved-drafts`。未核准及退回內容不會混入；教材文字、歸類或單元變更，舊批次停止放行。這份草稿供 **CF-C 打包**，尚不能直接匯入遊戲。

## API

| API | 用途 |
| --- | --- |
| `GET /api/documents/{id}/question-plan?unitIndex=0` | 預覽知識點、複雜度及動態題量 |
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

## 挑戰從題庫抽題

題庫總量與每次挑戰分開。挑戰最多隨機抽十題，通常混入約三成目前單元的錯題；一般題不足時才補其他錯題，忽略其他單元及未知的錯題 ID。同場依題目 ID 去重，重新挑戰會重新抽題，跨場可以遇到相同題。短單元依實際題數挑戰並按比例調整 Boss 生命，避免必須湊到十或十二題才能遊玩。

`node scripts/generate-adaptive-fixture.mjs` 會新增並保留 `adaptive-junior.pdf` 與文字稿，含簡短基礎和較複雜的兩個單元；既有檔案不覆寫。

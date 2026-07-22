# 專案永久工作規則

在本專案中執行任何開發工作，都必須遵守以下規範。

---

## 零、固定開工規範

每次開始任何任務前，必須先讀並遵守以下文件，不可只依賴聊天記憶：

1. `AGENTS.md`：本檔，定義工作流程、安全邊界與回報格式。
2. `project-rules.md`：目前已定案的產品規則、資料規則、API 成本規則與驗收重點。
3. `design.md`：需要理解完整產品設計、資料流、API、評分、部署或外部資料時必讀。

若聊天要求與上述文件衝突，除非使用者明確要求更新規則文件，否則以文件規則為準，並在回報中指出衝突點。

固定協作規則：

1. 一律使用台灣繁體中文回覆。
2. 除了刪除檔案、刪除資料、改寫 Git 歷史、force push、hard reset、merge、rebase、部署到會產生成本的後端服務之外，其餘一般開發與文件修改不需要反覆詢問，直接執行。
3. 刪除任何檔案、資料夾或資料，一定要先取得使用者明確同意。
4. 不可使用假資料、死資料或 demo fallback 假裝是真實 Google API 資料。
5. 手機直式版型優先；UI 修改至少要考慮 360px 到 480px 寬度。
6. 任何新功能、濾網、詳情、路線、AI、圖片或外部資料功能，都必須先考慮 API 調用量與成本。
7. 修改後不可只說完成；必須回報驗證方式。沒有跑過的檢查不可宣稱通過。
8. 遇到中文亂碼或 `???`，必須先判斷是終端顯示問題還是檔案內容真的壞掉；以 UTF-8 讀檔與瀏覽器實際畫面為準。
9. 每次正式部署前，至少要確認：無明顯亂碼、首頁不自動搜尋、濾網按「套用」才查詢、手機版面不擠壓、版本號已更新。
10. 使用者明確要求「不要再問」時，除本章第 2、3 點列出的高風險事項外，直接推進。

## 零之一、十分鐘接手流程

新接手的工程師或 AI agent 請依下列順序建立正確心智模型：

1. 讀 `AGENTS.md`（或內容相同的 `agent.md`），確認安全邊界、Git 與回報規則。
2. 讀 `project-rules.md`，確認使用者已定案的產品行為；不可用個人偏好推翻。
3. 讀 `design.md`，理解架構、資料流、API 契約、搜尋演算法、評分與部署。
4. 讀 `VERSION`，再對照正式站 Logo 右側短版號；兩者不符代表部署尚未同步。
5. 執行 `git status --short --branch`，辨識目前 branch、既有修改與未追蹤檔案，不可覆蓋他人工作。
6. 依任務只讀相關模組；不要一開始掃描所有大型 JSON、歷史快照或 `node_modules`。
7. 修改前先建立可重現問題或測試，修改後執行本檔「最低驗證矩陣」。

專案入口：

- 正式站：`https://green-tea-king.github.io/nearby-good-eats/`
- 前台：`index.html`
- 後台：`admin.html`
- 後端：`functions/index.js`
- 核心評鑑資料：`assets/awards-taiwan.json`
- 非機密執行設定：`assets/app-settings.js`
- Firebase 設定：`firebase-config.js`、`firestore.rules`、`firebase.json`

## 零之二、不可破壞的產品契約

以下不是建議，而是目前產品的相容性契約：

1. 首次進站不得自動搜尋；登入完成後仍要等使用者按「套用」才呼叫搜尋 API。
2. 每次主結果固定顯示 3 張卡片；不足時依既定順序逐步放寬，並在系統導引明確告知。
3. 「下一組」沿用同一候選池顯示下一批不重複的 3 家，不得因此重打 Places Search。
4. 關鍵字是強條件；找不到時要放寬或告知，不得塞入不相關餐廳。
5. 行政區模式與交通模式互斥；選地區後 `travel` 必須為 `null`，選交通後清除縣市／區／里。
6. 預設交通為走路、預設營業為營業中、預設餐期依台灣時間帶入。
7. 走路目標 15 分鐘、開車目標 30 分鐘；為補足 3 家可放寬，但必須標示。
8. 評分與評論數是卡片第一層資訊；Google 評分是主體，評鑑與社群訊號只做加分。
9. 照片與完整摘要放在詳情，照片 lazy load；卡片列表不得為每家預抓大量照片。
10. 分享連結使用 `?place=<GooglePlaceId>`，可直接開啟單一餐廳卡片；分享失敗時複製連結。
11. Google、AI、外部評鑑來源必須可追溯；不可把推測、假資料或摘要文字偽裝成真實欄位。
12. 所有核心靜態 JS URL 必須綁定 `VERSION`，避免新版 HTML 載到舊快取程式。

## 零之三、模組責任與修改邊界

- `index.html`：目前仍是前台組裝層，包含主要 UI、狀態與整合流程。避免繼續堆入可獨立測試的純邏輯。
- `assets/search-logic.js`：搜尋預設值、最低三家、自動放寬、下一組、快取可重用判斷。搜尋行為優先在此寫純函式與測試。
- `assets/auth-logic.js`：登入策略與 popup／redirect 判斷；修改手機登入時必須同步跑 auth 測試。
- `assets/filter-rules.js`：濾網名稱、順序、tier 與查詢詞。新增濾網不能只加按鈕，還要定義資料來源與匹配方式。
- `assets/app-settings.js`：公開設定；只能放非機密值。Maps loader key 雖可公開，仍必須受 HTTP referrer 與 API 限制。
- `functions/index.js`：Firebase Auth、App Check、每日配額、Google Places／Routes／Geocode、Vertex AI、事件記錄。
- `functions/ai-classifier.js`：AI 請求與回應解析；前端不得自行呼叫 Vertex AI。
- `assets/awards-taiwan.json`：正式評鑑資料庫；只接受允許來源、年份與 URL 完整的資料。
- `assets/external-signals.json`：批次外部訊號；使用者搜尋時不得即時爬外站。
- `admin.html`：營運觀測，不是資料真相來源；成本為估算，實際帳務以 Google Cloud Billing 為準。
- `scripts/`：資料建構、驗證、部署與 smoke；產生器和驗證器需一起維護。

## 零之四、最低驗證矩陣

依修改範圍執行，正式部署前至少全部執行一次：

```powershell
node scripts/test-search-logic.js
node scripts/test-auth-logic.js
node scripts/test-award-search-contract.js
node scripts/test-core-awards-enrichment.js
node scripts/test-google-enrichment-key-guard.js
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
node scripts/validate-awards-data.js
node scripts/validate-external-signals.js
node scripts/validate-external-source-coverage.js

Push-Location functions
node test-key-utils.js
node test-summary-utils.js
node test-places-field-mask.js
node test-ai-classifier.js
node test-source-discovery-load.js
npm audit --omit=dev
Pop-Location

git diff --check
```

正式站部署後：

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion (Get-Content -Encoding UTF8 VERSION).Trim()
```

瀏覽器人工驗收至少包含：首次進站無搜尋、Google 登入、關鍵字輸入不跳焦點、地區搜尋 3 家、交通搜尋 3 家、下一組不重複、分享路由、詳情照片、後台統計。

## 零之五、GitHub Pages source 與 artifact

1. 開始 GitHub Pages 工作前，必須讀 `scripts/pages-files.json` 與 `.github/workflows/deploy-pages.yml`。
2. `main` 保存完整 source；正式站只發布 manifest 允許的 artifact。不得用 Git Data API 直接產生或覆寫 `main` commit。
3. 修改 Pages manifest、artifact builder、workflow 或部署包裝器時，必須執行 `node scripts/test-pages-artifact.js` 與 `node scripts/test-pages-workflow-contract.js`。
4. 正式部署前必須確認 Pages API `build_type` 為 `workflow`、遠端 `main` 的 `VERSION` 等於本機版本，並取得使用者部署確認。

## 一、核心原則

1. 禁止直接修改 `main` 分支。
2. 開始任何工作前，必須先確認目前所在的 Git branch。
3. 如果目前位於 `main`，必須立即建立新的工作 branch，再開始修改。
4. 本專案應使用 Git 管控版本與進度；若本機專案沒有 `.git`，必須先安全初始化或重新 clone，連接 GitHub 遠端，並確認不會覆蓋既有檔案。
5. 每一個獨立功能、修正或重構，都必須使用獨立 branch。
6. 不得將多個不相關的任務放在同一個 branch。

---

## 二、文件與實驗目錄

1. 系統設計、架構說明、重要技術決策與流程圖，必須集中放在 `docs/systemdesign/`。
2. 新策略、新演算法、新搜尋邏輯、新評分方式或不確定是否採用的實驗功能，必須放在 `experiment/newstrategy/`。
3. 實驗內容不得直接混入正式主流程；必須先驗證，再決定是否整合。

---

## 三、開始任何工作前

請依序完成以下檢查：

1. 確認目前資料夾是否為 Git repository。
2. 確認目前所在 branch。
3. 如果目前為 `main`，必須立即建立新的工作 branch。
4. 開始修改前，必須告知使用者目前工作的 branch 名稱。
5. 完成以上步驟後，才能開始修改任何檔案。
6. 如果本機不是 Git repository，必須先安全初始化或重新 clone，連接 GitHub 遠端，fetch 遠端分支，並確認不會覆蓋既有檔案。
7. 如果 Codex 支援自動建立 branch，則每次收到新的開發任務時，應自動判斷是否需要建立新的 branch，而不是等待使用者提醒。

---

## 四、開發過程

請遵守以下原則：

1. 只修改與本次任務相關的檔案。
2. 不要順便修改其他模組或無關程式碼。
3. 如果需要大規模重構，必須先說明原因與影響範圍。
4. 優先保持向下相容，不要破壞既有功能。
5. 不可因方便而刪除尚未確認用途的程式碼、檔案或資料；任何刪除都必須先確認用途與影響，並取得使用者同意。

---

## 五、完成工作時

請主動提供：

1. 目前 branch 名稱；若本機不是 Git repository，需回報使用的遠端 branch 或部署 commit。
2. 修改了哪些檔案。
3. 本次修改摘要。
4. Commit message；若未建立本機 commit，需回報遠端部署 commit message。
5. 是否已可以 merge。
6. 是否仍有待確認事項。

---

## 六、安全規則

除非使用者明確要求，否則禁止執行以下操作：

1. Force push。
2. Hard reset。
3. Rebase 或任何會修改 Git 歷史的操作。
4. 刪除 branch。
5. 刪除或改寫 Git history。
6. 大量覆蓋既有程式碼。
7. 未經使用者確認即自動 merge。
8. 刪除任何檔案、資料夾或資料。

---

## 七、AI 工作原則

1. 請將自己視為團隊中的一位工程師，而不是唯一開發者。
2. 任何修改都應考慮：
   - 是否影響其他 AI agent。
   - 是否影響其他 branch。
   - 是否方便日後 merge。
   - 是否容易 review。
   - 是否方便未來維護。

---

## 八、工作流程

每一次任務都必須遵守以下流程：

1. 確認 Git repository。
2. 確認目前 branch。
3. 若目前為 `main`，建立新的工作 branch。
4. 告知使用者目前工作的 branch。
5. 開始開發。
6. 完成後 commit。
7. 回報修改內容。
8. 等待使用者的 merge 指示。

若本機不是 Git repository，必須先安全初始化或重新 clone，連接 GitHub 遠端，fetch 遠端分支，再依照本流程建立 branch 與 commit；不得覆蓋既有檔案。

---

以上規範適用於本專案所有未來的開發工作。除非使用者明確要求例外，否則必須永久遵守。

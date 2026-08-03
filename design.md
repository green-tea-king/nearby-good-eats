# 在地美食榜專案說明

版本：2026.08.03.1

## 未來開工必讀文件

未來任何 Codex / AI agent / 開發者開始修改本專案前，必須先讀：

1. `AGENTS.md`：固定工作規範、安全邊界、Git 流程與回報格式。
2. `project-rules.md`：已定案的產品規則、濾網規則、API 成本原則與驗收清單。
3. `design.md`：完整產品設計、資料流程、評分、API、外部資料與部署說明。

不得只依賴聊天記憶。若任務要求與上述文件衝突，必須先指出衝突；除非使用者明確要求更新規則，否則以文件為準。

## 快速接手摘要

這是一個「靜態前端 + Firebase 安全層 + Google 真資料 + 本地批次評鑑資料」的手機 Web App。前台部署於 GitHub Pages，使用 Firebase Google Auth 登入；需付費或具濫用風險的 Places、Routes、Geocode、照片與 Vertex AI 呼叫由 Firebase Functions proxy 執行。Firestore 保存使用事件、API 事件與每日搜尋配額。

目前原始碼準備發布版本為 `2026.08.03.1`；正式站實際版本仍須以線上 `VERSION` 與部署 smoke 結果確認。正式站為：

```text
https://green-tea-king.github.io/nearby-good-eats/
```

核心設計精神：

1. 真實優先：Google 評分、評論數、營業、地址與路線是主體，不用假資料補畫面。
2. 決策優先：第一眼只呈現選店必要資訊，照片、完整標籤與摘要延後到詳情。
3. 成本優先：不進站自動搜尋、不逐項濾網搜尋、只顯示 3 家、Details／Routes／AI 限量補抓、所有可重用結果快取。
4. 可解釋：任何自動放寬、AI 判讀、獎牌加分與距離估算都要告訴使用者依據。
5. 手機優先：只維護一種 360px 到 480px 直式操作模型，避免桌機版與手機版邏輯分叉。
6. 可追溯：外部評鑑每筆都要有年份、來源 URL、擷取日期；不知道就標記待確認，不猜測。

## 系統架構

```text
使用者手機瀏覽器
  ├─ GitHub Pages
  │   ├─ index.html                  前台 UI、整合流程、卡片渲染
  │   ├─ admin.html                  管理員統計
  │   └─ assets/*.js / *.json        純邏輯、設定、評鑑與外部訊號
  ├─ Firebase Authentication         Google 登入與 ID token
  ├─ Firebase App Check              限制非本站客戶端
  ├─ Cloud Firestore
  │   ├─ usageEvents                 前台行為事件
  │   ├─ apiEvents                   後端 API 成功、錯誤與成本估算
  │   ├─ quotaUsage                  每人每日搜尋配額與去重 request key
  │   ├─ users                       使用者資料
  │   └─ admins                      管理員白名單
  └─ Firebase Functions
      ├─ api                         Auth/App Check/Quota/API proxy/AI
      └─ photo                       簽名照片代理
          ├─ Places API New
          ├─ Routes API
          ├─ Geocoding API
          └─ Vertex AI Gemini
```

信任邊界：瀏覽器送出的 UID、email、配額與成本資訊都不可信；後端必須從 Firebase ID token 取得身分，App Check 驗證客戶端，Firestore Rules 只允許使用者建立自己的 `usageEvents`。Google secret key 與 Vertex AI 身分只存在後端。

## 執行技術與框架

- 前端：原生 HTML、CSS、JavaScript，無 bundler、無 SPA framework。
- 字體與轉換：Google Fonts、OpenCC.js。
- 地圖載入：Google Maps JavaScript API；browser loader key 為公開值，但必須設定 referrer／API 限制。
- 身分與資料：Firebase Web Compat SDK 10.12.5、Authentication、Firestore、App Check。
- 後端：Firebase Functions 2nd Gen、Node.js 22、CommonJS、Firebase Admin SDK 14.2.0、firebase-functions 7.3.0。
- AI：Vertex AI `gemini-2.5-flash-lite`，使用 Functions 服務帳戶 OAuth。
- 靜態部署：GitHub Pages。
- 後端部署：Firebase CLI。
- 自動化：GitHub Actions 每週批次更新外部社群訊號；搜尋執行期不爬外站。
- 測試：Node.js assertion scripts、資料 validators、PowerShell live smoke、Chrome 實站 QA。

目前沒有前端 build step；修改 `index.html` 或 `assets/` 後可直接由靜態伺服器載入。這降低部署複雜度，但 `index.html` 已偏大，新增純邏輯時應抽到 `assets/*.js` 並以 CommonJS/Browser UMD 方式保持可測試。

## 專案目標

這是一個手機直式使用的美食排行榜 Web App。首頁直接進入「在地美食榜」，以 Google Places 真實餐廳資料為核心，依使用者目前時間、定位點、步行可到範圍、濾網條件與綜合評分排序，快速列出前 3 名餐廳。

目前定位是：

- 單一手機版型，優先服務 360px 到 480px 寬度的直式手機螢幕。
- 不使用假資料或死資料，主要資料來自 Google Places API。
- 評分是核心資訊，餐廳卡片必須明確顯示 Google 評分、評論數與綜合分數。
- API 開銷是核心設計限制；任何搜尋、濾網、詳情、路線與 AI 修改，都必須優先檢查是否會增加 Google API 調用量。
- 濾網以「Google 真資料硬過濾 + 搜尋詞強化 + 可擴充 AI 二次判斷」為設計方向。

## 主要檔案

- `index.html`：主要 App，包含 HTML、CSS、JavaScript。
- `admin.html`：Firebase 後台統計頁，登入管理員可看使用紀錄、API 估算成本與外部來源覆蓋狀態。
- `assets/app-settings.js`：公開的非機密執行設定，集中管理後端 proxy、Maps loader key 與資料檔路徑；不得放可代打 Places / Routes 的後端 secret key。
- `assets/filter-rules.js`：排行榜濾網定義與精準度層級。
- `assets/search-logic.js`：可測試的搜尋純邏輯，包括預設濾網、地區／交通互斥、空結果快取判斷、自動放寬與下一組分頁。
- `assets/auth-logic.js`：可測試的登入策略，處理一般瀏覽器、手機 popup／redirect 與嵌入式瀏覽器提示。
- `firebase-config.js`：Firebase Auth / Firestore 設定，未填寫前登入功能保持關閉。
- `firestore.rules`：Firestore 安全規則，限制使用者只能寫自己的使用紀錄、管理員可讀後台資料。
- `firebase.json`：Firebase CLI 使用的 Firestore 規則設定。
- `functions/`：Firebase Cloud Functions proxy 原始碼，負責驗證登入、代打 Google Places / Routes、AI 分類與 API 事件記錄。
- `VERSION`：正式版本號，格式為 `YYYY.MM.DD.N`。
- `assets/local-food-rank-logo.png`：排行榜頁面 Logo。
- `assets/certification-badges.json`：Google 真欄位認證徽章規則，例如高分認證、萬則口碑、可訂位、聚餐友善。
- `assets/external-signals.json`：批次更新的外部訊號入口，用於未來社群聲量、平台認證、媒體推薦；前端不得即時查外部網站，只讀這個靜態資料檔。
- `assets/external-source-coverage.json`：外部來源覆蓋狀態報告，目前只保留 Michelin、Bib、Michelin Selected、500盤、500碗、500甜六類核心評鑑來源，列出資料數、年份與匯入限制。
- `assets/platform-signals.manual.json`：愛食記、OpenRice、Tripadvisor 等平台資料的人工 / AI 整理入口。此檔只放有 URL、審核者與信心等級的可追溯資料，經 `scripts/merge-platform-signals.js` 合併進 `assets/external-signals.json`。
- `assets/platform-signals.import.csv`：平台口碑資料的表格匯入入口；欄位包含餐廳、縣市、來源、分數、信心、評論數、證據、URL 與審核者，經 `scripts/import-platform-signals-csv.js` 轉成 `platform-signals.manual.json`。
- `assets/platform-source-probe-report.json`：平台來源可用性探測報告。只記錄愛食記、OpenRice、Tripadvisor 是否適合批次整理，不匯入餐廳資料。
- `assets/social-signal-config.json`：社群熱度批次更新設定，目前以 YouTube Data API 為第一階段來源，控制每次查詢餐廳數、影片數、時間範圍與分數權重。
- `assets/taiwan-villages.json`：台灣縣市 / 區域 / 村里名稱資料，只存行政區名稱，不含邊界座標。
- `assets/awards-taiwan.json`：餐廳評鑑名單入口，只保留 Michelin、Bib、Michelin Selected、500盤、500碗、500甜六類加權資料；目前包含 Michelin 星級 53 筆、Michelin Selected 223 筆、Bib 144 筆、500盤 260 筆、500碗 887 筆、500甜 328 筆，並保留年份與來源 URL。
- `assets/500sweet-2025-manual.json`：500甜人工 / AI 整理入口。官方完整名單已可由 `https://500times.udn.com/wtimes/story/124537/8931871` 批次解析；人工檔只用於補充需人工覆核的縣市不明、連鎖或線上通路資料。
- `assets/500sweet-2025-candidates.json`：500甜 2025 官方文字名單候選檔，共 356 筆；只將單一明確縣市的 328 筆高信心資料自動匯入正式評鑑。
- `awards-taipei.json`：舊版台北評鑑資料檔，保留作為相容與資料來源備份。
- `scripts/update-external-signals.js`：外部社群訊號批次更新腳本。讀取 `assets/awards-taiwan.json` 作為候選餐廳，使用 YouTube Data API 查詢近期影片，只在影片標題或描述命中店名 / 別名時寫入 `assets/external-signals.json`。
- `scripts/build-external-source-coverage.js`：依目前評鑑、外部訊號、平台 probe 與前端評論防噪程式產生 `assets/external-source-coverage.json`。
- `scripts/validate-external-source-coverage.js`：驗證外部來源覆蓋報告與實際資料一致，避免把「只有匯入管線」誤認為「已有平台資料」。
- `scripts/merge-platform-signals.js`：合併人工或 AI 整理的平台訊號，例如愛食記、OpenRice、Tripadvisor。此腳本只讀 `assets/platform-signals.manual.json`，不即時爬外站。
- `scripts/import-platform-signals-csv.js`：把 `assets/platform-signals.import.csv` 轉換成 `assets/platform-signals.manual.json`，方便用試算表整理愛食記、OpenRice、Tripadvisor 來源。
- `scripts/probe-platform-sources.js`：探測愛食記、OpenRice、Tripadvisor 的公開頁與 robots 狀態，產生 `assets/platform-source-probe-report.json`。此腳本只做來源可用性判斷，不產生餐廳訊號。
- `scripts/build-500sweet-2025-candidates.js`：批次解析 500甜 2025 官方完整名單，產生候選檔與 import report；不由前端即時查外站。
- `scripts/merge-500sweet-2025-awards.js`：合併 `assets/500sweet-2025-candidates.json` 的高信心資料與 `assets/500sweet-2025-manual.json` 人工補充資料到 500甜 draft。
- `scripts/export-release.ps1`：版本匯出腳本。
- `RELEASES.md`：版本匯出流程備註。

## 畫面與版型

目前只保留一種主要版型：

1. 頁首
   - 左側 Logo。
   - Logo 右側小字版本號，例如 `v06.24.15`。
   - 不保留漢堡濾網按鈕，避免手機頁首變成工具列。
   - 排行榜整頁滾動，Logo、系統導引與濾網都會跟著內容捲走，不使用 sticky 頁首。

2. 濾網面板
   - 直接常駐顯示，不用漢堡按鈕展開。
   - 點擊、捲動、縮放或拖曳頁面不會自動收回濾網。
   - 所有濾網變更只更新畫面狀態，必須按「套用」才送出搜尋，避免浪費 API。
   - 地區濾網為三層：縣市 / 區域 / 里。
   - 交通濾網提供走路 / 開車，定位按鈕放在交通列，用來設定路線出發點並顯示定位提示。

3. 餐廳卡片
   - 顯示排行、店名、Google 評分、評論數、營業狀態、地區、路線時間、綜合分數。
   - 主卡最多顯示 4 個強徽章；外部評鑑優先，同一來源多年份時主卡只顯示最新 / 最高等級徽章，其次高分認證、口碑、可訂位、聚餐友善等。
   - 完整認證、服務標籤、Google 照片、Google 摘要、評論摘要與 AI 判讀放在詳情。
   - 沒有照片或摘要資料時不顯示 placeholder，避免讓使用者誤會功能壞掉。
   - 動作按鈕：導航、分享、詳情。
   - 分享按鈕固定複製獨立卡片連結，避免不同系統分享面板沒有可用目標時跳出錯誤。

## 濾網設計

目前排行榜濾網順序：

1. 地區：縣市 / 區域 / 里
2. 關鍵字：自由輸入想吃的品項，例如麵線、滷肉飯
3. 交通：走路 / 開車 / 定位交通起點
4. 營業：不限 / 營業中
5. 時段：早餐 / 早茶 / 午餐 / 午茶 / 晚餐 / 消夜
6. 吃法：單點 / 吃到飽
7. 飲食：葷食 / 素食
8. 評鑑：米其林三星 / 米其林二星 / 米其林一星 / 米其林星級 / 米其林入選 / 必比登 / 綠星 / 500盤 / 500碗 / 500甜

### 預設值

- `營業` 預設為 `營業中`。
- 首次進入排行榜會先要求使用者定位，定位成功後預設套用 `交通 = 走路`。
- 預設排行榜使用定位點附近 `800m` 內的 Google Places 真實餐廳；若篩選後沒有結果，會放寬到 `2000m`。
- `時段` 會依使用者當下時間自動帶入。
- `地區` 不再預設套用定位；只有使用者手動選縣市 / 區域 / 里時才作為行政區濾網。
- `地區` 與 `交通` 是互斥濾網：選地區會清掉交通與定位提示，選走路、開車或交通定位會清掉縣市 / 區域 / 里。
- `交通` 定位成功後會在交通列提示「定位：縣市區里」，此位置作為步行 / 開車估算與導航起點。
- `交通` 模式採同心圓擴張搜尋：走路依序查 800m / 1200m / 1600m / 2000m / 3000m / 5000m，開車依序查 3000m / 5000m / 8000m / 12000m / 20000m / 30000m；每一圈都會補 Google 路線時間，優先湊滿 3 張符合走路 15 分鐘內或開車 30 分鐘內的卡片。若最大圈仍不足 3 張，才用同圈內最接近的路線候選補足，但不放寬關鍵字、營業、吃法、飲食等強條件。
- 排行榜濾網永遠顯示在頁面上方區塊：版面順序在系統導引與餐廳卡片之前，不使用收合、漢堡選單或外圍點擊/滾動自動隱藏；使用者往下捲動時濾網可以自然被捲上去。
- `評鑑` 支援多選，採 OR 條件：例如同時選米其林一星與必比登，會顯示符合任一評鑑的餐廳；多選只讀本地批次評鑑資料，不增加 Google API 調用。

### 濾網精準度

濾網分成三類：

- 硬濾網：Google 欄位能直接支援者，例如營業中、地區、步行 / 開車路線時間。
- 搜尋詞強化：把關鍵字與近似濾網直接丟進 Google Places Text Search，例如麵線、吃到飽、素食。
- 時段濾網：先看 Google `servesBreakfast` / `servesLunch` / `servesDinner` / `servesBrunch` / `servesDessert` / `servesCoffee` 等供餐欄位，再用店名、類型與 Google 摘要近似判斷。
- 飲食濾網：`素食` 依 Google `servesVegetarianFood` 與素食 / 蔬食 / vegan / 純素等文字證據；`葷食` 會排除明確全素 / 純素店，但不排除一般同時供應素食選項的餐廳。
- 關鍵字是強條件：Google 回傳候選後，仍必須在店名、類型、Google 摘要或評論摘要實際命中關鍵字才顯示；不符合時寧可 0 筆，不顯示不相干店家。
- 關鍵字支援多詞，例如 `滷肉飯 排骨湯`。多詞採 AND 條件，每個詞都必須命中；卡片會標示命中來源，例如店名、類型、評論摘要、Google 摘要。
- 關鍵字無結果時只提供「放寬關鍵字」或取消條件，不改用不相干推薦。
- `吃到飽` 是高風險近似濾網，不能只因為搜尋詞命中就通過；結果必須在店名、類型、地址、Google 摘要或評論摘要出現吃到飽、自助餐、buffet、放題、無限供應或已知吃到飽品牌等明確證據，且會排除「不是吃到飽、單點制」等反向描述。
- `評鑑` 是本地批次資料硬濾網，來源為 `assets/awards-taiwan.json` 已整理的 Michelin、Bib、Michelin Selected、500盤、500碗與 500甜資料；使用者選評鑑時，前台必須先查本地評鑑名單，依評鑑、縣市與行政區縮小候選後，才少量補 Google Text Search 取得 place id、評分與評論數。預設補查上限為 8 筆評鑑店名，避免把本地清單全量外查。Michelin 可選三星 / 二星 / 一星，也可選全部米其林星級。
- 行政區與里會先 geocode 成座標，作為 Google Places Text Search 的 location bias；搜尋仍保留文字條件，但不只靠地址文字比對。
- 排行榜會做分店 / 連鎖店分群，先依綜合分數排序，同品牌多分店只保留最高分卡片，卡片上提示合併的同品牌數量。
- 近似 / AI 濾網：Google 沒有直接欄位時，先以店名、類型、摘要、Google flags 判斷，後續可接後端 AI proxy 強化。

## 資料來源與 API

### Google 登入與後台統計

採用 B 模式：

- 網站必須登入 Google 帳戶才能使用。
- 任何 Google 帳戶都可以登入使用。
- 只有 `firebase-config.js` 的 `adminEmails`，且 Firestore `admins/<email>` 文件存在的帳號，可以讀取後台統計。
- 前台會把使用紀錄寫入 Firestore `usageEvents`：
  - `login`
  - `leaderboard_open`
  - `leaderboard_result`
  - `search_result`
  - `route_result`
  - `refresh`
  - `filter_change`
  - `filter_clear`
  - `locate_origin`
  - `navigation_open`
  - `share_copy`
  - `detail_toggle`
- `admin.html` 可切換今日、7 天、30 天，顯示事件數、使用者、工作階段、查詢 / 排行榜、濾網操作、分享 / 導航，並提供事件分布、活躍使用者、熱門濾網、熱門餐廳行為、查詢結果紀錄、最新紀錄與 CSV 匯出。
- 登入 UX 會顯示登入中與錯誤訊息；popup 等待超過 20 秒會恢復登入按鈕並提示重試或改用 Safari／Chrome，一般流程不自動改用 redirect。Firebase 未允許網域或未啟用 Google provider 時會在登入卡片提示。
- 若 Firebase Web API key 的 HTTP referrer 限制未允許 GitHub Pages，登入卡片會提示需加入 `https://green-tea-king.github.io/*` 與 `https://green-tea-king.github.io/nearby-good-eats/*`。
- 定位只用於附近餐廳與步行 / 開車估算；後台事件只記錄定位文字標籤與操作，不寫入精確經緯度。

目前 `firebase-config.js` 已設定 `requireSignIn:true`。若 Firebase web config 尚未填入，網站會停在登入設定提示，避免未登入使用。啟用步驟：

1. 在 Firebase Console 建立 Web App。
2. 啟用 Authentication 的 Google provider。
3. 啟用 Firestore。
4. 將 Firebase web config 填入 `firebase-config.js`。
5. 確認 `requireSignIn` 維持 `true`。
6. 在 Firestore 建立 `admins/<管理員 Gmail>` 文件。
7. 部署 `firestore.rules`。

### Google APIs

目前 App 依賴 Google Maps Platform：

- Maps JavaScript API（只負責瀏覽器地圖載入）
- Places API New
- Geocoding API
- Routes API
- Routes API；若瀏覽器路線服務逾時，僅使用標示為「約」的保守距離估算，不呼叫已棄用的 Distance Matrix API。

正式站已使用 Firebase Cloud Functions proxy。`functions/` 的 `api` 與 `photo` 會驗證 Firebase ID token 與 `X-Firebase-AppCheck` token，使用 `GOOGLE_MAPS_API_KEY` Secret 代打 Google API，並寫入 `apiEvents`。`assets/app-settings.js` 中的 Maps browser key只用於載入互動地圖，必須在 Google Cloud 設定 HTTP referrer 與 API 限制，不得拿它繞過 proxy 呼叫 Places Web Service。

搜尋類 API (`textSearch`、`nearbySearch`) 套用每日使用者配額：一般使用者每天 30 次搜尋，管理員不限。一次排行榜整理即使內部查多個縣市，也會用同一個 quota key 合併計算成一次使用者搜尋。

`assets/app-settings.js` 的本機額度只用來提早提示；真正不可繞過的每日 30 次限制在 Functions / Firestore transaction。管理員不限。Functions 以 App Check 開啟、`DISABLE_SEARCH_QUOTA=false` 為安全預設；同一 quota key 的內部同心圓或放寬查詢只計一次使用者搜尋。

`apiEvents` 會記錄 action、成功/失敗、延遲、估算單位、粗估成本、App Check 狀態、配額剩餘與配額封鎖。`admin.html` 會顯示 API 次數、錯誤率、成本估算、API 使用者排行與錯誤/配額排行。成本估算只供控管趨勢，正式帳務仍以 Google Cloud Billing 為準。

### 餐廳資料流程

1. 前端登入 Firebase Auth 並呼叫 Firebase Functions proxy。
2. 後端依地區與濾網組合呼叫 Google Places / Routes。
3. 取得餐廳基本資料：名稱、座標、評分、評論數、營業狀態、地址、類型、照片、服務欄位。
4. 用評鑑資料比對餐廳。
5. 計算綜合分數。
6. 取前 3 名。
7. 對前 3 名補抓較完整欄位：照片、摘要、營業時間、服務資訊。
8. 用 Routes API 只補目前選用的交通模式；切換模式或打開細節時才補其他資料。
9. 渲染餐廳卡片。

### API 開銷控制

- 首頁若成功取得使用者定位，直接以定位點附近與交通同心圓搜尋，不先建立全台候選池。
- 全台候選池只在使用者真的使用全台模式或定位失敗時建立。
- Google Text Search / Nearby Search 結果以查詢條件與粗略座標做 6 小時持久快取。
- Place Details 以 `place_id` 做 7 天快取，避免同一店家重複補抓照片、營業、摘要與服務欄位。
- Geocoding 行政區座標做 30 天快取。
- Routes Matrix 以粗略起點、交通模式與目標店家做 30 分鐘快取。
- 同一組條件正在請求時會共用同一個 promise，避免連點或快速切換濾網造成並發重複調用。
- 路線估算只查目前模式：走路只查步行，開車只查開車。
- 同心圓每圈最多只對前 8 個候選補路線，再靠下一圈補滿 3 張卡片。

### 村里資料

`assets/taiwan-villages.json` 由 `jason2506/Taiwan.TopoJSON` 的 counties / towns / villages TopoJSON 整理而來，只保留行政區名稱：

- 22 縣市
- 368 鄉鎮市區
- 7851 村里

此資料用於第三層地區濾網，並輔助 Google 查詢詞與地址過濾。

## 綜合評分

排行榜不是單純用 Google 星等排序，而是使用綜合分數：

```text
貝氏分數 = (C * m + n * r) / (C + n)
綜合分數 = 貝氏分數 + 評論量加分 + 評鑑加分 + 社群熱度小加分 - 評論可信度保守扣分
```

其中：

- `r`：Google rating。
- `n`：Google userRatingCount。
- `m`：當批結果平均評分。
- `C`：可信度門檻，目前設定為 150。
- 評論量加分用 `log10(n+1) * 0.06` 計算，上限 `0.32`，讓同星等時評論數多者明顯更前，但避免評論數超大的店過度壓過品質。
- 評論可信度保守扣分先處理「高星等但樣本數偏少」的情況，例如 4.9 星但未滿 200 則評論會小幅扣分；另外只在已取得的 Google 摘要出現「五星 / 好評 / 評論」搭配「送 / 換 / 贈 / 折扣 / 招待 / 打卡」等明確活動評價用語時，才顯示警訊並小幅調整。這不是判定洗評，而是避免少量五星或活動換評過度影響排行。詳情內會顯示評論樣本與警訊說明。
- Google 評分 / 評論數仍是主體；Michelin、Bib、Michelin Selected、500盤、500碗、500甜等外部資料只做額外加分。
- 外部評鑑權重原則：米其林星級高權重；必比登與 500 系列中高權重；50 Best 高權重但只影響少數真實入榜店。外部評鑑總加分有上限，避免壓過 Google 真實評分與評論量。
- 社群聲量、平台認證、媒體推薦等外部資料不做使用者查詢時的即時抓取；先批次整理進 `assets/external-signals.json`，再由前端讀取，降低 API 成本並避免來源不穩。
- 社群聲量採 API 優先、批次更新。第一階段來源為 YouTube Data API：每次預設只查 10 家候選餐廳、每家最多 8 支影片，影片必須命中店名或別名才可寫入。分數依影片數、90 天內影片數與觀看數對數加權產生，僅作輔助訊號。
- `youtubeBuzz` 已接入前端排序與詳情：排序最多只加 `0.12`，社群訊號總加分上限 `0.14`；卡片第一眼只顯示小徽章，展開詳情才顯示影片數、觀看數與來源連結。
- 愛食記、OpenRice、Tripadvisor 先採手動 / AI 整理檔匯入：資料必須有來源 URL、信心等級、更新日期與審核者，合併後以 `platformRating` 或 `platformCertification` 做小幅輔助加分；沒有資料就不顯示徽章，不用猜測。2026-07-01 已建立第一批種子資料：2 家餐廳、6 筆平台訊號，三個平台各 2 筆。
- 2026-07-01 平台來源探測結果：愛食記頁面可讀但 robots 有廣泛限制；OpenRice 與 Tripadvisor 也不符合安全自動解析條件。因此三者都維持手動整理或授權 API，不做自動抓取匯入。
- 卡片認證章分兩類：
  - 外部評鑑獎牌：來自 `assets/awards-taiwan.json`，目前支援 Michelin、Bib、Michelin Selected、500盤、500碗、500甜；資料帶縣市、年份與來源欄位，前端會合併同店多年份主徽章並避免跨縣市誤標。
  - Google 真欄位認證：由 Google rating / userRatingCount / Places 服務欄位產生，例如高分認證、千則口碑、可訂位、聚餐友善、素食友善、戶外座位、寵物友善、無障礙資訊。

### 社群熱度批次更新

社群熱度不在使用者搜尋時即時查 API，而是由批次工作更新靜態資料檔：

```text
assets/awards-taiwan.json 候選餐廳
  -> scripts/update-external-signals.js
  -> YouTube Data API
  -> assets/external-signals.json
  -> 前端讀取訊號與徽章
```

執行方式：

```powershell
$env:YOUTUBE_API_KEY="你的 YouTube Data API key"
node scripts/update-external-signals.js
```

GitHub Actions 工作流 `.github/workflows/update-external-signals.yml` 可手動或每週執行。需要在 GitHub repository secrets 設定 `YOUTUBE_API_KEY`。沒有 key 時腳本只更新執行狀態，不會寫入假資料。

成本控管：

- 預設每次只查 10 家餐廳，避免 YouTube `search.list` 配額快速消耗。
- 批次工作會記錄 `automation.nextAwardOffset`，下次從下一批餐廳繼續跑。
- 只接受影片標題或描述命中店名 / 別名的結果；沒有命中就不產生社群訊號。
- `youtubeBuzz` 只做輔助加分與提示，前端加分上限很小，不可超過 Google 評分、評論數與外部評鑑主體。

這個設計是為了處理「同樣 4 顆星，但評論數多者可信度應較高」的問題。

## 餐廳卡片資訊分層

手機主卡只保留第一眼決策資訊：

- 店名。
- Google 評分與評論數。
- 價位、營業狀態、所在地、步行或開車時間與距離、綜合分數；價位/營業與路線資訊分成兩行顯示，避免擠成一串。
- 最多 4 個強徽章：外部評鑑優先，其次高分認證、萬則/千則口碑、可訂位、聚餐友善等。
- 放寬距離與同品牌提示統一放在小提示列。
- 導航、分享、詳情三個操作。

詳情展開才顯示證據與補充資訊：

- 店家照片；展開詳情後才設定圖片 `src`，避免列表初始載入照片。
- 若該 `place_id` 的詳情沒有回傳 photos，展開詳情時才用店名 + 地址做一次精準 Text Search 補查照片。
- 完整外部評鑑與 Google 真欄位認證。
- 關鍵字命中、AI/近似判斷來源。
- Google 摘要、評論摘要、AI 判讀。
- 完整服務標籤、營業時間、地址、電話、官方網站與 Google 地圖連結。

詳情資料以淡色區塊分段，讓補充資訊可掃描但不干擾主卡決策。這個分層是為了讓列表掃描更快，也避免照片或長摘要造成手機版面跳動；API 成本上則優先只補前 3 張卡片詳細資料，照片等媒體資源等使用者展開詳情後才載入。

## 分享卡片與路由

每張餐廳卡片都有分享功能。

分享連結格式：

```text
https://green-tea-king.github.io/nearby-good-eats/?place=<GooglePlaceId>
```

使用 `?place=` 的原因：

- GitHub Pages 是靜態站，不需要伺服器 rewrite。
- 直接打開網址時，前端能讀取 query string。
- 可用 Google Place ID 重新抓取單一餐廳真實資料。
- 完整欄位依 `place_id` 快取在 `rankRich`，同一店家不重複抓 detail；每次 detail prefetch 最多 3 筆。

分享頁會顯示單張餐廳卡片，並提供「看完整排行榜」回到主排行榜。
頁面提供基本 OG / Twitter metadata；分享卡片載入成功後，前端會用該店名稱、評分、地址與照片更新 metadata。若社群平台需要伺服器端預覽圖，後續可把 `?place=` 交給 Functions 產生動態分享頁。
分享按鈕固定 copy link。Clipboard API 失敗時改用隱藏 textarea fallback，不呼叫系統分享面板，也不跳系統錯誤。

## 圖片與手機互動

- 餐廳照片只放在詳情內，使用 `loading="lazy"` 與 `decoding="async"`。
- 照片 URL 先放在 `data-lazy-src`；使用者展開詳情時才寫入 `src`，避免列表初始載入照片。
- Google Places 並不是每個店家都會回傳 photos；缺照片時只在詳情展開後補查，仍沒有就不顯示假圖。
- 錯圖標記 `is-broken` 並隱藏，不佔用卡片版面。
- 詳情照片列使用穩定 grid：三張圖 118px，單張圖 172px。
- 詳情照片可點擊放大；放大層可用背景、關閉按鈕或 Esc 關閉。
- 手機關鍵字與地點輸入框使用 16px 字級，避免 iOS 聚焦時自動放大造成版面跳動。
- 說明、地區彈窗、地圖選點與地圖頁會建立暫態 history；手機返回鍵優先關閉最上層 UI，沒有開啟 UI 時才處理分享路由或瀏覽器返回。
- 排行榜濾網不是彈窗，不會因外圍點擊、滾動、縮放或拖曳頁面而收回。

## 交通模式

交通濾網目前有：

- 走路
- 開車
- 定位交通起點

作用：

- 控制餐廳卡片優先顯示步行或開車時間。
- 控制導航按鈕打開 Google Maps 時使用 `walking` 或 `driving`。
- 交通定位只設定使用者目前位置作為路線出發點，不當成行政區篩選。
- 走路 / 開車模式會用定位點做同心圓候選搜尋，先以 Google 路線時間過濾，再依綜合分數與路線結果顯示前 3 張。
- 詳情仍保留步行與開車兩種估算。
- 與地區濾網互斥，避免同時用行政區範圍與交通模式造成篩選語意衝突。

## AI 設計方向

正式站已透過受 Firebase Auth 與 App Check 保護的 Functions proxy 呼叫 Vertex AI：

```js
AI_FILTER: {
  MODE: "proxy",
  ENDPOINT: "",
  MAX_ITEMS: 8,
}
```

AI 模型使用 `gemini-2.5-flash-lite`，以 Cloud Functions 服務帳戶取得 Vertex AI 權限；前端沒有 AI API key。每次最多批次判讀 8 家，且只在使用者套用需要近似判斷的濾網時呼叫：

```text
Google Places 真資料 -> 後端 AI 分類 -> 回傳 tags + confidence + reason + sources -> 前端套用濾網與顯示判讀依據
```

前端呼叫 AI proxy 時會帶 Firebase ID token，後端必須先驗證登入者：

```http
Authorization: Bearer <Firebase ID token>
```

後端回傳格式：

```json
{
  "items": [
    {
      "id": "google-place-id",
      "tags": { "occasion": ["聚餐"], "service": ["吃到飽"] },
      "confidence": { "occasion": 0.82, "service": 0.76 },
      "reason": "AI 分類：聚餐 82%、吃到飽 76%。依據：Google flags、評論摘要。",
      "sources": {
        "occasion": [
          { "field": "googleFlags.goodGroups", "label": "Google flags", "evidence": "適合團體" },
          { "field": "reviewSummary", "label": "評論摘要", "evidence": "適合多人聚餐" }
        ],
        "service": [
          { "field": "name", "label": "店名", "evidence": "吃到飽" }
        ]
      }
    }
  ]
}
```

前端不放 AI API key，也不再把 Google 摘要偽裝成 AI 解讀。卡片只有在後端 `aiClassify` 回傳 `reason` 時才顯示 `AI 判讀`，並附來源摘要，例如 `Google flags`、`店名`、`評論摘要`、`Google 摘要`。

可由 AI 判斷的欄位：

- 是否適合聚餐
- 是否適合獨享
- 是否吃到飽
- 菜系
- 氣氛
- 推薦原因
- 信心分數

## Functions API 契約

前端以 `POST assets/app-settings.js::apiBaseUrl` 呼叫單一 `api` endpoint，request body 形式為：

```json
{
  "action": "textSearch",
  "payload": {}
}
```

必要 headers：

```http
Authorization: Bearer <Firebase ID token>
X-Firebase-AppCheck: <App Check token>
Content-Type: application/json
```

支援 action：

| action | 用途 | 主要輸入 | 主要輸出 |
|---|---|---|---|
| `textSearch` | 關鍵字／行政區搜尋 | `textQuery`, `maxResultCount`, `locationBias` | `items[]` |
| `nearbySearch` | 定位同心圓搜尋 | `center`, `radius`, `includedPrimaryTypes` | `items[]` |
| `placeDetails` | 前幾名完整欄位 | `placeId` | `item` |
| `routeMatrix` | 步行或開車時間 | `origin`, `targets[]`, `travelMode` | `items[]` |
| `geocode` | 行政區中心點 | `address` | `item` |
| `aiClassify` | 最多 8 家二次分類 | `filters[]`, `items[]` | `items[]` 的 tags/confidence/reason/sources |

後端硬限制：Text/Nearby 每次最多 20 家、Nearby radius 最多 5,000m、Routes targets 最多 20 家、AI 最多 8 家。新增 action 時必須同時更新：允許 action、request validation、成本估算、事件記錄、前端呼叫、測試與本文件。

正常 response 會附帶結果及配額資訊；失敗使用 HTTP 4xx/5xx。前端不得把 API 失敗轉成「0 家」假裝成功，必須交由系統導引顯示可理解錯誤。

## 前端狀態與搜尋流程

重要狀態：

- `rankFilter`：已套用條件。
- `rankFilterDraft`：使用者尚未按套用的草稿；點 chip 只改草稿，不搜尋。
- `rankSearchCommitted`：是否已進行第一次明確搜尋；false 時維持空白待搜尋狀態。
- `rankResultCandidates`：目前條件完整候選池，用於「下一組」。
- `rankShownPlaceIds`：已顯示 place ID，避免重複。
- `rankAreaPools` / `rankKeywordPools` / `rankNearbyPools`：記憶體候選池。
- `rankRich`：依 place ID 保存補抓 Details 的完整資料。
- `rankOriginLabel` / `rankOriginScope`：定位顯示與行政區 fallback，不保存到後台精確座標。

搜尋狀態機：

```text
登入完成
  -> 顯示濾網與待搜尋導引（不呼叫 API）
  -> 使用者修改 rankFilterDraft（不呼叫 API）
  -> 按套用，commit 到 rankFilter
  -> 選資料來源：交通 Nearby / 地區 Text / 關鍵字 Text / 全台候選
  -> Google 真欄位與本地標籤篩選
  -> 必要時 AI 二次分類
  -> 不足 3 家：自動時段 -> 里 -> 區 -> 縣市 -> 營業/供餐/評鑑等逐步放寬
  -> 排序並僅補抓前幾名 Details / Routes
  -> 顯示 3 張卡片，保留候選池供下一組
```

空陣列不得寫入或沿用搜尋快取，否則 API 恢復後瀏覽器仍會永久看到 0 家。核心 JS script URL 必須帶目前 `VERSION`，避免 HTML 與快取 JS 版本錯配；`scripts/test-static-asset-versions.js` 固定檢查此契約。

## 資料模型

### Google 候選餐廳

前後端統一使用簡化欄位：`id`、`name`、`loc`、`rating`、`count`、`address`、`openNow`、`priceLevel`、`pt`/`ptd`、`photos`、服務 flags、摘要與 `awards`。`id` 即 Google place ID，是快取、去重、分享與 Details 的主鍵。

### 評鑑資料 `assets/awards-taiwan.json`

```json
{
  "name": "餐廳名稱",
  "city": "臺北市",
  "district": "信義區",
  "address": "完整地址",
  "cuisine": "菜系",
  "aliases": [],
  "awards": [
    {
      "guide": "michelin",
      "awardName": "米其林一星",
      "year": 2025,
      "level": "一星",
      "sourceUrl": "https://...",
      "extractedDate": "2026-06-30",
      "notes": ""
    }
  ]
}
```

正式允許的 guide 只有 `michelin`、`michelin_selected`、`bib`、`500plate`、`500bowl`、`500sweet`。年份不能推測；來源沒有年份時用「年份待確認」。名稱比對需考慮別名、縣市、地址與分店，不能只靠模糊店名自動掛獎。

### 外部訊號 `assets/external-signals.json`

外部資料只做低權重加分和標籤。每筆 signal 必須帶 `sourceId`、可追溯 URL、擷取時間、信心或證據。資料由批次腳本／人工審核產生；前端搜尋期間不得即時抓愛食記、OpenRice、Tripadvisor、YouTube 或其他網站。

## 設定、Secret 與權限

- `firebase-config.js`：Firebase Web config、`requireSignIn`、管理員 email。Web config 可公開，但仍應設定授權網域與適當限制。
- `assets/app-settings.js`：API base URL、公開 Maps loader key、App Check site key、每日提示額度、資料檔 URL；不得放 server secret。
- Secret Manager：`GOOGLE_MAPS_API_KEY`，供 Places、Routes、Geocode 與照片 proxy 使用。
- Functions env：`REQUIRE_APP_CHECK` 預設 true、`DISABLE_SEARCH_QUOTA` 預設 false、`DAILY_SEARCH_LIMIT` 預設 30、`VERTEX_AI_MODEL` 預設 `gemini-2.5-flash-lite`。
- CORS：正式只允許 `https://green-tea-king.github.io`，本機允許 `127.0.0.1:4177` 與 `localhost:4177`。
- 管理員：Firestore `admins/<lowercase-email>` 或後端保留管理員 email；規則與前後台名單需同步。

任何文件、commit、日誌或備份說明都不得寫入 secret 值。若 key 洩漏，先在 Google Cloud 輪替，再部署 Functions secret，最後驗證正式站。

## 部署

目前使用 GitHub Pages：

```text
https://green-tea-king.github.io/nearby-good-eats/
```

### GitHub source 與 Pages artifact

- `main` 是完整原始碼的唯一 Git source of truth；不得再用 Git Data API 把公開檔案直接覆寫到 `main`。
- `scripts/pages-files.json` 是正式站唯一公開檔案清單；新增公開檔案時必須同步更新 manifest 與測試。
- `scripts/build-pages-artifact.js` 只能建置到 repository 外的空目錄，並逐檔驗證 SHA-256。
- `.github/workflows/deploy-pages.yml` 對 pull request 只建置；只有 `main` push、`main` 手動 dispatch 或外部訊號 workflow 成功才可部署。Pages actions 使用 `configure-pages@v6`、`upload-pages-artifact@v5`、`deploy-pages@v5`，皆為 Node.js 24 runtime major。
- `scripts/deploy-github-contents.ps1` 只觸發與監看 Actions，不得建立 Git blob、tree、commit 或更新 ref。
- Pages 沿用原 repository 與 `https://green-tea-king.github.io/nearby-good-eats/`。

部署流程：

1. 先讀 `AGENTS.md`、`project-rules.md`、本文件，執行 `git status --short --branch`；不得直接在 `main` 修改。
2. 完成修改後執行 `AGENTS.md` 的最低驗證矩陣與手機瀏覽器 QA。
3. 更新 `VERSION`，並同步所有核心 JS 的版本 query；`scripts/test-static-asset-versions.js` 必須通過。
4. 取得使用者明確同意後，依核准的 Git 流程把已驗證來源整合到遠端 `main`；不得直接在 `main` 修改或繞過 review 覆寫來源。
5. 確認 Pages API `build_type=workflow`，再使用 `scripts/deploy-github-contents.ps1` 觸發並監看既有 `deploy-pages.yml`；不得建立新的 Pages 專案。
6. 若有 Functions 修改，執行 `$env:CI='1'; npx firebase-tools deploy --project nearby-good-eats --only functions:api`。
7. 若有 Firestore Rules 修改，執行 `$env:CI='1'; npx firebase-tools deploy --project nearby-good-eats --only firestore:rules`。
8. 等 GitHub Pages workflow 完成，再執行 `scripts/smoke-live-site.ps1 -ExpectedVersion <VERSION>`。
9. 用 Chrome 實測登入、套用搜尋、3 張卡片、下一組、分享、詳情照片與後台。

`deploy-github-contents.ps1` 不會建立或推送 commit。執行前必須先確認遠端 `main` 已包含要發布的來源，而且遠端 `VERSION` 等於本機版本；腳本也會核對固定 repository、default branch、Pages URL 與 `build_type`，其中任一不符就停止。WebDAV／RaiDrive 環境下，部署腳本的 GitHub CLI 子程序會切到本機暫存目錄執行，避免把 WebDAV 目錄當作 child-process cwd；Pages artifact 建置則用明確 `--git-dir`／`--work-tree` 讀 Git 追蹤清單，並對常見 WebDAV 暫時性讀取錯誤做有上限的重試。

GitHub 的 read-only 查詢若遇到 HTTP 502、503、504 或整份 HTML 閘道錯誤，可以依腳本設定有限重試；401、403、404、409、422 與本機錯誤不重試。`workflow_dispatch` 是會造成部署的 mutation，只送出一次，不得因傳輸錯誤自動重送；後續以回傳 run URL 或遠端 commit SHA 找到並監看該次 workflow。

### 回滾

- 靜態站：找出最後一個已驗證版本，把該版本內容重新部署成新的回滾 commit；禁止用 force push、hard reset 或刪除歷史。
- Functions：從最後一個已驗證原始碼版本重新部署 `functions:api`，並確認 Secret 與 env 未被舊值覆蓋。
- Firestore Rules：只回滾規則檔，不刪除既有集合或使用紀錄。
- 回滾後仍要跑正式站 smoke、登入、搜尋與錯誤導引，並記錄回滾原因與版本。

## 外部獎牌資料建構

外部獎牌資料採批次建構，不在前端即時查外部網站。正式前端讀取：

```text
assets/awards-taiwan.json
```

目前正式獎牌來源包含：

- Michelin 2025 星級：53 筆，含三星 3、二星 7、一星 43。
- Michelin 2025 入選餐廳：222 筆，使用低權重弱徽章，低於星級、必比登與 500 系列。
- Michelin 2025 必比登：144 筆。
- Michelin 2025 綠星：7 筆，只顯示徽章，不參與美味加權。
- 500盤：260 筆。
- 500碗：887 筆，包含 2025 第三屆官方頁文字名單高信心 415 筆，以及 2026 第四屆官方頁連結之官方 Google 地圖 KML 472 筆。
- 500甜：328 筆，來自 2025 第一屆 500甜官方頁文字名單的單一縣市高信心解析；5 筆新竹 / 嘉義縣市需人工判斷、23 筆連鎖與線上通路保留在 merge report 待人工覆核。

目前只納入的外部評鑑來源：

- Google Maps reviews：已是主資料來源，使用 Places 評分、評論數、摘要與服務欄位；不得另存大量評論全文。評論雜訊防護只使用既有 rating / userRatingCount / Google 摘要，不為了抓洗評而增加即時 API 調用。
- Michelin Guide Taiwan：正式獎牌來源，星級與必比登可加權；入選餐廳只做弱加分與弱徽章。
- 500盤、500碗、500甜：正式獎牌來源，批次整理後進 `assets/awards-taiwan.json`，只做中高權重加分。
- 其他來源暫不納入 `assets/awards-taiwan.json`，避免評鑑範圍擴散；若日後恢復，必須另建資料規格與人工覆核規則。
- `assets/external-source-coverage.json` 是目前覆蓋狀態的權威摘要：只列核心六類評鑑，不把平台聲量或候選清單混成正式評鑑。
- 後台會讀取 `assets/external-source-coverage.json` 顯示「外部來源覆蓋」，讓管理員一眼分辨已整合來源、執行時來源與只有批次管線但尚無資料的平台來源。
- 平台資料目前以 `assets/platform-signals.manual.json` 作為審核入口，執行 `node scripts/merge-platform-signals.js` 後才會進 `assets/external-signals.json`。這個流程是為了避免前端即時查外站、節省成本，也避免來源結構改版導致正式站壞掉。
- 若資料來源先由人工、AI 或試算表整理，優先填 `assets/platform-signals.import.csv`，再執行 `node scripts/import-platform-signals-csv.js` 轉成審核 JSON。CSV 沒有資料時保持空表，不產生假訊號。

平台 CSV 欄位：

```csv
name,city,area,aliases,type,sourceId,label,score,confidence,rating,reviewCount,rank,evidence,url,updated,reviewedBy
```

平台 CSV 匯入流程：

```text
node scripts/import-platform-signals-csv.js
node scripts/merge-platform-signals.js
node scripts/validate-external-signals.js
```

`aliases` 與 `evidence` 可用 `|` 或 `;` 分隔多值。`sourceId` 只接受 `ifoodie`、`openrice-tw`、`tripadvisor-tw`；每列都必須有 `url`、`updated`、`reviewedBy`，避免沒有來源證據的口碑資料進入排序。

目前平台種子資料規則：

- `ifoodie` 可使用平台評分與評論數，但仍只作輔助加分。
- `openrice-tw` 目前以餐廳資料頁、食記、相片、菜單等存在性作 `platformCertification`，未直接寫入無法確認的評分。
- `tripadvisor-tw` 樣本數低時使用 `low` 或 `medium` 信心；低信心只作小幅輔助，不顯示成強認證。
- 三個平台資料都必須通過 `scripts/import-platform-signals-csv.js`、`scripts/merge-platform-signals.js`、`scripts/validate-external-signals.js` 與 `scripts/validate-external-source-coverage.js`。

平台型來源若要寫入 `assets/external-signals.json`，信號格式固定如下：

```json
{
  "type": "platformRating",
  "sourceId": "ifoodie",
  "sourceLabel": "愛食記",
  "label": "愛食記口碑",
  "score": 80,
  "confidence": "medium",
  "metrics": {
    "rating": 4.3,
    "reviewCount": 120
  },
  "url": "https://...",
  "updated": "2026-07-01",
  "reviewedBy": "manual-batch"
}
```

驗證規則：

- `sourceId` 必須存在於 `sourceCatalog`。
- `type` 只能用 `platformRating`、`platformCertification`、`mediaMention`、`socialBuzz`、`youtubeBuzz` 等已定義類型。
- `score` 必須是 0 到 100。
- `confidence` 必須是 `high` / `medium` / `low`。
- 平台口碑必須保留 `url`。
- 使用者搜尋時不得即時查愛食記、OpenRice、Tripadvisor；只能讀批次整理後的靜態檔。

重建流程：

```text
node scripts/build-michelin-taiwan-2025-official.js
node scripts/review-michelin-taiwan-2025-official-import.js
node scripts/validate-awards-data.js
```

第一支腳本抓取 Michelin Guide Taiwan 2025 官方完整名單並保存快照，解析星級、綠星、入選餐廳；必比登沿用已整理的 144 筆正式資料，並以官方必比登文章確認總數。第二支腳本產生合併報告與草稿，只自動合併高信心命中；純 `michelin_selected` 入選餐廳保留在報告中，不進正式加分來源，避免卡片徽章過多。第三支腳本固定檢查正式資料筆數、獎項統計、guide 白名單、重複同店 key，以及正式檔與 draft 是否一致。

500碗 2025 建構流程：

```text
node scripts/build-500bowl-2025-candidates.js
node scripts/merge-500bowl-2025-awards.js
node scripts/validate-awards-data.js
```

第一支腳本讀取 500碗官方文字名單並輸出 `assets/500bowl-2025-candidates.json` 與 `assets/500bowl-2025-import-report.json`。第二支腳本只合併單一縣市高信心資料到 `assets/awards-taiwan.500bowl-2025-draft.json`，跨縣市列保留在 `assets/500bowl-2025-merge-report.json` 待人工覆核。第三支腳本固定驗證正式資料與最新 draft 一致。

500碗 2026 建構流程：

```text
node scripts/build-500bowl-2026-candidates.js
node scripts/merge-500bowl-2026-awards.js
node scripts/build-core-awards-public-source-report.js
node scripts/validate-awards-data.js
```

第一支腳本讀取 500碗 2026 官方頁與該頁連結的官方 Google My Maps KML，輸出 `assets/500bowl-2026-candidates.json`、`assets/500bowl-2026-google-map.kml` 與 `assets/500bowl-2026-import-report.json`。官方頁文字層解析出 441 筆候選，KML 共有 472 個 Placemark，並含地址、行政區、菜系、得獎菜色、電話與營業時間；正式資料以 KML 的 472 筆為準。第二支腳本會清理前一輪文字層匯入但未被 KML 確認的 2026 500碗獎項，清單保留在 `assets/500bowl-2026-merge-report.json`。

500甜批次更新流程：

```text
node scripts/build-500sweet-2025-candidates.js
node scripts/merge-500sweet-2025-awards.js
node scripts/validate-awards-data.js
```

第一支腳本讀取 500甜官方完整名單頁並輸出 `assets/500sweet-2025-candidates.json` 與 `assets/500sweet-2025-import-report.json`。第二支腳本只合併單一縣市高信心資料到 `assets/awards-taiwan.500sweet-2025-draft.json`；新竹 / 嘉義縣市不明列、連鎖與線上通路保留在 `assets/500sweet-2025-merge-report.json` 待人工覆核。第三支腳本固定驗證正式資料與最新 500甜 draft 一致。

重要限制：

- 2026 完整名單尚未正式發布前，不建立 2026 完整星級或必比登資料。
- Wikipedia 或公開資料只用於補別名，不作為獎項主來源。
- 新增資料時必須保留來源 URL、年份與審核報告。
- 新增 500碗/500甜時，`guide` 分別使用 `500bowl` / `500sweet`，可填 `bowls` / `sweets` 或 `dishBowls` / `dishSweets`；若只有入選無單位數，仍可只填 `level` 與 `year`，但必須有來源 URL。

## 版本規則

每一版進版都要更新 `VERSION`：

```text
YYYY.MM.DD.N
```

畫面上 Logo 右側顯示短版號：

```text
vMM.DD.N
```

例如：

```text
VERSION = 2026.06.27.22
畫面顯示 = v06.27.22
```

## 維護注意事項

- 不要加入假餐廳資料或死資料。
- Google API key 必須留在後端 Secret；若另設測試 key，也必須設定 referrer 與 API 限制。
- 批次 Google enrichment 腳本不得讀取公開前端 Maps key；必須使用明確的 `GOOGLE_MAPS_SERVER_API_KEY`，避免本機腳本因 browser referrer 限制造成大量 403。
- Functions 依賴安全修補優先使用非破壞性 `npm audit fix`；若 audit 要求 `--force` 並牽涉 Firebase Admin / Functions 重大版本變更，必須另開任務規劃與完整測試，不可直接套用。
- Functions source discovery 必須保持快速載入；Firebase Admin Auth、App Check、Firestore 等重型模組應在 request handler 內 lazy load，避免 Firebase CLI 部署時 manifest discovery 超過 10 秒 timeout。
- 所有新濾網都要確認是否真的會影響 Google 查詢、硬過濾或 AI 判斷，不要只做 UI。
- 所有新功能都要預設使用快取、延後補抓、可取消或可去重的 API 流程；不能為了 UI 即時感而無限制重打 Google API。
- 手機 360px 寬度一定要檢查，避免濾網、卡片按鈕或文字擠版。
- 分享路由必須保持 `?place=` 可直接打開。
- 新增大資料時優先放在 `assets/`，不要全部塞進 `index.html`。
- AI 相關功能應走後端 proxy，不要在前端放 AI key。
- 在 Windows / PowerShell 讀取 `.js`、`.json`、`.md` 時要明確指定 UTF-8，例如 `Get-Content -Encoding UTF8`，避免把正常中文誤判成 mojibake。

## 後續可優化方向

- 將 `index.html` 的狀態管理、API adapter、卡片 render 與事件處理拆成可測試模組，降低單檔維護風險。
- 針對村里與評鑑多選建立更可解釋的 fallback report，清楚列出哪一層條件被放寬。
- 建立真正的動態 OG 分享頁；目前 `?place=` 可開啟獨立狀態，但社群預覽 metadata 仍受靜態頁限制。
- 持續處理獎牌資料 merge report 的人工確認項目，名稱、分店、行政區或年份未確認前不得自動掛獎。
- 將後台成本估算與 Google Cloud Billing export 對照；目前後台金額是事件估算，不是帳單真值。
- 補齊外部平台訊號覆蓋，但維持批次匯入、來源 URL 與人工覆核，不在搜尋時即時爬站。
- Firebase Functions 已升級至 Admin SDK 14 modular API 與 firebase-functions 7.3.0；後續持續追蹤官方相依更新，不為消除 audit 警告直接做破壞性 major override。
- 建立 Android Chrome 與 iPhone Safari 的固定回歸清單，特別覆蓋登入 redirect、鍵盤焦點、縮放、返回鍵與照片燈箱。
- 持續追蹤 GitHub Actions runtime 淘汰時程；目前 Pages actions 已升級至 Node.js 24 major。
- PWA／離線殼層僅作後續選項；不可快取搜尋結果冒充即時 Google 資料。

## 常見故障與定位

### 搜尋只出 0 到 2 家

1. 先確認使用者是否真的按了「套用」，以及 `rankSearchCommitted` 是否為 true。
2. 檢查 Functions `apiEvents`、瀏覽器 Network response 與系統導引；不可把 401、403、429 或 5xx 當成 0 家。
3. 檢查候選池是否被空陣列快取、評鑑多選是否誤用 AND、關鍵字是否過度嚴格。
4. 依時段、里、區、縣市、營業、供餐、評鑑順序確認放寬流程，並確保畫面揭露放寬狀態。

### `NGE_SEARCH_LOGIC.* is not a function`

通常是新版 HTML 載到舊版快取 JS。確認核心 script URL 都帶當前 `VERSION`，執行 `node scripts/test-static-asset-versions.js`，更新版本後重新部署。

### 中文顯示 `???` 或亂碼

用 `Get-Content -Encoding UTF8` 讀取原檔，再用瀏覽器確認。若檔案內容真的被問號取代，從可驗證來源修復文字；不可只改終端 code page 後宣稱完成。

### AI 回傳 401／未啟用

確認前端有 Firebase ID token、header 是否是可列舉 plain object、Functions service account 是否有 Vertex AI 權限，以及 `aiClassify` action 是否成功寫入 `apiEvents`。

### Routes／Geocode 回傳 403

確認 `nearby-good-eats` 專案已啟用對應 API、後端 key API restriction、帳單綁定與 Secret 版本。不要改用前端 key 繞過。

### 詳情照片消失

照片只在詳情 lazy load。檢查 place ID、Details response、photo proxy URL 是否過期、圖片 fallback 與 Network 狀態；列表卡片沒有照片本身不是錯誤。

### 手機 Google 登入迴圈

檢查 Firebase authorized domains、Google provider、popup／redirect 分流、redirect result 是否只處理一次，以及 GitHub Pages 正式 origin 是否一致。

### 濾網輸入框一直跳掉

輸入期間不可重建整個濾網 DOM；處理 `focus`、`compositionstart`／`compositionend`，只更新 draft，等「套用」才 commit 與搜尋。

### 正式站仍是舊版

先看 GitHub Pages workflow，再直接讀正式站 `VERSION` 與 HTML asset query。確認部署 commit、CDN／瀏覽器快取與本機 HEAD 三者，不要只看本機檔案。

## 接手完成條件

新接手者完成以下項目才算具備可修改狀態：

- 能說明首次進站、套用搜尋、放寬到 3 家、下一組的完整狀態流程。
- 能指出 Places、Routes、Geocode、Photos、AI 分別在哪一層呼叫以及如何記錄配額。
- 能說明 Google 評分、評論數、正式評鑑與外部訊號的權重關係。
- 能從 `place_id` 追到候選池、Details、分享路由、快取與事件記錄。
- 能執行最低驗證矩陣，並區分本機測試、正式站 smoke 與人工手機 QA。
- 能在不刪資料、不洩漏 secret、不重打無謂 API 的前提下完成部署與回滾。

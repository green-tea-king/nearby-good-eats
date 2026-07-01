# 在地美食榜專案說明

版本：2026.07.01.23

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
- `assets/app-settings.js`：公開的非機密執行設定，集中管理後端 proxy 與資料檔路徑；不得放 Google Maps secret key。
- `assets/filter-rules.js`：排行榜濾網定義與精準度層級。
- `firebase-config.js`：Firebase Auth / Firestore 設定，未填寫前登入功能保持關閉。
- `firestore.rules`：Firestore 安全規則，限制使用者只能寫自己的使用紀錄、管理員可讀後台資料。
- `firebase.json`：Firebase CLI 使用的 Firestore 規則設定。
- `functions/`：Firebase Cloud Functions proxy 原始碼，負責驗證登入、代打 Google Places / Routes、AI 分類與 API 事件記錄。
- `VERSION`：正式版本號，格式為 `YYYY.MM.DD.N`。
- `assets/local-food-rank-logo.png`：排行榜頁面 Logo。
- `assets/certification-badges.json`：Google 真欄位認證徽章規則，例如高分認證、萬則口碑、可訂位、聚餐友善。
- `assets/external-signals.json`：批次更新的外部訊號入口，用於未來社群聲量、平台認證、媒體推薦；前端不得即時查外部網站，只讀這個靜態資料檔。
- `assets/external-source-coverage.json`：外部來源覆蓋狀態報告，列出米其林、500盤、500碗、500甜、Google 評論、愛食記、OpenRice、Tripadvisor 的目前狀態、資料數與匯入限制。
- `assets/platform-signals.manual.json`：愛食記、OpenRice、Tripadvisor 等平台資料的人工 / AI 整理入口。此檔只放有 URL、審核者與信心等級的可追溯資料，經 `scripts/merge-platform-signals.js` 合併進 `assets/external-signals.json`。
- `assets/platform-signals.import.csv`：平台口碑資料的表格匯入入口；欄位包含餐廳、縣市、來源、分數、信心、評論數、證據、URL 與審核者，經 `scripts/import-platform-signals-csv.js` 轉成 `platform-signals.manual.json`。
- `assets/platform-source-probe-report.json`：平台來源可用性探測報告。只記錄愛食記、OpenRice、Tripadvisor 是否適合批次整理，不匯入餐廳資料。
- `assets/social-signal-config.json`：社群熱度批次更新設定，目前以 YouTube Data API 為第一階段來源，控制每次查詢餐廳數、影片數、時間範圍與分數權重。
- `assets/taiwan-villages.json`：台灣縣市 / 區域 / 村里名稱資料，只存行政區名稱，不含邊界座標。
- `assets/awards-taiwan.json`：餐廳評鑑名單入口，用於米其林、米其林入選、必比登、500 盤、500 碗、500 甜、50 Best 等加權；2025 已擴充米其林星級 53 家、米其林入選 222 筆、必比登 144 家、500 盤官方文字名單 260 筆餐廳獎項、500 碗官方文字名單高信心 415 筆、500 甜官方文字名單高信心 328 筆，並保留來源 URL。
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
   - 主卡最多顯示 4 個強徽章；外部評鑑優先，其次高分認證、口碑、可訂位、聚餐友善等。
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
8. 評鑑：米其林三星 / 米其林二星 / 米其林一星 / 米其林星 / 米其林入選 / 必比登 / 綠星 / 500盤 / 500碗 / 500甜

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
- `評鑑` 是本地批次資料硬濾網，只讀 `assets/awards-taiwan.json` 已整理的米其林星等、米其林入選、必比登、綠星、500盤、500碗與 500甜資料；不把評鑑選項丟進 Google 搜尋詞，也不增加即時 Google API 調用。米其林可選三星 / 二星 / 一星，也可選全部米其林星。
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
- 登入 UX 會顯示登入中、錯誤訊息；popup 被阻擋時改用 redirect 登入。Firebase 未允許網域或未啟用 Google provider 時會在登入卡片提示。
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

- Maps JavaScript API
- Places API New
- Geocoding API
- Routes API
- Distance Matrix API fallback

Google Places / Routes 的正式方向是走 Firebase Cloud Functions proxy。`functions/` 已建立 `api` 與 `photo` proxy，會驗證 Firebase ID token、可驗證 `X-Firebase-AppCheck` token、使用 `GOOGLE_MAPS_API_KEY` Secret 代打 Google API，並寫入 `apiEvents`。

目前先部署 GitHub Pages 靜態版，`assets/app-settings.js` 暫時使用 Google Maps browser key fallback，不走 Firebase Functions proxy，避免 Blaze 付費門檻阻塞上線。這個 key 必須在 Google Cloud 設定 HTTP referrer 與 API 限制。若後續出現濫用或成本風險，再回到 Functions proxy / App Check / rate limit 架構。

搜尋類 API (`textSearch`、`nearbySearch`) 套用每日使用者配額：一般使用者每天 30 次搜尋，管理員不限。一次排行榜整理即使內部查多個縣市，也會用同一個 quota key 合併計算成一次使用者搜尋。

2026-07-01 外部手機測試期間，`assets/app-settings.js` 設定 `apiLimits.externalTestMode:true`，Functions proxy 預設 `DISABLE_SEARCH_QUOTA !== "false"`，因此暫停每日 30 次搜尋封鎖，但仍保留 Google 登入、`usageEvents` 與 `apiEvents` 紀錄。明天恢復管控時，將 Functions 環境變數設為 `DISABLE_SEARCH_QUOTA=false`，並把 `assets/app-settings.js` 的 `externalTestMode` 改回 `false`。

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
- Google 評分 / 評論數仍是主體；米其林、必比登、500 盤、500 碗、500 甜、50 Best 等外部資料只做額外加分。
- 外部評鑑權重原則：米其林星級高權重；必比登與 500 系列中高權重；50 Best 高權重但只影響少數真實入榜店。外部評鑑總加分有上限，避免壓過 Google 真實評分與評論量。
- 社群聲量、平台認證、媒體推薦等外部資料不做使用者查詢時的即時抓取；先批次整理進 `assets/external-signals.json`，再由前端讀取，降低 API 成本並避免來源不穩。
- 社群聲量採 API 優先、批次更新。第一階段來源為 YouTube Data API：每次預設只查 10 家候選餐廳、每家最多 8 支影片，影片必須命中店名或別名才可寫入。分數依影片數、90 天內影片數與觀看數對數加權產生，僅作輔助訊號。
- `youtubeBuzz` 已接入前端排序與詳情：排序最多只加 `0.12`，社群訊號總加分上限 `0.14`；卡片第一眼只顯示小徽章，展開詳情才顯示影片數、觀看數與來源連結。
- 愛食記、OpenRice、Tripadvisor 先採手動 / AI 整理檔匯入：資料必須有來源 URL、信心等級、更新日期與審核者，合併後以 `platformRating` 或 `platformCertification` 做小幅輔助加分；沒有資料就不顯示徽章，不用猜測。2026-07-01 已建立第一批種子資料：2 家餐廳、6 筆平台訊號，三個平台各 2 筆。
- 2026-07-01 平台來源探測結果：愛食記頁面可讀但 robots 有廣泛限制；OpenRice 與 Tripadvisor 也不符合安全自動解析條件。因此三者都維持手動整理或授權 API，不做自動抓取匯入。
- 卡片認證章分兩類：
  - 外部評鑑獎牌：來自 `assets/awards-taiwan.json`，目前支援米其林星級、必比登、綠星、500 盤、500 碗、500 甜、50 Best；資料帶縣市與來源欄位，前端會合併同店多獎項並避免跨縣市誤標。
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

目前前端已保留 `CONFIG.AI_FILTER` 設定，但預設關閉：

```js
AI_FILTER: {
  MODE: "proxy",
  ENDPOINT: "",
  MAX_ITEMS: 80,
}
```

正確方向不是把 AI API key 放前端，而是建立後端或 serverless proxy：

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

## 部署

目前使用 GitHub Pages：

```text
https://green-tea-king.github.io/nearby-good-eats/
```

部署流程：

1. 修改檔案。
2. 更新 `VERSION`。
3. 本機檢查 JavaScript 語法。
4. 手機寬度截圖或互動驗證。
5. 使用 `scripts/deploy-github-contents.ps1` 透過 GitHub Git Data API 建立單一 commit；本機不依賴 `.git`。
6. 等 GitHub Pages 更新。
7. 用 `scripts/smoke-live-site.ps1 -ExpectedVersion <VERSION>` 驗證正式 URL 的 `VERSION`、首頁版本與獎牌資料統計。

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
- 500碗：415 筆，來自 2025 第三屆 500碗官方頁文字名單的單一縣市高信心解析；47 筆跨縣市列保留在 merge report 待人工覆核。
- 500甜：328 筆，來自 2025 第一屆 500甜官方頁文字名單的單一縣市高信心解析；5 筆新竹 / 嘉義縣市需人工判斷、23 筆連鎖與線上通路保留在 merge report 待人工覆核。

可加入但必須分層處理的外部來源：

- Google Maps reviews：已是主資料來源，使用 Places 評分、評論數、摘要與服務欄位；不得另存大量評論全文。評論雜訊防護只使用既有 rating / userRatingCount / Google 摘要，不為了抓洗評而增加即時 API 調用。
- Michelin Guide Taiwan：正式獎牌來源，星級與必比登可加權；入選餐廳只做弱加分與弱徽章；綠星只顯示永續徽章。
- 500盤、500碗、500甜：正式獎牌來源，批次整理後進 `assets/awards-taiwan.json`，只做中高權重加分。
- 50 Best：正式獎牌來源，高權重但只影響少數入榜店。
- 愛食記、OpenRice、Tripadvisor：平台口碑/聲量來源，預設不放進 `awards-taiwan.json`；只能在授權 API、手動整理或可追溯批次資料可用時寫入 `assets/external-signals.json`，作小幅輔助訊號與提示，不取代 Google 評分。
- `assets/external-source-coverage.json` 是目前覆蓋狀態的權威摘要：評鑑來源會標示 `integrated_data`，平台來源在已有審核資料時標示 `manual_data_available`，尚無人工資料時標示 `batch_pipeline_ready_no_data`。
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
- 所有新濾網都要確認是否真的會影響 Google 查詢、硬過濾或 AI 判斷，不要只做 UI。
- 所有新功能都要預設使用快取、延後補抓、可取消或可去重的 API 流程；不能為了 UI 即時感而無限制重打 Google API。
- 手機 360px 寬度一定要檢查，避免濾網、卡片按鈕或文字擠版。
- 分享路由必須保持 `?place=` 可直接打開。
- 新增大資料時優先放在 `assets/`，不要全部塞進 `index.html`。
- AI 相關功能應走後端 proxy，不要在前端放 AI key。
- 在 Windows / PowerShell 讀取 `.js`、`.json`、`.md` 時要明確指定 UTF-8，例如 `Get-Content -Encoding UTF8`，避免把正常中文誤判成 mojibake。

## 後續可優化方向

- 建立 serverless proxy，支援 AI 分類與摘要。
- 針對村里查詢加入更柔性的 fallback，避免某些餐廳地址沒有里名導致結果過窄。
- 將 `index.html` 拆成多檔模組，降低單檔維護成本。
- 建立正式測試腳本，固定檢查首頁、濾網、分享路由、Google API 載入與手機寬度。

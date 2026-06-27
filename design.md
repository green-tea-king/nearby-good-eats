# 在地美食榜專案說明

版本：2026.06.27.6

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
- `admin.html`：Firebase 後台統計頁，登入管理員可看使用紀錄。
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
- `assets/taiwan-villages.json`：台灣縣市 / 區域 / 村里名稱資料，只存行政區名稱，不含邊界座標。
- `assets/awards-taiwan.json`：餐廳評鑑名單入口，用於米其林、必比登、500 盤、50 Best 等加權；2025 已擴充米其林星級 53 家、必比登 144 家、500 盤官方文字名單 260 筆餐廳獎項，並保留來源 URL。
- `awards-taipei.json`：舊版台北評鑑資料檔，保留作為相容與資料來源備份。
- `scripts/export-release.ps1`：版本匯出腳本。
- `RELEASES.md`：版本匯出流程備註。

## 畫面與版型

目前只保留一種主要版型：

1. 頁首
   - 左側 Logo。
   - Logo 右側小字版本號，例如 `v06.24.15`。
   - 右側功能按鈕：評分說明、濾網、重新整理。

2. 濾網面板
   - 預設收合，點漢堡按鈕展開。
   - 點擊、捲動、縮放或手勢發生在濾網外圍時自動收回。
   - 手機鍵盤彈出造成的 viewport resize / scroll 不會在輸入框有焦點時收回濾網，避免關鍵字輸入中斷。
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

### 預設值

- `營業` 預設為 `營業中`。
- 首次進入排行榜會先要求使用者定位，定位成功後預設套用 `交通 = 走路`。
- 預設排行榜使用定位點附近 `800m` 內的 Google Places 真實餐廳；若篩選後沒有結果，會放寬到 `2000m`。
- `時段` 會依使用者當下時間自動帶入。
- `地區` 不再預設套用定位；只有使用者手動選縣市 / 區域 / 里時才作為行政區濾網。
- `地區` 與 `交通` 是互斥濾網：選地區會清掉交通與定位提示，選走路、開車或交通定位會清掉縣市 / 區域 / 里。
- `交通` 定位成功後會在交通列提示「定位：縣市區里」，此位置作為步行 / 開車估算與導航起點。
- `交通` 模式採同心圓擴張搜尋：走路依序查 800m / 1200m / 1600m / 2000m / 3000m / 5000m，開車依序查 3000m / 5000m / 8000m / 12000m / 20000m / 30000m；每一圈都會補 Google 路線時間，優先湊滿 3 張符合走路 15 分鐘內或開車 30 分鐘內的卡片。若最大圈仍不足 3 張，才用同圈內最接近的路線候選補足，但不放寬關鍵字、營業、吃法、飲食等強條件。

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
綜合分數 = 貝氏分數 + 評論量加分 + 評鑑加分
```

其中：

- `r`：Google rating。
- `n`：Google userRatingCount。
- `m`：當批結果平均評分。
- `C`：可信度門檻，目前設定為 150。
- 評論量加分用 `log10(n+1) * 0.06` 計算，上限 `0.32`，讓同星等時評論數多者明顯更前，但避免評論數超大的店過度壓過品質。
- Google 評分 / 評論數仍是主體；米其林、必比登、500 盤、50 Best 等外部資料只做額外加分。
- 外部評鑑權重原則：米其林星級高權重；必比登與 500 盤中高權重；50 Best 高權重但只影響少數真實入榜店。外部評鑑總加分有上限，避免壓過 Google 真實評分與評論量。
- 社群聲量、平台認證、媒體推薦等外部資料不做使用者查詢時的即時抓取；先批次整理進 `assets/external-signals.json`，再由前端讀取，降低 API 成本並避免來源不穩。
- 卡片認證章分兩類：
  - 外部評鑑獎牌：來自 `assets/awards-taiwan.json`，目前支援米其林星級、必比登、500 盤、50 Best；資料帶縣市與來源欄位，前端會合併同店多獎項並避免跨縣市誤標。
  - Google 真欄位認證：由 Google rating / userRatingCount / Places 服務欄位產生，例如高分認證、千則口碑、可訂位、聚餐友善、素食友善、戶外座位、寵物友善、無障礙資訊。

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
- 濾網、說明、地區彈窗、地圖選點與地圖頁會建立暫態 history；手機返回鍵優先關閉最上層 UI，沒有開啟 UI 時才處理分享路由或瀏覽器返回。
- 濾網彈窗在外圍點擊、滾動、縮放時會收回；輸入框聚焦期間保留，避免鍵盤開合時誤關。

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
5. `git commit`
6. `git push origin main`
7. 等 GitHub Pages 更新。
8. 用正式 URL 驗證 `VERSION` 與新版功能。

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
VERSION = 2026.06.27.6
畫面顯示 = v06.27.6
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

## 後續可優化方向

- 建立 serverless proxy，支援 AI 分類與摘要。
- 針對村里查詢加入更柔性的 fallback，避免某些餐廳地址沒有里名導致結果過窄。
- 將 `index.html` 拆成多檔模組，降低單檔維護成本。
- 建立正式測試腳本，固定檢查首頁、濾網、分享路由、Google API 載入與手機寬度。

# 在地美食榜專案說明

版本：2026.06.25.1

## 專案目標

這是一個手機直式使用的美食排行榜 Web App。首頁直接進入「在地美食榜」，以 Google Places 真實餐廳資料為核心，依使用者目前時間、定位點、步行可到範圍、濾網條件與綜合評分排序，快速列出前 5 名餐廳。

目前定位是：

- 單一手機版型，優先服務 360px 到 480px 寬度的直式手機螢幕。
- 不使用假資料或死資料，主要資料來自 Google Places API。
- 評分是核心資訊，餐廳卡片必須明確顯示 Google 評分、評論數與綜合分數。
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
- `assets/taiwan-villages.json`：台灣縣市 / 區域 / 村里名稱資料，只存行政區名稱，不含邊界座標。
- `assets/awards-taiwan.json`：餐廳評鑑名單入口，用於米其林、必比登、500 盤等加權；已擴充 2025 500 盤全台名單，並保留官方來源 URL。
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
   - 顯示外部評鑑獎牌與 Google 真欄位認證章，例如米其林、必比登、500 盤、高分認證、千則口碑、可訂位、聚餐友善、素食友善。
   - 顯示服務標籤，例如內用、外帶、外送、可訂位、素食、供應酒、適合團體。
   - 顯示 Google 照片、Google 摘要或評論摘要。
   - 沒有摘要資料時不顯示 placeholder，避免讓使用者誤會功能壞掉。
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
7. 情境：聚餐 / 獨享
8. 型態：正餐 / 小吃
9. 飲食：葷食 / 素食
10. 菜式：中式 / 西式
11. 風格：傳統 / 現代

### 預設值

- `營業` 預設為 `營業中`。
- 首次進入排行榜會先要求使用者定位，定位成功後預設套用 `交通 = 走路`。
- 預設排行榜使用定位點附近 `800m` 內的 Google Places 真實餐廳；若篩選後沒有結果，會放寬到 `2000m`。
- `時段` 會依使用者當下時間自動帶入。
- `地區` 不再預設套用定位；只有使用者手動選縣市 / 區域 / 里時才作為行政區濾網。
- `地區` 與 `交通` 是互斥濾網：選地區會清掉交通與定位提示，選走路、開車或交通定位會清掉縣市 / 區域 / 里。
- `交通` 定位成功後會在交通列提示「定位：縣市區里」，此位置作為步行 / 開車估算與導航起點。

### 濾網精準度

濾網分成三類：

- 硬濾網：Google 欄位能直接支援者，例如營業中、素食、可訂位、適合團體。
- 搜尋詞強化：把關鍵字與近似濾網直接丟進 Google Places Text Search，例如麵線、吃到飽、聚餐、小吃。
- 關鍵字是強條件：Google 回傳候選後，仍必須在店名、類型、Google 摘要或評論摘要實際命中關鍵字才顯示；不符合時寧可 0 筆，不顯示不相干店家。
- 關鍵字支援多詞，例如 `滷肉飯 排骨湯`。多詞採 AND 條件，每個詞都必須命中；卡片會標示命中來源，例如店名、類型、評論摘要、Google 摘要。
- 關鍵字無結果時只提供「放寬關鍵字」或取消條件，不改用不相干推薦。
- `吃到飽` 是高風險近似濾網，不能只因為搜尋詞命中就通過；結果必須在店名、類型、地址、Google 摘要或評論摘要出現吃到飽、自助餐、buffet、放題、無限供應或已知吃到飽品牌等明確證據。
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
6. 取前 5 名。
7. 對前 5 名補抓較完整欄位：照片、摘要、營業時間、服務資訊。
8. 用 Routes API 補步行與開車時間。
9. 渲染餐廳卡片。

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
- 米其林、必比登、500 盤會有額外加分。
- 卡片認證章分兩類：
  - 外部評鑑獎牌：來自 `assets/awards-taiwan.json`，目前支援米其林、必比登、500 盤；全台 500 盤資料帶縣市欄位，避免同名餐廳跨縣市誤標。
  - Google 真欄位認證：由 Google rating / userRatingCount / Places 服務欄位產生，例如高分認證、千則口碑、可訂位、聚餐友善、素食友善、戶外座位、寵物友善、無障礙資訊。

這個設計是為了處理「同樣 4 顆星，但評論數多者可信度應較高」的問題。

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

分享頁會顯示單張餐廳卡片，並提供「看完整排行榜」回到主排行榜。
頁面提供基本 OG / Twitter metadata；分享卡片載入成功後，前端會用該店名稱、評分、地址與照片更新 metadata。若社群平台需要伺服器端預覽圖，後續可把 `?place=` 交給 Functions 產生動態分享頁。
分享按鈕固定 copy link。Clipboard API 失敗時改用隱藏 textarea fallback，不呼叫系統分享面板，也不跳系統錯誤。

## 圖片與手機互動

- 餐廳照片使用 `loading="lazy"` 與 `decoding="async"`。
- 錯圖不移除 DOM，而是標記 `is-broken` 保留固定高度，避免卡片高度跳動。
- 照片列使用固定 grid 高度：三張圖 118px，單張圖 172px。
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
- 走路模式會優先用定位點附近步行可到範圍產生候選餐廳，再依綜合分數排序。
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
VERSION = 2026.06.25.1
畫面顯示 = v06.25.1
```

## 維護注意事項

- 不要加入假餐廳資料或死資料。
- Google API key 必須留在後端 Secret；若另設測試 key，也必須設定 referrer 與 API 限制。
- 所有新濾網都要確認是否真的會影響 Google 查詢、硬過濾或 AI 判斷，不要只做 UI。
- 手機 360px 寬度一定要檢查，避免濾網、卡片按鈕或文字擠版。
- 分享路由必須保持 `?place=` 可直接打開。
- 新增大資料時優先放在 `assets/`，不要全部塞進 `index.html`。
- AI 相關功能應走後端 proxy，不要在前端放 AI key。

## 後續可優化方向

- 擴充菜式：台式、日式、韓式、港式、火鍋、燒肉、咖啡甜點。
- 建立 serverless proxy，支援 AI 分類與摘要。
- 針對村里查詢加入更柔性的 fallback，避免某些餐廳地址沒有里名導致結果過窄。
- 將 `index.html` 拆成多檔模組，降低單檔維護成本。
- 建立正式測試腳本，固定檢查首頁、濾網、分享路由、Google API 載入與手機寬度。

# 在地美食榜專案說明

版本：2026.06.24.11

## 專案目標

這是一個手機直式使用的美食排行榜 Web App。首頁直接進入「在地美食榜」，以 Google Places 真實餐廳資料為核心，依使用者目前時間、定位點、步行可到範圍、濾網條件與綜合評分排序，快速列出前 5 名餐廳。

目前定位是：

- 單一手機版型，優先服務 360px 到 480px 寬度的直式手機螢幕。
- 不使用假資料或死資料，主要資料來自 Google Places API。
- 評分是核心資訊，餐廳卡片必須明確顯示 Google 評分、評論數與綜合分數。
- 濾網以「Google 真資料硬過濾 + 搜尋詞強化 + 可擴充 AI 二次判斷」為設計方向。

## 主要檔案

- `index.html`：主要 App，包含 HTML、CSS、JavaScript。
- `VERSION`：正式版本號，格式為 `YYYY.MM.DD.N`。
- `assets/local-food-rank-logo.png`：排行榜頁面 Logo。
- `assets/taiwan-villages.json`：台灣縣市 / 區域 / 村里名稱資料，只存行政區名稱，不含邊界座標。
- `awards-taipei.json`：餐廳評鑑名單，用於米其林、必比登、500 盤等加權。
- `scripts/export-release.ps1`：版本匯出腳本。
- `RELEASES.md`：版本匯出流程備註。

## 畫面與版型

目前只保留一種主要版型：

1. 頁首
   - 左側 Logo。
   - Logo 右側小字版本號，例如 `v06.24.11`。
   - 右側功能按鈕：評分說明、濾網、重新整理。

2. 濾網面板
   - 預設收合，點漢堡按鈕展開。
   - 點擊、捲動、縮放或手勢發生在濾網外圍時自動收回。
   - 地區濾網為三層：縣市 / 區域 / 里。
   - 交通濾網提供走路 / 開車，定位按鈕放在交通列，用來設定路線出發點並顯示定位提示。

3. 餐廳卡片
   - 顯示排行、店名、Google 評分、評論數、營業狀態、地區、路線時間、綜合分數。
   - 顯示服務標籤，例如內用、外帶、外送、可訂位、素食、供應酒、適合團體。
   - 顯示 Google 照片、Google AI 摘要或評論摘要。
   - 動作按鈕：導航、分享、詳情。
   - 分享按鈕固定複製獨立卡片連結，避免不同系統分享面板沒有可用目標時跳出錯誤。

## 濾網設計

目前排行榜濾網順序：

1. 地區：縣市 / 區域 / 里
2. 交通：走路 / 開車 / 定位交通起點
3. 營業：不限 / 營業中
4. 時段：早餐 / 早茶 / 午餐 / 午茶 / 晚餐 / 消夜
5. 吃法：單點 / 吃到飽
6. 情境：聚餐 / 獨享
7. 型態：正餐 / 小吃
8. 飲食：葷食 / 素食
9. 菜式：中式 / 西式
10. 風格：傳統 / 現代

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
- 搜尋詞強化：把關鍵字直接丟進 Google Places Text Search，例如吃到飽、聚餐、小吃。
- 近似 / AI 濾網：Google 沒有直接欄位時，先以店名、類型、摘要、Google flags 判斷，後續可接後端 AI proxy 強化。

## 資料來源與 API

### Google APIs

目前 App 依賴 Google Maps Platform：

- Maps JavaScript API
- Places API New
- Geocoding API
- Routes API
- Distance Matrix API fallback

Google API key 放在 `index.html` 的 `CONFIG.GOOGLE_API_KEY`。這是前端靜態站，因此必須在 Google Cloud Console 設定 HTTP referrer 限制，避免 key 被濫用。

### 餐廳資料流程

1. 載入 Google Maps JavaScript API。
2. 依地區與濾網組合呼叫 Google Places。
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
- 評論量加分用 log10 計算，避免評論數超大的店過度壓過品質。
- 米其林、必比登、500 盤會有額外加分。

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
  MODE: "off",
  ENDPOINT: "",
  MAX_ITEMS: 80,
}
```

正確方向不是把 AI API key 放前端，而是建立後端或 serverless proxy：

```text
Google Places 真資料 -> 後端 AI 分類 -> 回傳 tags + confidence -> 前端套用濾網
```

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
VERSION = 2026.06.24.11
畫面顯示 = v06.24.11
```

## 維護注意事項

- 不要加入假餐廳資料或死資料。
- Google API key 必須設定 referrer 與 API 限制。
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

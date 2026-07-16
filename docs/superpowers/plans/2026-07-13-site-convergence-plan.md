# 在地美食榜完整收斂 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task.

**Goal:** 完成搜尋正確性、成本控制、資料驗證、後台統計與手機正式站驗收。

**Architecture:** 保留單頁 GitHub Pages 架構，先把搜尋候選、有效條件與顯示結果狀態分離；Functions 仍做可選的安全邊界，但正式 browser key 模式要有明確的成本上限與提示。批次獎項資料與外部訊號維持靜態檔。

**Tech Stack:** HTML/CSS/JavaScript、Firebase Auth/Firestore、Firebase Functions、PowerShell、Node.js、GitHub Pages。

## Global Constraints

- 不新增假餐廳、假評分或未追溯獎項資料。
- 只有套用觸發 Google 搜尋；濾網變更不搜尋。
- Google 評分與評論數是排序主體。
- 關鍵字、地區、評鑑與菜系不可自動放寬。
- 走路 15 分鐘、開車 30 分鐘；距離不足才可同心圓放寬。
- 詳情與照片延後載入；相同 place_id 必須快取。

### Task 1: 搜尋狀態與回歸測試

**Files:** index.html, scripts/test-search-logic.js

- [ ] 建立零、1、2、3 筆候選的測試輸入與預期結果。
- [ ] 修正補滿邏輯只解除距離限制，並把 effectiveFilter 顯示給使用者。
- [ ] 讓下一組記住已顯示 place_id，候選不足時回到第一組並說明。
- [ ] 把預設交通改為走路，定位只在套用後請求。
- [ ] 執行測試與 node --check。

### Task 2: API 成本與安全邊界

**Files:** assets/app-settings.js, functions/index.js, firestore.rules, index.html

- [ ] 把 browser key 的模式、每日上限與 Proxy 狀態明確化，禁止 UI 顯示未啟用的安全能力。
- [ ] 為前端全台候選增加查詢快取與候選上限，避免每次首次搜尋固定掃 22 個縣市。
- [ ] Firestore usage event 限制欄位、大小與時間範圍。
- [ ] Functions 對所有計費 action 套用一致的驗證與成本紀錄。
- [ ] 替換舊 Distance Matrix 呼叫並保留逾時 fallback。

### Task 3: 資料與後台

**Files:** scripts/validate-awards-data.js, scripts/validate-external-signals.js, scripts/validate-external-source-coverage.js, admin.html, assets/

- [ ] 將驗證契約收斂到六類核心評鑑與目前外部訊號規則。
- [ ] 新增地址、行政區、菜系、年份、URL 的完整度報告。
- [ ] 修正後台 source count 與 filter event 映射。
- [ ] 補入可合法確認的 Michelin 2026 即時入選資料；未知年份不猜。

### Task 4: 手機與分享

**Files:** index.html, scripts/smoke-live-site.ps1

- [ ] 修正固定登入列避讓，驗證 360/390 寬度。
- [ ] 補 select label、lightbox 焦點與狀態 live region。
- [ ] 保持 place 路由，明確處理社群爬蟲無法取得動態 OG 的限制。
- [ ] 增加初始、搜尋、空結果、分享路由與卡片照片 smoke。

### Task 5: 整合部署

**Files:** VERSION, RELEASES.md, .github/workflows/

- [ ] 跑所有 validator、搜尋回歸、UI 掃描與正式站 smoke。
- [ ] 檢查工作樹、差異與部署分支同步狀態。
- [ ] 部署 GitHub Pages，確認 live version、資料筆數與手機流程。

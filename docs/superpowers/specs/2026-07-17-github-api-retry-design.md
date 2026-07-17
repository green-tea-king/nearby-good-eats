# GitHub Git Data API 部署重試設計

## 目標

讓既有 `scripts/deploy-github-contents.ps1` 在 GitHub REST API 發生短暫 502、503、504 或回傳 HTML 閘道錯誤時，能在同一個 API 步驟內有限重試；避免一次暫時性故障中斷整次 GitHub Pages 部署，同時維持現有平台、repository、branch、allowlist 與非 force 更新行為。

正式站與遠端目標不變：

- URL：`https://green-tea-king.github.io/nearby-good-eats/`
- Repository：`green-tea-king/nearby-good-eats`
- Branch：`main`
- 部署方式：GitHub Git Data API 建立 blob、tree、commit，再以 `force=false` 更新 ref

## 已選方案

採用「單次 `gh api` 呼叫層的有限重試」：

1. 每個 API 步驟自行判斷是否屬於可重試的短暫錯誤。
2. 符合條件時最多嘗試 6 次，等待秒數依序為 2、4、8、12、15 秒。
3. 一旦成功，立即回傳該次 JSON 結果並繼續原部署流程。
4. 超過上限仍失敗時，停止部署並保留 endpoint、嘗試次數與最後錯誤摘要。
5. 非短暫錯誤第一次就停止，不用重試掩蓋權限、參數或資料問題。

不採用整支腳本從頭重跑，因為這會重做已成功的 blob、tree 與 commit 步驟，也不易判斷故障發生位置。不採用無限重試，避免 GitHub 長時間異常時部署程序永久卡住。

## 可重試錯誤

只有下列明確短暫性情況可以重試：

- `gh api` 錯誤輸出包含 HTTP 502。
- `gh api` 錯誤輸出包含 HTTP 503。
- `gh api` 錯誤輸出包含 HTTP 504。
- 回應內容明確是 HTML 文件或 HTML 閘道錯誤，而不是預期的 JSON。

以下錯誤不得自動重試：

- 401：登入或 token 問題。
- 403：權限、rate limit 或 repository policy 問題。
- 404：owner、repo、branch 或 endpoint 錯誤。
- 409、422：Git ref 衝突或 payload 驗證失敗。
- 本機檔案遺失、JSON 序列化失敗、`gh` 未安裝等本機問題。
- 其他未明確列入的錯誤。

這個白名單避免把永久錯誤延遲後才回報，也避免因寬鬆文字比對而重送不安全的請求。

## 安全與一致性

- GET 重試不改變遠端狀態。
- 相同內容的 blob POST 以內容雜湊識別，重試不改變部署內容。
- tree 與 commit 若因不確定回應而留下未被 ref 指向的物件，不會改動正式站；最後只使用成功回應的 SHA。
- ref PATCH 只重送同一個新 commit SHA，且維持 `force=false`；不 force push、不改寫既有歷史。
- 日誌只顯示 HTTP method、endpoint、目前嘗試次數、等待秒數與錯誤摘要，不輸出 GitHub token、request body 或檔案內容。
- 所有暫存 JSON 檔仍由既有 `finally` 清除；不刪除專案檔案或遠端資源。

## 程式結構

新增一個可獨立測試的 PowerShell helper，集中負責：

1. 判斷錯誤文字是否符合短暫錯誤白名單。
2. 以注入的 operation 執行有限次數重試。
3. 使用可注入的 delay schedule，正式部署使用秒數退避，測試使用 0 秒。

`scripts/deploy-github-contents.ps1` 的 `Invoke-GhJson` 保留目前 GET 與有 body 的兩條路徑，只把實際 `gh api` 執行包進 helper。部署 allowlist 必須包含 helper 與對應測試，確保遠端保存的部署腳本仍可獨立使用。

## TDD 驗證案例

先建立測試並確認在 helper 尚未存在時失敗，再寫最小實作。測試至少覆蓋：

1. 前兩次回傳 HTTP 503／HTML、第三次成功：總共呼叫 3 次並回傳成功結果。
2. 第一次回傳 HTTP 401：只呼叫 1 次並立即失敗。
3. 持續回傳 HTTP 503：嘗試 6 次後失敗，錯誤包含 endpoint 與嘗試次數。
4. 一般 JSON 解析或本機錯誤：不得被判定為短暫錯誤。
5. 測試使用 0 秒延遲，不依賴 GitHub、網路或登入狀態。

完成後仍要執行 `AGENTS.md` 最低驗證矩陣、PowerShell 重試測試、`git diff --check` 與靜態版本檢查。

## 版本與修改範圍

本次是正式部署工具行為修正，版本由 `2026.07.17.1` 更新為 `2026.07.17.2`，同步修改：

- `VERSION`
- `index.html` 的 `APP_VERSION_FALLBACK`
- `index.html` 四個核心靜態 JS 的 `?v=` query
- `design.md` 的文件版本與目前正式版本文字

預計新增或修改的部署相關檔案：

- `scripts/github-api-retry.ps1`
- `scripts/test-github-api-retry.ps1`
- `scripts/deploy-github-contents.ps1`

不修改 Firebase Functions、Firestore Rules、Google API 行為、前台搜尋邏輯或部署平台；本次完成後只需重新部署 GitHub Pages，不重複部署 Firebase。

## 完成條件

- PowerShell 測試能證明短暫錯誤會重試、永久錯誤不重試、重試次數有上限。
- 現有完整驗證矩陣通過；無法執行的項目需明確回報。
- 靜態部署成功更新既有 `main`，不得建立新 repository、Pages site 或 branch。
- GitHub Pages 正式站 `VERSION` 為 `2026.07.17.2`。
- 正式站 smoke 通過，並核對部署 commit、本機 branch 與遠端 `main` 的落差。
- 不刪除 `firebase-debug.log` 或任何其他檔案。

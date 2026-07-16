# 本機優先正式部署設計

## 目標

以 recovery commit `0670033` 保存的本機專案內容為權威來源，部署到既有 GitHub Pages 與 Firebase 專案；部署後重新取得遠端 `main`，精確盤點新版 Git 落差並提出後續維護建議。

## 已選方案

採用「本機完整部署後再比較」：

1. 從 `codex/workspace-recovery-20260716` 建立獨立部署 branch。
2. 依版本規則更新為 `2026.07.16.1`。
3. 部署前執行完整靜態、資料、Functions 與 Git 驗證。
4. 使用既有 GitHub Git Data API 腳本更新遠端 `main` 與 GitHub Pages。
5. 使用既有 Firebase 專案 `nearby-good-eats` 部署 `api`、`photo` 與 Firestore Rules。
6. 正式站 smoke 通過後 fetch 新版 `origin/main`，比較本機 branch、部署 commit 與正式站內容。

不採用「先整理 Git 再部署」，因使用者已指定先讓正式環境以本機內容為準；也不採用只部署靜態站，避免 Functions 與 Rules 留在不同版本。

## 部署範圍

### GitHub Pages

- 平台：原有 `green-tea-king/nearby-good-eats`。
- 來源：`main` branch 根目錄。
- 工具：`scripts/deploy-github-contents.ps1`。
- 部署訊息：`Deploy v2026.07.16.1 local-primary release`。
- 不建立新 repository、Pages site 或其他靜態平台。

### Firebase

- Project ID：`nearby-good-eats`。
- Functions：`api`、`photo`。
- Runtime：Node.js 22、2nd Gen、`us-central1`。
- Rules：`firestore.rules`。
- 不建立新 Firebase project、Hosting site、Functions 名稱或資料庫。

## 版本同步

部署版本固定為 `2026.07.16.1`，同步更新：

- `VERSION`
- `index.html` 的 `APP_VERSION_FALLBACK`
- `index.html` 四個核心靜態 JS 的 `?v=` query
- `design.md` 文件版本與目前正式版本文字

`scripts/test-static-asset-versions.js` 必須在部署前通過。

## 部署前驗證

執行 `AGENTS.md` 最低驗證矩陣，包括搜尋、登入、資料、靜態版本、Functions 單元測試、UI 文字掃描與 `git diff --check`。另外執行 inline JavaScript 語法檢查。

`npm audit --omit=dev` 的既有 8 個 moderate 傳遞相依風險需如實記錄；不可為了本次部署執行破壞性 `npm audit fix --force`。

任何測試或語法檢查失敗時停止部署，不部分發布。

## 部署順序與錯誤處理

1. 完成版本修改與本機 commit。
2. 部署 Firebase Functions；失敗即停止。
3. 部署 Firestore Rules；失敗即停止。
4. 部署 GitHub Pages 靜態內容；失敗即停止。
5. 等待 Pages workflow 完成並執行正式站 smoke。

部署命令不得輸出 OAuth token、API key、Secret Manager 值或 App Check secret。不得刪除資料、Functions、Firestore collection、branch 或 Git 歷史。

## 部署後 Git 比較

部署成功後：

1. fetch 最新 `origin/main`，不 merge、不 rebase。
2. 比較本機部署 branch 與 `origin/main` 的 commit ancestry、檔案清單與 blob 內容。
3. 分類為「正式站相同」「本機尚未進 GitHub」「遠端部署腳本額外追蹤」「行尾／產物管理問題」。
4. 提出後續修改建議，重點包含正常 commit/push 部署流程、部署 allowlist、Functions source 納入 Git，以及 generated artifacts 的追蹤政策。

## 完成條件

- 正式站回報版本 `2026.07.16.1`。
- `api`、`photo` Functions 為 ACTIVE 且 Node.js 22。
- Firestore Rules 部署成功。
- 正式站 smoke 通過。
- 回報部署 URL、時間、GitHub deployment commit、本機 commit、驗證結果與剩餘風險。
- 不自動 merge、push 本機 branch 或刪除 recovery branch。

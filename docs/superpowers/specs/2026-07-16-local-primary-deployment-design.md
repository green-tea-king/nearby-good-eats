# 本機優先正式部署設計

## 目標

以 recovery commit `0670033` 保存的本機專案內容為主要來源，先把最新 `origin/main` 的遠端功能安全合併進目前唯一工作資料夾，再部署到既有 GitHub Pages 與 Firebase 專案；部署後重新取得遠端 `main`，精確盤點新版 Git 落差並提出後續維護建議。

## 已選方案

採用「遠端功能先合併、本機安全設定優先、完整測試後部署」：

1. 從 `codex/workspace-recovery-20260716` 建立獨立部署 branch。
2. fetch 最新 `origin/main`，在目前資料夾執行非 fast-forward merge；不建立 worktree、不搬移專案。
3. 衝突逐檔處理：保留遠端新增功能與正式資料，同時保留本機較新的安全設定、Node.js 22、Vertex AI、Firestore Rules、規範與測試。
4. merge 後先執行完整靜態、資料、Functions 與 Git 驗證。
5. 驗證通過後依版本規則更新為 `2026.07.17.1`，再重跑版本與必要回歸檢查。
6. 使用既有 Firebase 專案 `nearby-good-eats` 部署 `api`、`photo` 與 Firestore Rules。
7. 使用既有 GitHub Git Data API 腳本更新遠端 `main` 與 GitHub Pages。
8. 正式站 smoke 通過後 fetch 新版 `origin/main`，比較本機 branch、部署 commit 與正式站內容。

不採用整批 `ours` 或整批 `theirs`，因兩側各有需要保留的內容；也不採用 rebase、hard reset 或另建工作資料夾。Recovery branch `codex/workspace-recovery-20260716` 與 commit `0670033` 保持不動，作為零遺失還原點。

## 合併規則

### 本機版本優先

- `AGENTS.md`、`project-rules.md`、`design.md` 的已定案維護與產品契約。
- `firestore.rules` 的 usage event 欄位與大小限制。
- `functions/` 的 Node.js 22、安全預設、Vertex AI helper、key／summary helper 與單元測試。
- `assets/search-logic.js`、`assets/auth-logic.js` 與對應測試中已通過的本機契約。
- `.gitignore`、`ops-checklist.md` 與本機新增的驗證文件。

### 遠端版本優先

- 本機沒有的遠端正式功能與部署 commit 內容。
- 遠端已發布的批次候選、import report、官方快照與其他 generated artifacts。
- 不與本機產品契約或安全設定衝突的前台、後台、資料與腳本修正。

### 衝突處理

- 先產生 merge conflict 清單，再逐檔比較；不得使用整體 `git checkout --ours .` 或 `--theirs .`。
- 不刪除任何本機或遠端檔案；若 Git 將檔案標為 deleted/modified，先保留內容並回報用途。
- merge commit 只負責歷史與功能收斂；版本更新使用後續獨立 commit，方便 review 與回滾。

## 部署範圍

### GitHub Pages

- 平台：原有 `green-tea-king/nearby-good-eats`。
- 來源：`main` branch 根目錄。
- 工具：`scripts/deploy-github-contents.ps1`。
- 部署訊息：`Deploy v2026.07.17.1 local-primary release`。
- 不建立新 repository、Pages site 或其他靜態平台。

### Firebase

- Project ID：`nearby-good-eats`。
- Functions：`api`、`photo`。
- Runtime：Node.js 22、2nd Gen、`us-central1`。
- Rules：`firestore.rules`。
- 不建立新 Firebase project、Hosting site、Functions 名稱或資料庫。

## 版本同步

部署版本固定為 `2026.07.17.1`，同步更新：

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

1. merge `origin/main` 並完成衝突處理與 merge commit。
2. 執行完整測試；失敗即停止，不升版、不部署。
3. 完成版本修改與本機 release commit。
4. 部署 Firebase Functions；失敗即停止。
5. 部署 Firestore Rules；失敗即停止。
6. 部署 GitHub Pages 靜態內容；失敗即停止。
7. 等待 Pages workflow 完成並執行正式站 smoke。

部署命令不得輸出 OAuth token、API key、Secret Manager 值或 App Check secret。不得刪除資料、Functions、Firestore collection、branch 或 Git 歷史。

## 部署後 Git 比較

部署成功後：

1. fetch 最新 `origin/main`，不 merge、不 rebase。
2. 比較本機部署 branch 與 `origin/main` 的 commit ancestry、檔案清單與 blob 內容。
3. 分類為「正式站相同」「本機尚未進 GitHub」「遠端部署腳本額外追蹤」「行尾／產物管理問題」。
4. 提出後續修改建議，重點包含正常 commit/push 部署流程、部署 allowlist、Functions source 納入 Git，以及 generated artifacts 的追蹤政策。

## 完成條件

- 正式站回報版本 `2026.07.17.1`。
- 遠端功能已合併進目前唯一工作資料夾，且 recovery commit 保持可還原。
- `api`、`photo` Functions 為 ACTIVE 且 Node.js 22。
- Firestore Rules 部署成功。
- 正式站 smoke 通過。
- 回報部署 URL、時間、GitHub deployment commit、本機 commit、驗證結果與剩餘風險。
- 不自動 merge、push 本機 branch 或刪除 recovery branch。

# 遠端功能合併與本機優先部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在目前唯一工作資料夾內安全合併 `origin/main` 的遠端功能，完成本機與正式站驗證後，以版本 `2026.07.17.1` 部署至既有 Firebase 與 GitHub Pages，最後量化 Git 落差。

**Architecture:** 保留 `0670033` recovery commit 作為不可變還原點，在 `codex/deploy-local-primary-20260716` 以一般 merge commit 收斂雙方歷史。合併時逐檔保留遠端正式功能與本機較新的安全、Functions、Rules、測試及規範；測試通過後才建立獨立 release commit 並依 Functions、Rules、Pages 順序部署。

**Tech Stack:** Git、原生 HTML/CSS/JavaScript、Node.js assertion scripts、Firebase Functions 2nd Gen Node.js 22、Cloud Firestore Rules、Firebase CLI、GitHub Pages、PowerShell。

## Global Constraints

- 只使用目前專案資料夾；不得建立 worktree、新專案或搬移檔案。
- 不得刪除檔案、資料、branch、Functions、Firestore collection 或 Git 歷史。
- 不得使用 rebase、hard reset、force push、整批 `ours` 或整批 `theirs`。
- Recovery branch `codex/workspace-recovery-20260716` 與 commit `0670033` 保持不動。
- 本機安全設定、Node.js 22、Vertex AI、Firestore Rules、規範與測試優先；不衝突的遠端正式功能與 generated artifacts 必須保留。
- 任一必要測試失敗即停止部署；不得部分發布。
- 部署版本為 `2026.07.17.1`，平台只能是既有 Firebase project `nearby-good-eats` 與 GitHub repository `green-tea-king/nearby-good-eats`。
- 指令輸出不得包含 OAuth token、API key、Secret Manager 值或 App Check secret。

---

### Task 1: 建立可重現的合併基準

**Files:**
- Read: `AGENTS.md`
- Read: `project-rules.md`
- Read: `design.md`
- Read: `VERSION`
- Read: `docs/superpowers/specs/2026-07-16-local-primary-deployment-design.md`

**Interfaces:**
- Consumes: local HEAD `1417b47`、recovery commit `0670033`、remote `origin/main`
- Produces: 已更新且可稽核的 `origin/main` ref、乾淨工作樹、合併前 commit/檔案差異紀錄

- [ ] **Step 1: 確認唯一工作資料夾、branch 與乾淨狀態**

Run:

```powershell
git status --short --branch
git branch --show-current
git rev-parse --show-toplevel
```

Expected: branch 是 `codex/deploy-local-primary-20260716`，除本計畫與日期修正外沒有未預期修改，repository root 是目前專案資料夾。

- [ ] **Step 2: 提交計畫與日期修正**

Run:

```powershell
git add docs/superpowers/specs/2026-07-16-local-primary-deployment-design.md docs/superpowers/plans/2026-07-17-remote-merge-local-primary-deployment-plan.md
git diff --cached --check
git commit -m "docs: plan remote merge and local-primary deployment"
```

Expected: 建立獨立文件 commit，工作樹恢復乾淨。

- [ ] **Step 3: 重新取得遠端並記錄 ancestry**

Run:

```powershell
git fetch --prune origin
git rev-list --left-right --count HEAD...origin/main
git merge-base HEAD origin/main
git log --oneline HEAD..origin/main
```

Expected: `origin/main` 可讀取；輸出遠端獨有 commits 與共同祖先，不改動工作樹。

### Task 2: 在目前資料夾安全合併遠端功能

**Files:**
- Merge candidates: `VERSION`, `admin.html`, `index.html`, `design.md`, `project-rules.md`
- Merge candidates: `assets/app-settings.js`, `assets/auth-logic.js`, `assets/search-logic.js`, `assets/awards-taiwan.json`, `assets/external-source-coverage.json`
- Merge candidates: `assets/500bowl-2026-candidates.json`, `assets/500bowl-2026-google-map.kml`, `assets/500bowl-2026-import-report.json`, `assets/500bowl-2026-merge-report.json`, `assets/core-awards-public-source-report.json`
- Merge candidates: `scripts/build-500bowl-2026-candidates.js`, `scripts/build-core-awards-public-source-report.js`, `scripts/merge-500bowl-2026-awards.js`, `scripts/deploy-github-contents.ps1`, `scripts/scan-ui-text.js`, `scripts/smoke-check.js`, `scripts/smoke-check.ps1`, `scripts/smoke-live-site.ps1`, `scripts/validate-awards-data.js`, `scripts/validate-external-signals.js`, `scripts/validate-external-source-coverage.js`
- Preserve local: `AGENTS.md`, `.gitignore`, `firestore.rules`, `functions/**`, `ops-checklist.md`, `scripts/test-*.js`, `scripts/lib/core-awards-enrichment.js`

**Interfaces:**
- Consumes: clean deployment branch and fetched `origin/main`
- Produces: one reviewed merge commit containing both remote formal functionality and local security/test improvements

- [ ] **Step 1: 開始非 fast-forward、暫不提交的 merge**

Run:

```powershell
git merge --no-ff --no-commit origin/main
git status --short
git diff --name-only --diff-filter=U
```

Expected: Git 進入 merge 狀態；若有衝突，最後一行只列出未合併檔案。

- [ ] **Step 2: 逐檔比較 stage 2 與 stage 3**

對每個衝突檔執行：

```powershell
git show ":2:<path>"
git show ":3:<path>"
git diff --cc -- <path>
```

Expected: 能辨識本機內容、遠端內容與衝突區段；不得輸出或寫入 secrets。

- [ ] **Step 3: 依已核准合併規則解決每個衝突**

Resolution rules:

```text
1. AGENTS/project-rules/design 的產品與維護契約以本機為基底，加入不衝突的遠端正式功能描述。
2. functions、firestore.rules、Node.js 22、安全預設、Vertex AI helper 與測試保留本機版本。
3. index/admin/search/auth 保留遠端正式功能，但不得破壞首次不搜尋、按套用才搜尋、固定三家、下一組不重打搜尋、地區與交通互斥。
4. awards 與 500bowl generated artifacts 保留遠端正式資料，並保留本機來源報告與驗證器要求。
5. modify/delete 衝突一律保留檔案；不得執行刪除。
```

Run after each resolution:

```powershell
git add -- <path>
git diff --name-only --diff-filter=U
```

Expected: 未合併清單逐步縮小至空白。

- [ ] **Step 4: 檢查 merge 結果並建立 merge commit**

Run:

```powershell
git diff --cached --stat
git diff --cached --check
rg -n "^(<<<<<<<|=======|>>>>>>>)" -g "!node_modules/**" -g "!.git/**" .
git status --short
git commit -m "merge: integrate origin main before local-primary deployment"
```

Expected: 沒有未解衝突或 conflict markers；建立一個雙親 merge commit。

### Task 3: 執行完整本機驗證

**Files:**
- Test: `scripts/test-search-logic.js`
- Test: `scripts/test-auth-logic.js`
- Test: `scripts/test-core-awards-enrichment.js`
- Test: `scripts/test-static-asset-versions.js`
- Test: `scripts/scan-ui-text.js`
- Test: `scripts/validate-awards-data.js`
- Test: `scripts/validate-external-signals.js`
- Test: `scripts/validate-external-source-coverage.js`
- Test: `functions/test-key-utils.js`
- Test: `functions/test-summary-utils.js`
- Test: `functions/test-places-field-mask.js`
- Test: `functions/test-ai-classifier.js`

**Interfaces:**
- Consumes: merged local tree
- Produces: deployment gate evidence; any failure blocks Task 4 onward

- [ ] **Step 1: 執行前端、搜尋與資料測試**

Run:

```powershell
node scripts/test-search-logic.js
node scripts/test-auth-logic.js
node scripts/test-core-awards-enrichment.js
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
node scripts/validate-awards-data.js
node scripts/validate-external-signals.js
node scripts/validate-external-source-coverage.js
```

Expected: 所有 scripts exit code 0，UI 掃描無可見亂碼 findings。

- [ ] **Step 2: 執行 Functions 測試與相依風險檢查**

Run:

```powershell
Push-Location functions
node test-key-utils.js
node test-summary-utils.js
node test-places-field-mask.js
node test-ai-classifier.js
npm audit --omit=dev
Pop-Location
```

Expected: 四個單元測試 exit code 0；`npm audit` 的既有 8 個 moderate 風險如實記錄，不執行 `npm audit fix --force`。

- [ ] **Step 3: 執行語法、版本與 Git 完整性檢查**

Run:

```powershell
node --check assets/search-logic.js
node --check assets/auth-logic.js
node --check functions/index.js
node --check functions/ai-classifier.js
git diff --check
git status --short --branch
```

Expected: JavaScript 語法與 Git whitespace 檢查通過，工作樹乾淨。

### Task 4: 建立 `2026.07.17.1` release commit

**Files:**
- Modify: `VERSION`
- Modify: `index.html`
- Modify: `design.md`

**Interfaces:**
- Consumes: verified merged tree at version `2026.07.14.13`
- Produces: synchronized `2026.07.17.1` version sources and one release commit

- [ ] **Step 1: 同步四個版本來源**

Apply these exact replacements:

```text
VERSION: 2026.07.14.13 -> 2026.07.17.1
design.md 文件版本: 2026.07.14.13 -> 2026.07.17.1
design.md 目前正式版本: 2026.07.14.13 -> 2026.07.17.1
index.html APP_VERSION_FALLBACK: 2026.07.14.13 -> 2026.07.17.1
index.html 四個核心 JS query: ?v=2026.07.14.13 -> ?v=2026.07.17.1
```

- [ ] **Step 2: 驗證版本同步**

Run:

```powershell
node scripts/test-static-asset-versions.js
rg -n "2026\.07\.14\.13|2026\.07\.17\.1" VERSION index.html design.md
git diff --check
```

Expected: 版本測試通過，舊版本只可出現在歷史說明而不可留在執行版本來源。

- [ ] **Step 3: 提交 release**

Run:

```powershell
git add VERSION index.html design.md
git commit -m "release: prepare v2026.07.17.1"
git status --short --branch
```

Expected: 建立 release commit 且工作樹乾淨。

### Task 5: 部署既有 Firebase 專案

**Files:**
- Deploy source: `functions/**`
- Deploy rules: `firestore.rules`
- Config: `firebase.json`

**Interfaces:**
- Consumes: verified release commit and current Firebase CLI login
- Produces: ACTIVE Node.js 22 `api`/`photo` functions and deployed Firestore Rules in project `nearby-good-eats`

- [ ] **Step 1: 以不顯示 token 的指令確認登入與專案**

Run:

```powershell
$env:CI='1'
npx --yes firebase-tools projects:list
npx --yes firebase-tools use nearby-good-eats
```

Expected: 清單包含 `nearby-good-eats`，不輸出 credential token。

- [ ] **Step 2: 部署兩個既有 Functions**

Run:

```powershell
$env:CI='1'
npx --yes firebase-tools deploy --project nearby-good-eats --only "functions:api,functions:photo"
```

Expected: `api` 與 `photo` 更新成功；不得建立其他 Function。

- [ ] **Step 3: 部署既有 Firestore Rules**

Run:

```powershell
$env:CI='1'
npx --yes firebase-tools deploy --project nearby-good-eats --only firestore:rules
```

Expected: `firestore.rules` release 成功，不刪除資料。

### Task 6: 部署 GitHub Pages 並執行正式站驗證

**Files:**
- Deploy script: `scripts/deploy-github-contents.ps1`
- Smoke script: `scripts/smoke-live-site.ps1`

**Interfaces:**
- Consumes: release commit `2026.07.17.1`
- Produces: remote Git Data API deployment commit, live Pages version `2026.07.17.1`, smoke evidence

- [ ] **Step 1: 部署到既有 repository 的 `main`**

Run:

```powershell
.\scripts\deploy-github-contents.ps1 -Owner green-tea-king -Repo nearby-good-eats -Branch main -Message "Deploy v2026.07.17.1 local-primary release"
```

Expected: 腳本建立一個遠端 deployment commit，不移動本機 HEAD、不建立新 repository。

- [ ] **Step 2: 等待既有 Pages workflow 完成**

Run:

```powershell
gh run list --repo green-tea-king/nearby-good-eats --limit 5
```

Expected: 對應 deployment commit 的 Pages workflow 為 completed/success；若仍執行中，持續短間隔查詢但不超過 60 秒無回報。

- [ ] **Step 3: 執行正式站 smoke**

Run:

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion 2026.07.17.1
```

Expected: 正式站 URL、VERSION、HTML asset query、基本資源與搜尋契約 smoke 全部通過。

### Task 7: 量化部署後 Git 落差並提出建議

**Files:**
- Read: local Git refs and remote `origin/main`
- Read: deployed static file allowlist from `scripts/deploy-github-contents.ps1`

**Interfaces:**
- Consumes: successful Pages deployment and local release commit
- Produces: ancestry count、檔案內容分類、後續維護優先順序

- [ ] **Step 1: 更新部署後 remote ref 並比較 ancestry**

Run:

```powershell
git fetch --prune origin
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate -5 HEAD
git log --oneline --decorate -5 origin/main
```

Expected: 清楚顯示本機 branch 與遠端 deployment commit 的獨有 commit 數。

- [ ] **Step 2: 比較實際檔案內容**

Run:

```powershell
git diff --name-status HEAD..origin/main
git diff --stat HEAD..origin/main
git diff --check HEAD..origin/main
```

Expected: 可分類哪些檔案內容一致、哪些只在本機、哪些由遠端部署腳本追蹤；不得自動 merge、rebase 或 push 本機 branch。

- [ ] **Step 3: 整理完成回報**

Report exactly:

```text
1. 這次做了什麼
2. 修改了哪些檔案
3. 版本號更新成多少
4. 執行了哪些驗證指令與結果
5. 是否已部署
6. 部署 URL、部署 commit 與部署時間
7. Git ancestry/內容落差、風險與後續建議
8. 尚未驗證或需要使用者處理的事項
```

Expected: 不誇大未執行的人工手機 QA；明確標示 `npm audit` 與任何 Firebase/Pages 限制。

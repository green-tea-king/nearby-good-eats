# Firebase Admin 14 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將既有 Firebase Functions 從 Admin SDK 13 namespace API 安全遷移至 Admin SDK 14 modular API，維持 Auth、App Check、Firestore、HTTP 契約與原部署平台不變。

**Architecture:** 先以來源契約測試建立 RED 證據，再於仍安裝 Admin 13 時完成最小 modular API 改寫並取得 GREEN；之後同步升級 `firebase-admin`、`firebase-functions` 與 lockfile，最後更新正式版本來源並執行完整驗證。部署、push、PR 與 merge 均不在本計畫的自動執行範圍。

**Tech Stack:** Node.js 22、CommonJS、Firebase Functions 2nd Gen、Firebase Admin SDK 14.2.0、firebase-functions 7.3.0、Cloud Firestore、Node.js `assert` scripts、PowerShell。

## Global Constraints

- 只在既有 `nearby-good-eats` 專案與目前 repository 內工作；不得建立新專案、搬移檔案或更換部署平台。
- 工作 branch 固定為 `codex/upgrade-firebase-admin14-20260717`；禁止直接修改 `main`。
- `firebase-admin` 目標為 `14.2.0`，`firebase-functions` 目標為 `7.3.0`。
- Node.js runtime 維持 `22`，`functions/package.json` 維持 `"type": "commonjs"`。
- Functions 名稱 `api`、`photo`、region `us-central1`、timeout、memory、Secret、env、CORS、quota、Firestore collections 與 response contract 全部維持不變。
- 不使用 `npm audit fix --force`，不加入未驗證的跨 major `overrides`。
- 不刪除任何檔案、資料夾、資料、branch 或 Git history；不得執行 force push、hard reset 或 rebase。
- `firebase-debug.log` 保持未追蹤且不得修改、加入 commit 或刪除。
- 實作版本更新為 `2026.07.17.7`，同步 `VERSION`、`design.md`、`index.html` 四個核心 JS query 與 fallback version。
- 本次升級前基底 commit 為 `112238ec5fc41f87460062d194b218d818942e3e`；若後續正式部署失敗，Functions 回滾來源必須是這個已驗證基底或部署前另行確認的最後已驗證 commit，並以重新部署產生新歷史，不改寫 Git history。
- 本計畫完成後只建立本機 commits；push、PR、merge 與正式 Functions／Pages 部署都需後續獨立確認。

## File Map

- Create: `functions/test-admin-sdk-contract.js` — 驗證 modular imports、禁止舊 namespace，並實際載入 Admin modular entry points。
- Modify: `functions/index.js` — 將 Admin SDK 初始化、Auth、App Check、Firestore 與 `FieldValue` 改為 modular API。
- Modify: `functions/package.json` — 將 Admin SDK 與 Functions SDK 升至目標版本，保留 Node 22/CommonJS。
- Modify: `functions/package-lock.json` — 鎖定經 npm 解析的正式 production dependency tree。
- Modify: `VERSION` — 更新正式版本為 `2026.07.17.7`。
- Modify: `index.html` — 同步四個核心靜態 JS query 與 `APP_VERSION_FALLBACK`。
- Modify: `design.md` — 同步版本、SDK 現況與維護狀態。
- Existing verification only: `scripts/*.js`、其他 `functions/test-*.js` — 不修改，僅依最低驗證矩陣執行。

---

### Task 1: 用契約測試驅動 Admin modular API 遷移

**Files:**
- Create: `functions/test-admin-sdk-contract.js`
- Modify: `functions/index.js:1-12`
- Modify: `functions/index.js:147-168`
- Modify: `functions/index.js:248-260`
- Modify: `functions/index.js:548-565`
- Test: `functions/test-admin-sdk-contract.js`

**Interfaces:**
- Consumes: CommonJS entry points `firebase-admin/app`、`firebase-admin/auth`、`firebase-admin/app-check`、`firebase-admin/firestore`。
- Produces: 已初始化的 default app、`db = getFirestore()`，以及 `getAuth()`、`getAppCheck()`、`FieldValue.serverTimestamp()` 呼叫；HTTP exports 與回傳格式不變。

- [ ] **Step 1: 新增會拒絕舊 namespace 的契約測試**

建立 `functions/test-admin-sdk-contract.js`：

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

assert.doesNotMatch(
  source,
  /require\(["']firebase-admin["']\)/,
  "legacy firebase-admin namespace import remains"
);
assert.doesNotMatch(
  source,
  /\badmin\.(?:initializeApp|auth|appCheck|firestore)\b/,
  "legacy firebase-admin namespace call remains"
);

assert.match(source, /require\(["']firebase-admin\/app["']\)/);
assert.match(source, /require\(["']firebase-admin\/auth["']\)/);
assert.match(source, /require\(["']firebase-admin\/app-check["']\)/);
assert.match(source, /require\(["']firebase-admin\/firestore["']\)/);
assert.match(source, /\binitializeApp\(\)/);
assert.match(source, /\bgetFirestore\(\)/);
assert.match(source, /\bgetAuth\(\)\.verifyIdToken\(/);
assert.match(source, /\bgetAppCheck\(\)\.verifyToken\(/);
assert.match(source, /\bFieldValue\.serverTimestamp\(\)/);

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

assert.equal(typeof initializeApp, "function");
assert.equal(typeof getAuth, "function");
assert.equal(typeof getAppCheck, "function");
assert.equal(typeof getFirestore, "function");
assert.equal(typeof FieldValue.serverTimestamp, "function");

console.log("Firebase Admin SDK modular contract tests passed");
```

- [ ] **Step 2: 執行測試並確認 RED 原因正確**

Run:

```powershell
node functions/test-admin-sdk-contract.js
```

Expected: FAIL，訊息包含 `legacy firebase-admin namespace import remains`。若錯在模組不存在、路徑或語法，先修正測試，直到它只因現有 `functions/index.js` 使用 namespace 而失敗。

- [ ] **Step 3: 做最小 modular API 改寫**

將 `functions/index.js` 頂部改為：

```js
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { GoogleAuth } = require("google-auth-library");
const { MAX_ITEMS:AI_MAX_ITEMS, buildVertexRequest, parseVertexResponse } = require("./ai-classifier");
const { sanitizeApiKey, authorizationHeader } = require("./key-utils");
const { localizedText } = require("./summary-utils");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();
```

只替換下列呼叫，不改周邊流程：

```js
return getAuth().verifyIdToken(match[1]);
```

```js
const decoded = await getAppCheck().verifyToken(String(token));
```

三個 timestamp 位置全部使用：

```js
FieldValue.serverTimestamp()
```

- [ ] **Step 4: 執行契約測試與模組載入檢查，確認 GREEN**

Run:

```powershell
node functions/test-admin-sdk-contract.js
node --check functions/index.js
Push-Location functions
node -e "const mod=require('./index.js'); if(!mod.api || !mod.photo) throw new Error('missing Functions exports'); console.log('Functions module load: OK')"
Pop-Location
```

Expected:

```text
Firebase Admin SDK modular contract tests passed
Functions module load: OK
```

`node --check` exit code 必須為 0；載入過程不得出現 exception。

- [ ] **Step 5: 執行既有 Functions 單元測試**

Run:

```powershell
node functions/test-key-utils.js
node functions/test-summary-utils.js
node functions/test-places-field-mask.js
node functions/test-ai-classifier.js
```

Expected: 四支測試全部 exit code 0，分別輸出既有 `tests passed` 訊息。

- [ ] **Step 6: Commit modular API 遷移**

```powershell
git add functions/test-admin-sdk-contract.js functions/index.js
git diff --cached --check
git commit -m "refactor: migrate Firebase Admin calls to modular API"
```

Expected: commit 只包含上述兩個檔案；`firebase-debug.log` 不得 staged。

---

### Task 2: 同步升級 Firebase SDK 相依與 lockfile

**Files:**
- Modify: `functions/package.json`
- Modify: `functions/package-lock.json`
- Test: `functions/test-admin-sdk-contract.js`

**Interfaces:**
- Consumes: Task 1 已完成的 modular Admin API 呼叫。
- Produces: lockfile 中實際解析的 `firebase-admin@14.2.0`、`firebase-functions@7.3.0`，並保留 `google-auth-library@10.9.0`、Node 22、CommonJS。

- [ ] **Step 1: 記錄升級前套件與 audit 基線**

Run:

```powershell
Push-Location functions
npm ls firebase-admin firebase-functions @google-cloud/firestore @google-cloud/storage google-gax gaxios uuid --all
npm audit --omit=dev --json
Pop-Location
```

Expected baseline: Admin 13.10.0、Functions 7.2.5、Firestore 7.11.6；audit 回報目前已知的 `uuid` moderate chain。不可執行 audit fix。

- [ ] **Step 2: 安裝核准版本並更新 lockfile**

Run:

```powershell
Push-Location functions
npm install --save firebase-admin@14.2.0 firebase-functions@7.3.0
Pop-Location
```

Expected: 只修改 `functions/package.json`、`functions/package-lock.json` 與被忽略的 `functions/node_modules`；`package.json` 保留：

```json
{
  "type": "commonjs",
  "engines": {
    "node": "22"
  },
  "dependencies": {
    "firebase-admin": "^14.2.0",
    "firebase-functions": "^7.3.0",
    "google-auth-library": "^10.9.0"
  }
}
```

若 npm 因本機 Node 24 對專案精確 Node 22 engine 顯示 `EBADENGINE` warning，必須再用 Step 4 的 Node 22 runtime 驗證；warning 本身不得當成測試通過。

- [ ] **Step 3: 驗證 peer dependency 與實際解析版本**

Run:

```powershell
Push-Location functions
npm ls firebase-admin firebase-functions @google-cloud/firestore @google-cloud/storage google-gax gaxios uuid --all
Pop-Location
```

Expected:

- `firebase-admin@14.2.0`
- `firebase-functions@7.3.0`
- `firebase-functions` 不得出現 invalid peer dependency
- `@google-cloud/firestore@8.6.0`
- `google-gax@5.x`

若版本不同或 npm 顯示 `invalid`／`ELSPROBLEMS`，停止，不修改 override。

- [ ] **Step 4: 用正式 Node 22 runtime 重跑載入與 Functions 測試**

Run:

```powershell
npx --yes node@22 functions/test-admin-sdk-contract.js
npx --yes node@22 --check functions/index.js
npx --yes node@22 --check functions/ai-classifier.js
Push-Location functions
npx --yes node@22 -e "const mod=require('./index.js'); if(!mod.api || !mod.photo) throw new Error('missing Functions exports'); console.log('Functions module load on Node 22: OK')"
npx --yes node@22 test-key-utils.js
npx --yes node@22 test-summary-utils.js
npx --yes node@22 test-places-field-mask.js
npx --yes node@22 test-ai-classifier.js
Pop-Location
```

Expected: 所有命令 exit code 0；載入訊息為 `Functions module load on Node 22: OK`。

- [ ] **Step 5: 重新執行 audit 並套用明確風險閘門**

Run:

```powershell
Push-Location functions
$auditText = npm audit --omit=dev --json
$audit = $auditText | ConvertFrom-Json
$counts = $audit.metadata.vulnerabilities
$counts | Format-List
if ($counts.high -gt 0 -or $counts.critical -gt 0) {
  throw "Firebase dependency upgrade introduced high or critical vulnerabilities"
}
$audit.vulnerabilities.PSObject.Properties.Name | Sort-Object
Pop-Location
```

Expected gate: high = 0、critical = 0。moderate 若仍存在，只能是已評估的 `uuid`／Storage optional dependency 間接鏈；若出現不同 advisory、直接可達路徑或新的高風險項目，停止並回報，不使用 `--force`。

- [ ] **Step 6: 審查相依 diff 並 commit**

Run:

```powershell
git diff -- functions/package.json functions/package-lock.json
git add functions/package.json functions/package-lock.json
git diff --cached --check
git commit -m "build: upgrade Firebase Functions SDK dependencies"
```

Expected: commit 只包含兩個 package 檔；不得包含 `functions/node_modules` 或 `firebase-debug.log`。

---

### Task 3: 更新版本來源與維護文件

**Files:**
- Modify: `VERSION:1`
- Modify: `index.html:29-32`
- Modify: `index.html:1391`
- Modify: `design.md:3`
- Modify: `design.md:19`
- Modify: `design.md:67`
- Modify: `design.md` 的「後續可優化方向」Firebase Functions 相依項目
- Test: `scripts/test-static-asset-versions.js`

**Interfaces:**
- Consumes: Task 2 已鎖定並通過載入測試的 Admin 14.2.0／Functions 7.3.0。
- Produces: 所有正式版本來源一致為 `2026.07.17.7`，畫面短版號由既有 `shortVersion()` 顯示為 `v07.17.7`。

- [ ] **Step 1: 將所有正式版本來源更新為 2026.07.17.7**

`VERSION` 完整內容：

```text
2026.07.17.7
```

`index.html` 四個核心 script：

```html
<script src="assets/app-settings.js?v=2026.07.17.7"></script>
<script src="assets/filter-rules.js?v=2026.07.17.7"></script>
<script src="assets/search-logic.js?v=2026.07.17.7"></script>
<script src="assets/auth-logic.js?v=2026.07.17.7"></script>
```

fallback：

```js
const APP_VERSION_FALLBACK = "2026.07.17.7";
```

`design.md` 頂部兩個版本改為 `2026.07.17.7`，技術棧後端項目明確寫成：

```markdown
- 後端：Firebase Functions 2nd Gen、Node.js 22、CommonJS、Firebase Admin SDK 14.2.0、firebase-functions 7.3.0。
```

將「規劃 Firebase Functions 相依套件升級」改為已完成狀態：

```markdown
- Firebase Functions 已升級至 Admin SDK 14 modular API 與 firebase-functions 7.3.0；後續持續追蹤官方相依更新，不為消除 audit 警告直接做破壞性 major override。
```

- [ ] **Step 2: 驗證版本同步與舊版號清除**

Run:

```powershell
node scripts/test-static-asset-versions.js
rg -n "2026\.07\.17\.6" VERSION index.html design.md
```

Expected: static asset version test 通過；`rg` exit code 1 且沒有任何舊版號輸出。

- [ ] **Step 3: Commit release metadata**

```powershell
git add VERSION index.html design.md
git diff --cached --check
git commit -m "chore: release v2026.07.17.7"
```

Expected: commit 只包含三個版本與文件檔案。

---

### Task 4: 執行完整驗證並整理交付狀態

**Files:**
- Verify only: 全部已修改檔案與現有測試腳本

**Interfaces:**
- Consumes: Tasks 1-3 的三個獨立 commits。
- Produces: 可供使用者決定是否 push／PR 的本機驗證證據；不部署、不 push、不 merge。

- [ ] **Step 1: 執行前端與資料最低驗證矩陣**

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

Expected: 八個命令全部 exit code 0；文字掃描無可見亂碼 findings，資料 validators 不改寫資料。

- [ ] **Step 2: 用 Node 22 執行完整 Functions 驗證**

Run:

```powershell
Push-Location functions
npx --yes node@22 test-admin-sdk-contract.js
npx --yes node@22 test-key-utils.js
npx --yes node@22 test-summary-utils.js
npx --yes node@22 test-places-field-mask.js
npx --yes node@22 test-ai-classifier.js
npx --yes node@22 --check index.js
npx --yes node@22 --check ai-classifier.js
npx --yes node@22 -e "const mod=require('./index.js'); if(!mod.api || !mod.photo) throw new Error('missing Functions exports'); console.log('Functions module load on Node 22: OK')"
npm ls firebase-admin firebase-functions @google-cloud/firestore @google-cloud/storage google-gax gaxios uuid --all
npm audit --omit=dev
Pop-Location
```

Expected: 測試、語法、載入與 `npm ls` 全部 exit code 0。`npm audit` 若因已評估的 moderate optional dependency 回傳非零，保留完整輸出並依 Task 2 Step 5 判定，不宣稱 audit 通過。

- [ ] **Step 3: 檢查版本、diff 與工作樹範圍**

Run:

```powershell
git diff origin/main...HEAD --check
git diff origin/main...HEAD --name-only
git log --oneline origin/main..HEAD
git status --short --branch
```

Expected changed files only:

```text
VERSION
design.md
docs/superpowers/plans/2026-07-17-firebase-admin14-upgrade-implementation-plan.md
docs/superpowers/specs/2026-07-17-firebase-admin14-upgrade-design.md
functions/index.js
functions/package-lock.json
functions/package.json
functions/test-admin-sdk-contract.js
index.html
```

工作樹只允許既有 `?? firebase-debug.log`；不得有其他未提交修改或未追蹤檔案。

- [ ] **Step 4: 回報而不執行外部變更**

回報內容必須包含：

- branch 與三個實作 commits，加上既有設計／計畫 commits。
- 修改檔案清單與 `2026.07.17.7`。
- 每一項驗證的實際結果，包括 audit 是否仍有 moderate。
- 尚未驗證的有效 Google 登入、App Check、真實 Firestore transaction 與正式部署。
- 後續部署回滾基準與重新部署方式；不得使用 hard reset 或 force push 回滾。
- 是否可進入 push／PR 審查；不得自行 push、開 PR、merge 或部署。

本 Task 不建立新 commit；如果驗證產生檔案或修改 tracked file，先停止並查明原因，不把產物加入 commit。

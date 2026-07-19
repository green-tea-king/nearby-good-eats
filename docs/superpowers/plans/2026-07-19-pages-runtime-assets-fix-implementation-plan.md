# Pages Runtime Assets Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 GitHub Pages artifact 包含前台實際引用的 Logo、認證徽章與村里資料，並新增自動化防漏測試。

**Architecture:** `scripts/pages-files.json` 維持唯一公開 allowlist；`scripts/test-pages-artifact.js` 會掃描 `index.html`、`admin.html`、`firebase-config.js` 與已發布的 `assets/*.js`，擷取 `assets/...` runtime 參照並確認每個檔案都存在且已列入 manifest。修正後 manifest 從 69 檔增加為 72 檔，不改 GitHub Pages workflow 或部署平台。

**Tech Stack:** Node.js 22、CommonJS、GitHub Pages Actions、PowerShell、Git

## Global Constraints

- 只在目前專案資料夾工作，不建立 worktree、不移動檔案。
- 不刪除任何檔案、資料或 branch。
- 不改動 Firebase Functions、Firestore、API 契約或外部資料內容。
- 本次版本固定更新為 `2026.07.19.1`。
- 完成後只 commit、push、建立 PR；不得 merge 或部署。

---

### Task 1: 建立 runtime 資產防漏契約並修正 manifest

**Files:**
- Modify: `scripts/test-pages-artifact.js`
- Modify: `scripts/pages-files.json`

**Interfaces:**
- Consumes: Pages manifest 陣列，以及 `index.html`、`admin.html`、`firebase-config.js`、manifest 內 `assets/*.js` 的文字內容。
- Produces: `collectRuntimeAssetReferences(relativePaths)` 回傳排序後的 `assets/...` 路徑陣列；manifest 包含 72 個公開檔案。

- [ ] **Step 1: 先新增會失敗的 runtime 參照測試**

```js
function collectRuntimeAssetReferences(relativePaths) {
  const references = new Set();
  for (const relativePath of relativePaths) {
    const source = fs.readFileSync(path.join(repoRoot, ...relativePath.split("/")), "utf8");
    for (const match of source.matchAll(/assets\/[A-Za-z0-9._/-]+/g)) {
      references.add(match[0]);
    }
  }
  return [...references].sort();
}

const runtimeSourceFiles = [
  "index.html",
  "admin.html",
  "firebase-config.js",
  ...manifest.filter((entry) => /^assets\/.*\.js$/.test(entry))
];
const runtimeAssetReferences = collectRuntimeAssetReferences(runtimeSourceFiles);
const missingRuntimeFiles = runtimeAssetReferences.filter((entry) => (
  !fs.existsSync(path.join(repoRoot, ...entry.split("/")))
));
assert.deepStrictEqual(missingRuntimeFiles, [], "runtime 資產在 repository 中不存在");
const missingRuntimeManifestEntries = runtimeAssetReferences.filter((entry) => !manifest.includes(entry));
assert.deepStrictEqual(
  missingRuntimeManifestEntries,
  [],
  "Pages manifest 缺少 runtime 資產: " + missingRuntimeManifestEntries.join(", ")
);
```

- [ ] **Step 2: 執行測試並確認 RED**

Run: `node scripts/test-pages-artifact.js`

Expected: FAIL，訊息列出 `assets/certification-badges.json`、`assets/local-food-rank-logo.png`、`assets/taiwan-villages.json`。

- [ ] **Step 3: 將三個 runtime 資產加入 manifest 並更新 allowlist 契約**

在 `assets/app-settings.js` 後加入：

```json
  "assets/local-food-rank-logo.png",
  "assets/certification-badges.json",
  "assets/taiwan-villages.json",
```

並把 `scripts/test-pages-artifact.js` 的固定數量改為 `72`、SHA-256 改為：

```text
f6af8c0cd640e001fdd385878ff2461a8292bfc37c629c22a1cdf43d69df0db4
```

- [ ] **Step 4: 執行測試並確認 GREEN**

Run: `node scripts/test-pages-artifact.js`

Expected: PASS，顯示 `Pages artifact 72 files verified`。

- [ ] **Step 5: Commit manifest 修正**

```powershell
git add scripts/pages-files.json scripts/test-pages-artifact.js
git commit -m "fix: publish required Pages runtime assets"
```

### Task 2: 更新版本來源

**Files:**
- Modify: `VERSION`
- Modify: `design.md`
- Modify: `index.html`

**Interfaces:**
- Consumes: 版本格式 `YYYY.MM.DD.N`。
- Produces: 所有正式版本來源一致為 `2026.07.19.1`，畫面短版號由既有 `shortVersion()` 顯示為 `v07.19.1`。

- [ ] **Step 1: 更新正式版本來源**

將 `VERSION`、`design.md` 頂部兩個版本、`index.html` 四個核心 JS query 與 `APP_VERSION_FALLBACK` 更新為 `2026.07.19.1`。

- [ ] **Step 2: 驗證版本契約**

Run: `node scripts/test-static-asset-versions.js`

Expected: `static asset version tests passed`

- [ ] **Step 3: Commit 版本更新與實作計畫**

```powershell
git add VERSION design.md index.html docs/superpowers/plans/2026-07-19-pages-runtime-assets-fix-implementation-plan.md
git commit -m "chore: release v2026.07.19.1"
```

### Task 3: 完整驗證並建立 PR

**Files:**
- Verify only: 全部修改檔案與建置產物

**Interfaces:**
- Consumes: 已完成的 72-file manifest 與版本 `2026.07.19.1`。
- Produces: 可審查的 GitHub Pull Request；不 merge、不部署。

- [ ] **Step 1: 執行 Pages 與最低驗證矩陣**

```powershell
node scripts/test-pages-artifact.js
node scripts/test-pages-workflow-contract.js
node scripts/test-search-logic.js
node scripts/test-auth-logic.js
node scripts/test-core-awards-enrichment.js
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
node scripts/validate-awards-data.js
node scripts/validate-external-signals.js
node scripts/validate-external-source-coverage.js

Push-Location functions
node test-key-utils.js
node test-summary-utils.js
node test-places-field-mask.js
node test-ai-classifier.js
npm audit --omit=dev
Pop-Location

git diff --check
```

Expected: 功能測試 exit 0、UI findings 為 0；`npm audit` 若仍回報既有 7 個 moderate 間接相依風險，須如實記錄且不得使用破壞性的 `--force` 修復。

- [ ] **Step 2: 確認 artifact 實際包含三個 runtime 資產**

Run:

```powershell
$artifact = Join-Path ([IO.Path]::GetTempPath()) ("nearby-good-eats-pages-" + [guid]::NewGuid().ToString("N"))
node scripts/build-pages-artifact.js $artifact
```

Expected: JSON 中 `manifestCount` 與 `copiedCount` 都是 `72`，三個檔案均出現在 `files`。

- [ ] **Step 3: 推送分支並建立 PR**

```powershell
git push -u origin codex/fix-pages-runtime-assets-20260719
gh pr create --base main --head codex/fix-pages-runtime-assets-20260719
```

Expected: PR build 啟動；不執行 merge 或 deploy。

## Self-Review

- Spec coverage: 三個 404 資產、一般化防漏測試、版本更新、Pages 專屬驗證、PR 邊界均有對應步驟。
- Placeholder scan: 無 `TBD`、`TODO` 或未定義實作步驟。
- Type consistency: manifest 路徑一律使用 `/`，測試函式輸入與輸出皆為字串陣列。

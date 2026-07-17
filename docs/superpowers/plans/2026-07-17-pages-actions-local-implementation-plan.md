# GitHub Pages Actions Local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改平台、不部署、不合併 `main` 的前提下，建立單一 Pages 公開檔案清單、可重現的靜態 artifact 建置、GitHub Pages Actions 工作流程，以及只負責觸發與監看工作流程的部署包裝器。

**Architecture:** `main` 最終保存完整原始碼，但 GitHub Pages 只發布 `scripts/pages-files.json` 明列的檔案。Node.js 建置器驗證清單、複製檔案並逐檔校驗 SHA-256；GitHub Actions 對 PR 只建置，對 `main` push、手動觸發與外部訊號工作流程成功事件才部署。現有 PowerShell 部署腳本不再直接寫 Git blobs、trees、commits 或 refs，只觸發並監看既有 repository 的工作流程。

**Tech Stack:** Node.js 22、PowerShell、GitHub Actions、GitHub CLI、GitHub Pages、原生 Node `fs`／`path`／`crypto`。

## Global Constraints

- 只在目前專案資料夾與工作 branch `codex/deploy-local-primary-20260716` 內工作，不建立新專案、不建立 worktree、不搬移檔案。
- 不刪除任何既有檔案、資料夾或資料；`firebase-debug.log` 必須保持未追蹤且不碰觸。
- 本計畫完成後不 merge、不 push、不建立 PR、不切換 Pages、不部署。
- 不新增或大量更新 dependency。
- 沿用原 GitHub repository、Firebase project 與正式 URL `https://green-tea-king.github.io/nearby-good-eats/`。
- artifact 禁止包含 `functions/`、`.github/`、`docs/`、`experiment/`、`AGENTS.md`、Firebase 部署設定、lockfile、環境檔、log 或憑證；既有公開檔 `design.md` 與 `project-rules.md` 保持在 69-file manifest。
- 正式版號目標是 `2026.07.17.3`，同步 `VERSION`、`index.html`、`design.md` 與 `AGENTS.md`。
- 新行為先寫失敗測試；未執行的驗證不可宣稱通過。

---

## File Responsibility Map

- Create `scripts/pages-files.json`：唯一 Pages 公開檔案 allowlist。
- Create `scripts/build-pages-artifact.js`：驗證 manifest、複製並校驗檔案。
- Create `scripts/test-pages-artifact.js`：測試 manifest、artifact 與禁止路徑。
- Create `.github/workflows/deploy-pages.yml`：PR 建置與 Pages artifact 部署。
- Create `scripts/test-pages-workflow-contract.js`：驗證 workflow 與部署包裝器契約。
- Modify `scripts/deploy-github-contents.ps1`：改成 dispatch 與監看 Actions。
- Modify `VERSION`、`index.html`、`design.md`、`AGENTS.md`：同步版號與永久規範。

### Task 1: Single Pages Manifest and Reproducible Artifact Builder

**Files:**
- Create: `scripts/test-pages-artifact.js`
- Create: `scripts/pages-files.json`
- Create: `scripts/build-pages-artifact.js`

**Interfaces:**
- Consumes: repository root、manifest JSON array、空白或不存在的輸出目錄。
- Produces: `validateManifest(files, repoRoot): string[]` 與 `buildArtifact({ repoRoot, manifestPath, outputDir, copyFile }): { manifestCount, copiedCount, entryFile, version, outputPath, files }`。

- [ ] **Step 1: Write the failing test**

Create `scripts/test-pages-artifact.js`:

~~~javascript
"use strict";
const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "pages-files.json");
const { buildArtifact, isTracked, validateManifest } = require("./build-pages-artifact");

function listFiles(root, current = "") {
  return fs.readdirSync(path.join(root, current), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(current.replaceAll("\\", "/"), entry.name);
      return entry.isDirectory() ? listFiles(root, relative) : [relative];
    })
    .sort();
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.strictEqual(manifest.length, 69);
assert.strictEqual(new Set(manifest).size, manifest.length);
assert.strictEqual(
  crypto.createHash("sha256").update(manifest.join("\n")).digest("hex"),
  "6792d9d3f2814b110de12120359239eb5b5985e262402ab6eb2c14701469beed",
  "manifest 必須精確維持切換前 69-file allowlist 與順序"
);
for (const required of [
  "index.html", "admin.html", ".nojekyll", "VERSION", "design.md", "project-rules.md",
  "assets/app-settings.js", "assets/filter-rules.js", "assets/search-logic.js",
  "assets/auth-logic.js", "scripts/smoke-live-site.ps1"
]) {
  assert(manifest.includes(required), "manifest 缺少 " + required);
}
for (const forbidden of [
  "AGENTS.md", "firebase.json", "firestore.rules", "functions/index.js",
  ".github/workflows/deploy-pages.yml", "firebase-debug.log"
]) {
  assert(!manifest.includes(forbidden), "manifest 不得包含 " + forbidden);
}

assert.throws(() => validateManifest([...manifest, manifest[0]], repoRoot), /重複/);
assert.throws(() => validateManifest(["../secret.txt"], repoRoot), /不安全/);
assert.throws(() => validateManifest(["functions/index.js"], repoRoot), /禁止發布/);
assert.throws(() => validateManifest(["assets\\search-logic.js"], repoRoot), /斜線/);
assert.throws(() => validateManifest(["missing-file.txt"], repoRoot), /找不到/);
assert.strictEqual(isTracked(repoRoot, "firebase-debug.log"), false);
childProcess.execFileSync(
  process.execPath,
  [path.join(__dirname, "test-static-asset-versions.js")],
  { cwd: repoRoot, stdio: "pipe" }
);
const canonicalVersion = fs.readFileSync(path.join(repoRoot, "VERSION"), "utf8").trim();
const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
assert(
  indexHtml.includes('const APP_VERSION_FALLBACK = "' + canonicalVersion + '";'),
  "APP_VERSION_FALLBACK 必須等於 VERSION"
);

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "nearby-good-eats-pages-"));
const result = buildArtifact({ repoRoot, manifestPath, outputDir });
assert.strictEqual(result.manifestCount, manifest.length);
assert.strictEqual(result.copiedCount, manifest.length);
assert.strictEqual(result.entryFile, "index.html");
assert.strictEqual(result.version, canonicalVersion);
assert.strictEqual(result.outputPath, outputDir);
assert.deepStrictEqual(listFiles(outputDir), [...manifest].sort());
for (const file of result.files) assert.match(file.sha256, /^[a-f0-9]{64}$/);
assert(!fs.existsSync(path.join(outputDir, "functions")));
assert(!fs.existsSync(path.join(outputDir, ".github")));
assert(!fs.existsSync(path.join(outputDir, "AGENTS.md")));

const nonEmptyOutput = fs.mkdtempSync(path.join(os.tmpdir(), "nearby-good-eats-pages-nonempty-"));
fs.writeFileSync(path.join(nonEmptyOutput, "unexpected.txt"), "unexpected");
assert.throws(
  () => buildArtifact({ repoRoot, manifestPath, outputDir: nonEmptyOutput }),
  /必須不存在或為空/
);

const corruptedOutput = fs.mkdtempSync(path.join(os.tmpdir(), "nearby-good-eats-pages-corrupt-"));
assert.throws(
  () => buildArtifact({
    repoRoot,
    manifestPath,
    outputDir: corruptedOutput,
    copyFile(source, target) {
      fs.copyFileSync(source, target);
      if (path.basename(target) === "index.html") fs.appendFileSync(target, "corrupted");
    }
  }),
  /SHA-256 不一致/
);
console.log("PASS: Pages artifact " + result.copiedCount + " files verified at " + outputDir);
~~~

- [ ] **Step 2: Run RED test**

Run: `node scripts/test-pages-artifact.js`

Expected: FAIL with `Cannot find module './build-pages-artifact'`.

- [ ] **Step 3: Add the exact 69-file manifest**

Create `scripts/pages-files.json`:

```json
[
  "index.html",
  "admin.html",
  ".nojekyll",
  "VERSION",
  "design.md",
  "project-rules.md",
  "firebase-config.js",
  "assets/app-settings.js",
  "assets/awards-taiwan.json",
  "assets/500bowl-2025-candidates.json",
  "assets/500bowl-2025-import-report.json",
  "assets/500bowl-2025-merge-report.json",
  "assets/500bowl-2026-candidates.json",
  "assets/500bowl-2026-google-map.kml",
  "assets/500bowl-2026-import-report.json",
  "assets/500bowl-2026-merge-report.json",
  "assets/500sweet-2025-source-report.json",
  "assets/500sweet-2025-manual.json",
  "assets/500sweet-2025-candidates.json",
  "assets/500sweet-2025-import-report.json",
  "assets/500sweet-2025-merge-report.json",
  "assets/awards-taiwan.500bowl-2025-draft.json",
  "assets/awards-taiwan.500sweet-2025-draft.json",
  "assets/awards-taiwan.michelin-selected-2025-draft.json",
  "assets/michelin-selected-2025-merge-report.json",
  "assets/external-signals.json",
  "assets/external-source-coverage.json",
  "assets/filter-rules.js",
  "assets/search-logic.js",
  "assets/auth-logic.js",
  "assets/platform-source-probe-report.json",
  "assets/platform-signals.manual.json",
  "assets/platform-signals.import.csv",
  "assets/social-signal-config.json",
  "assets/michelin-taiwan-2025-official-candidates.json",
  "assets/michelin-taiwan-2025-official-report.json",
  "assets/michelin-taiwan-2025-official-import-report.json",
  "assets/awards-taiwan.michelin-taiwan-2025-official-draft.json",
  "assets/michelin-taipei-2025-candidates.json",
  "assets/michelin-taipei-2025-import-report.json",
  "assets/awards-taiwan.michelin-2025-draft.json",
  "assets/core-awards-public-source-report.json",
  "scripts/build-michelin-taiwan-2025-official.js",
  "scripts/build-500bowl-2025-candidates.js",
  "scripts/build-500bowl-2026-candidates.js",
  "scripts/merge-500bowl-2025-awards.js",
  "scripts/merge-500bowl-2026-awards.js",
  "scripts/merge-500sweet-2025-awards.js",
  "scripts/build-500sweet-2025-candidates.js",
  "scripts/merge-michelin-selected-2025-awards.js",
  "scripts/merge-platform-signals.js",
  "scripts/import-platform-signals-csv.js",
  "scripts/probe-platform-sources.js",
  "scripts/probe-500sweet-2025-source.js",
  "scripts/review-michelin-taiwan-2025-official-import.js",
  "scripts/validate-awards-data.js",
  "scripts/validate-external-signals.js",
  "scripts/build-external-source-coverage.js",
  "scripts/build-core-awards-public-source-report.js",
  "scripts/validate-external-source-coverage.js",
  "scripts/scan-ui-text.js",
  "scripts/smoke-check.js",
  "scripts/smoke-check.ps1",
  "scripts/smoke-live-site.ps1",
  "scripts/build-michelin-taipei-candidates.js",
  "scripts/review-michelin-award-import.js",
  "scripts/github-api-retry.ps1",
  "scripts/test-github-api-retry.ps1",
  "scripts/deploy-github-contents.ps1"
]
```

- [ ] **Step 4: Implement the builder**

Create `scripts/build-pages-artifact.js`:

~~~javascript
"use strict";
const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const BLOCKED_EXACT = new Set([
  "AGENTS.md", "agent.md", "firebase.json", "firestore.rules",
  "firebase-debug.log", "package.json", "package-lock.json", ".env"
]);
const BLOCKED_PREFIXES = [
  ".git/", ".github/", "docs/", "experiment/", "functions/", "node_modules/",
  "dist/", "build/", "cache/", "logs/"
];
const BLOCKED_NAMES = /(^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|log)|(?:service-account|credentials?|token)(?:[-_.].*)?\.json)$/i;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isTracked(repoRoot, entry) {
  try {
    childProcess.execFileSync(
      "git",
      ["-c", "safe.directory=" + repoRoot, "ls-files", "--error-unmatch", "--", entry],
      { cwd: repoRoot, stdio: "ignore" }
    );
    return true;
  } catch {
    return false;
  }
}

function validateManifest(files, repoRoot) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Pages manifest 必須是非空陣列");
  }
  const seen = new Set();
  return files.map((entry) => {
    if (typeof entry !== "string" || entry.length === 0 || entry !== entry.trim()) {
      throw new Error("Pages manifest 路徑格式錯誤");
    }
    if (entry.includes("\\")) {
      throw new Error("Pages manifest 必須使用 / 斜線: " + entry);
    }
    if (
      path.posix.isAbsolute(entry) ||
      /^[A-Za-z]:/.test(entry) ||
      path.posix.normalize(entry) !== entry ||
      entry === "." ||
      entry.startsWith("../")
    ) {
      throw new Error("Pages manifest 含不安全路徑: " + entry);
    }
    if (seen.has(entry)) {
      throw new Error("Pages manifest 含重複路徑: " + entry);
    }
    if (
      BLOCKED_EXACT.has(entry) ||
      BLOCKED_PREFIXES.some((prefix) => entry.startsWith(prefix)) ||
      BLOCKED_NAMES.test(entry)
    ) {
      throw new Error("Pages manifest 禁止發布: " + entry);
    }
    const source = path.resolve(repoRoot, ...entry.split("/"));
    if (!isInside(repoRoot, source) || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error("Pages manifest 找不到一般檔案: " + entry);
    }
    if (!isTracked(repoRoot, entry)) {
      throw new Error("Pages manifest 禁止未追蹤檔案: " + entry);
    }
    seen.add(entry);
    return entry;
  });
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function buildArtifact({
  repoRoot = path.resolve(__dirname, ".."),
  manifestPath = path.join(__dirname, "pages-files.json"),
  outputDir,
  copyFile = fs.copyFileSync
} = {}) {
  if (!outputDir) throw new Error("必須提供 outputDir");
  const resolvedRepo = path.resolve(repoRoot);
  const resolvedOutput = path.resolve(outputDir);
  if (resolvedOutput === resolvedRepo || isInside(resolvedRepo, resolvedOutput)) {
    throw new Error("artifact 輸出目錄不可位於 repository 內");
  }
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length !== 0) {
    throw new Error("artifact 輸出目錄必須不存在或為空");
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = validateManifest(manifest, resolvedRepo).map((relativePath) => {
    const source = path.join(resolvedRepo, ...relativePath.split("/"));
    const target = path.join(resolvedOutput, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    copyFile(source, target);
    const sourceHash = sha256(source);
    const targetHash = sha256(target);
    if (sourceHash !== targetHash) {
      throw new Error("artifact SHA-256 不一致: " + relativePath);
    }
    return { path: relativePath, sha256: targetHash };
  });

  return {
    manifestCount: manifest.length,
    copiedCount: files.length,
    entryFile: "index.html",
    version: fs.readFileSync(path.join(resolvedRepo, "VERSION"), "utf8").trim(),
    outputPath: resolvedOutput,
    files
  };
}

if (require.main === module) {
  const result = buildArtifact({ outputDir: process.argv[2] });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
module.exports = { buildArtifact, isTracked, validateManifest };
~~~

- [ ] **Step 5: Verify GREEN**

Run: `node scripts/test-pages-artifact.js`

Expected: exit 0 and `PASS: Pages artifact 69 files verified at ...`. Preserve the printed temporary directory.

- [ ] **Step 6: Prove manifest parity with the current script**

```powershell
$script = Get-Content -Encoding UTF8 scripts/deploy-github-contents.ps1 -Raw
$block = [regex]::Match($script, '(?s)\$Files\s*=\s*@\((.*?)\)\s*\r?\n').Groups[1].Value
$old = [regex]::Matches($block, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
$new = Get-Content -Encoding UTF8 scripts/pages-files.json -Raw | ConvertFrom-Json
[pscustomobject]@{
  OldCount = @($old).Count
  NewCount = @($new).Count
  MissingFromManifest = @($old | Where-Object { $_ -notin $new })
  UnexpectedInManifest = @($new | Where-Object { $_ -notin $old })
}
```

Expected: both counts are 69 and both difference arrays are empty.

- [ ] **Step 7: Commit**

```powershell
git add scripts/test-pages-artifact.js scripts/pages-files.json scripts/build-pages-artifact.js
git commit -m "build: add reproducible Pages artifact"
```

### Task 2: GitHub Pages Actions Workflow Contract

**Files:**
- Create: `scripts/test-pages-workflow-contract.js`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `node scripts/test-pages-artifact.js` and an invocation such as `node scripts/build-pages-artifact.js C:\Temp\nearby-good-eats-pages`.
- Produces: workflow `Deploy GitHub Pages`; PR only builds, while allowed non-PR events may deploy.

- [ ] **Step 1: Reconfirm official Pages action major versions**

Open the official GitHub Pages documentation:

- `https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site`
- `https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`

Expected: official Pages examples still support `actions/checkout@v6`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4` and `actions/deploy-pages@v4`; the official `actions/setup-node` repository currently documents `actions/setup-node@v7`. If an official major changes again, stop and update the approved design or plan before implementation.

- [ ] **Step 2: Write the failing workflow test**

Create `scripts/test-pages-workflow-contract.js`:

~~~javascript
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-pages.yml");
assert(fs.existsSync(workflowPath), "缺少 .github/workflows/deploy-pages.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

for (const token of [
  "pull_request:",
  "push:",
  "workflow_dispatch:",
  "workflow_run:",
  'workflows: ["Update external social signals"]',
  "actions/checkout@v6",
  "actions/setup-node@v7",
  "actions/configure-pages@v5",
  "actions/upload-pages-artifact@v4",
  "actions/deploy-pages@v4",
  "node-version: 22",
  "node scripts/test-pages-artifact.js",
  "node scripts/build-pages-artifact.js",
  "pages: write",
  "id-token: write",
  "name: github-pages"
]) {
  assert(workflow.includes(token), "workflow 缺少契約: " + token);
}

assert.match(workflow, /deploy:\s*[\s\S]*if:\s*>-[\s\S]*github\.event_name != 'pull_request'/);
assert.match(workflow, /Checkout workflow run result[\s\S]*github\.event_name == 'workflow_run'[\s\S]*ref:\s*main/);
assert.match(workflow, /Checkout source[\s\S]*github\.event_name != 'workflow_run'/);
assert.strictEqual((workflow.match(/github\.ref == 'refs\/heads\/main'/g) || []).length, 2);
console.log("PASS: GitHub Pages workflow contract verified");
~~~

- [ ] **Step 3: Run RED test**

Run: `node scripts/test-pages-workflow-contract.js`

Expected: FAIL with `缺少 .github/workflows/deploy-pages.yml`.

- [ ] **Step 4: Add the workflow**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      reason:
        description: Deployment reason
        required: false
        default: Manual deployment
  workflow_run:
    workflows: ["Update external social signals"]
    types: [completed]

permissions:
  contents: read

concurrency:
  group: github-pages
  cancel-in-progress: false

jobs:
  build:
    if: >-
      github.event_name == 'pull_request' ||
      github.event_name == 'push' ||
      (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main') ||
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout workflow run result
        if: github.event_name == 'workflow_run'
        uses: actions/checkout@v6
        with:
          ref: main
      - name: Checkout source
        if: github.event_name != 'workflow_run'
        uses: actions/checkout@v6
      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Verify Pages artifact contract
        run: node scripts/test-pages-artifact.js
      - name: Build Pages artifact
        run: node scripts/build-pages-artifact.js "${{ runner.temp }}/nearby-good-eats-pages"
      - name: Configure GitHub Pages
        uses: actions/configure-pages@v5
      - name: Upload GitHub Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: "${{ runner.temp }}/nearby-good-eats-pages"

  deploy:
    if: >-
      github.event_name != 'pull_request' &&
      (github.event_name != 'workflow_dispatch' || github.ref == 'refs/heads/main') &&
      (github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success')
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node scripts/test-pages-workflow-contract.js
git diff --check
git add scripts/test-pages-workflow-contract.js .github/workflows/deploy-pages.yml
git commit -m "ci: add Pages artifact workflow"
```

Expected: test prints PASS, whitespace check exits 0, and the commit contains only the two named files.

### Task 3: Workflow-Only Deployment Wrapper

**Files:**
- Modify: `scripts/test-pages-workflow-contract.js`
- Modify: `scripts/deploy-github-contents.ps1`
- Modify: `scripts/test-github-api-retry.ps1`

**Interfaces:**
- Consumes: `Owner`, `Repo`, `Branch`, `Message`, read-only retry/poll/timeout parameters and authenticated `gh`.
- Produces: dispatch and watched run for `deploy-pages.yml`; JSON-shaped PowerShell object with repository, branch, version, run ID, status, conclusion, URL and head SHA.
- Safety: GitHub 查詢可以有限重試；`workflow_dispatch` 是可能產生重複部署的 mutation，只能送出一次，再依 CLI 回傳 URL 或 commit SHA 尋找該次 run。

- [ ] **Step 1: Add the failing wrapper contract**

Insert before the final `console.log` in `scripts/test-pages-workflow-contract.js`:

```javascript
const deployScriptPath = path.join(repoRoot, "scripts", "deploy-github-contents.ps1");
const deployScript = fs.readFileSync(deployScriptPath, "utf8");
assert.match(deployScript, /gh workflow run deploy-pages\.yml/);
assert.match(deployScript, /gh run watch/);
assert.match(deployScript, /Deployment target must be green-tea-king\/nearby-good-eats main/);
assert.match(deployScript, /Pages build_type must be workflow before dispatch/);
assert.match(deployScript, /pagesUrl = \$pages\.html_url/i);
assert.match(deployScript, /Invoke-GhCommandOnce -Label "workflow\/dispatch"[\s\S]{0,400}gh workflow run deploy-pages\.yml/);
assert.doesNotMatch(deployScript, /\/git\/(?:blobs|trees|commits|refs)/);
assert.doesNotMatch(deployScript, /\$Files\s*=\s*@\(/);
```

- [ ] **Step 2: Run RED test**

Run: `node scripts/test-pages-workflow-contract.js`

Expected: FAIL because the current script still writes Git Data API and has no workflow dispatch.

- [ ] **Step 3: Replace the deployment script**

Refactor `scripts/deploy-github-contents.ps1` to satisfy all of these contracts:

- Reject every deployment target except `green-tea-king/nearby-good-eats` branch `main`.
- Reuse `github-api-retry.ps1` only for read-only `gh` commands, using bounded exponential delays.
- Verify authenticated repository、default branch、remote `main` SHA、remote/local `VERSION`、Pages URL and `build_type=workflow` before dispatch.
- Call `gh workflow run deploy-pages.yml` exactly once through `Invoke-GhCommandOnce`; never place dispatch inside a retry helper.
- Prefer the run URL returned by `gh workflow run`; if unavailable, locate the matching `workflow_dispatch` run by remote SHA and dispatch timestamp.
- Watch the selected run with `gh run watch --exit-status`, then verify its final head SHA and return compact JSON metadata.
- Remove the 69-file `$Files` array and every Git Data API write to blobs、trees、commits or refs.
- Update `scripts/test-github-api-retry.ps1` so it checks the read-only retry/single-attempt dispatch boundary instead of the removed allowlist.

- [ ] **Step 4: Verify without dispatching**

```powershell
node scripts/test-pages-workflow-contract.js
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path scripts/deploy-github-contents.ps1), [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count -ne 0) { throw ($errors | Out-String) }
```

Expected: test passes and PowerShell parser has zero errors. Do not execute the wrapper during this phase.

- [ ] **Step 5: Commit**

```powershell
git add scripts/test-pages-workflow-contract.js scripts/deploy-github-contents.ps1 scripts/test-github-api-retry.ps1 docs/superpowers/plans/2026-07-17-pages-actions-local-implementation-plan.md
git commit -m "build: route Pages deploys through Actions"
```

### Task 4: Version and Permanent Maintenance Documentation

**Files:**
- Modify: `VERSION`
- Modify: `index.html`
- Modify: `design.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Tasks 1–3 contracts.
- Produces: version `2026.07.17.3` and durable source/artifact/deployment rules.

- [ ] **Step 1: Change the canonical version**

Replace `VERSION` contents with:

```text
2026.07.17.3
```

- [ ] **Step 2: Update HTML version bindings**

In `index.html`, replace every exact `2026.07.17.2` with `2026.07.17.3` and visible `v07.17.2` with `v07.17.3`.

Run: `node scripts/test-static-asset-versions.js`

Expected: PASS with canonical version `2026.07.17.3`.

- [ ] **Step 3: Add the architecture rule to design.md**

Add under the GitHub Pages deployment section:

```markdown
### GitHub source 與 Pages artifact

- `main` 是完整原始碼的唯一 Git source of truth；不得再用 Git Data API 把公開檔案直接覆寫到 `main`。
- `scripts/pages-files.json` 是正式站唯一公開檔案清單；新增公開檔案時必須同步更新 manifest 與測試。
- `scripts/build-pages-artifact.js` 只能建置到 repository 外的空目錄，並逐檔驗證 SHA-256。
- `.github/workflows/deploy-pages.yml` 對 pull request 只建置；只有 `main` push、`main` 手動 dispatch 或外部訊號 workflow 成功才可部署。
- `scripts/deploy-github-contents.ps1` 只觸發與監看 Actions，不得建立 Git blob、tree、commit 或更新 ref。
- Pages 沿用原 repository 與 `https://green-tea-king.github.io/nearby-good-eats/`。
```

- [ ] **Step 4: Add permanent agent rules**

Add to the matching `AGENTS.md` sections:

```markdown
- 開始 GitHub Pages 工作前，必須讀 `scripts/pages-files.json` 與 `.github/workflows/deploy-pages.yml`。
- `main` 保存完整 source；正式站只發布 manifest 允許的 artifact。不得用 Git Data API 直接產生或覆寫 `main` commit。
- 修改 Pages manifest、artifact builder、workflow 或部署包裝器時，必須執行 `node scripts/test-pages-artifact.js` 與 `node scripts/test-pages-workflow-contract.js`。
- 正式部署前必須確認 Pages API `build_type` 為 `workflow`、遠端 `main` 的 `VERSION` 等於本機版本，並取得使用者部署確認。
```

- [ ] **Step 5: Verify and commit**

```powershell
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
git diff -- VERSION index.html design.md AGENTS.md
git diff --check
git add VERSION index.html design.md AGENTS.md
git commit -m "release: prepare 2026.07.17.3 Pages workflow"
```

Expected: both Node checks and whitespace check pass; commit contains only the four named files.

### Task 5: Full Local Release Verification and Handoff Gate

**Files:**
- Verify only; no production edits.

**Interfaces:**
- Consumes: all local implementation commits.
- Produces: evidence that the branch is ready for the separate cutover plan; no external state change.

- [ ] **Step 1: Run new contract tests**

```powershell
node scripts/test-pages-artifact.js
node scripts/test-pages-workflow-contract.js
.\scripts\test-github-api-retry.ps1
```

Expected: all pass.

- [ ] **Step 2: Run frontend/static validation**

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

Expected: all exit 0.

- [ ] **Step 3: Run Functions validation and audit**

```powershell
Push-Location functions
node test-key-utils.js
node test-summary-utils.js
node test-places-field-mask.js
node test-ai-classifier.js
npm audit --omit=dev
Pop-Location
```

Expected: four tests pass. Record the actual audit result; never run `npm audit fix --force`. The previously observed 9 moderate transitive findings are context only.

- [ ] **Step 4: Build and compare the artifact**

```powershell
$artifact = Join-Path ([IO.Path]::GetTempPath()) ("nearby-good-eats-pages-" + [guid]::NewGuid().ToString("N"))
node scripts/build-pages-artifact.js $artifact
$actual = Get-ChildItem -LiteralPath $artifact -Recurse -File |
  ForEach-Object { $_.FullName.Substring($artifact.Length + 1).Replace("\", "/") } |
  Sort-Object
$expected = Get-Content -Encoding UTF8 scripts/pages-files.json -Raw | ConvertFrom-Json | Sort-Object
Compare-Object $expected $actual
Write-Output "ArtifactCount=$($actual.Count)"
Write-Output "ArtifactPath=$artifact"
```

Expected: no comparison difference, count 69. Preserve and report the temporary directory; do not delete it.

- [ ] **Step 5: Scan for secret-like content**

```powershell
$patterns = '(?i)(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[0-9A-Za-z]{20,}|sk-[0-9A-Za-z]{20,})'
$trackedHits = git grep -n -I -E $patterns -- . ':!firebase-config.js' ':!assets/app-settings.js'
$artifactHits = Get-ChildItem -LiteralPath $artifact -Recurse -File | Select-String -Pattern $patterns
if ($trackedHits) { $trackedHits }
if ($artifactHits) { $artifactHits }
```

Expected: no private key, GitHub token or OpenAI-style secret. Public referrer-restricted Google browser keys are reviewed against their restrictions.

- [ ] **Step 6: Check final local state**

```powershell
git diff --check
git status --short --branch
git log --oneline --decorate -8
git diff --stat 4087762..HEAD
```

Expected: no unstaged tracked changes; `firebase-debug.log` remains the only untracked file; branch is unchanged; no merge, push or deployment occurred.

- [ ] **Step 7: Stop for explicit authorization**

Return this gate:

```text
本機 Pages Actions 實作已完成並驗證。
尚未執行：合併 origin/main、push、PR、Pages build_type 切換、PR merge、正式部署。
下一步依 docs/superpowers/plans/2026-07-17-git-source-convergence-cutover-plan.md 執行，先取得 merge 明確同意。
```

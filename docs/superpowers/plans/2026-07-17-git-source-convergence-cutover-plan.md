# Git Source Convergence and Pages Actions Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把遠端 GitHub Pages 部署 commit 安全納入本機完整原始碼歷史，以 PR 讓 `main` 成為 source of truth，將原 Pages site 切成 Actions artifact 發布，驗證正式站後保留可立即回復 legacy 發布的路徑。

**Architecture:** 先在本機工作 branch 合併最新 `origin/main`，用零未解衝突、零刪除、Node 22 與版號檢查守住內容，再完整測試。之後 push 並建立 draft PR，只驗證 artifact；Pages `build_type` 經獨立同意切為 `workflow`，最後經另一個同意 merge PR，讓原 site 由 `deploy-pages.yml` 發布相同 allowlist artifact。

**Tech Stack:** Git、GitHub CLI、GitHub REST Pages API、GitHub Pull Requests、GitHub Actions、GitHub Pages、PowerShell、Node.js 22。

## Global Constraints

- 只在原專案資料夾工作，不 clone、不建立 worktree、不搬移檔案、不建立新 repository 或 Pages site。
- `firebase-debug.log` 保持未追蹤且不碰觸；不得刪除任何檔案、資料、branch 或遠端資源。
- 合併 `origin/main`、push/建立 PR、切換 Pages `build_type`、merge PR 分成四個明確授權關卡。
- 禁止 rebase、force push、hard reset、改寫歷史、直接推送本機內容到 `main` 或刪除 branch。
- 正式站維持 `https://green-tea-king.github.io/nearby-good-eats/`，repository 維持 `green-tea-king/nearby-good-eats`。
- release version 必須是 `2026.07.17.3`，Functions runtime 必須保持 Node.js 22。
- 任何合併結果若出現未解衝突、刪除、敏感資訊、版本倒退或 Node 20，立即停止；只有 merge 已獲授權時才可用 `git merge --abort` 回復合併前狀態。
- 正式部署前後都要讀取 Pages API；部署後必須執行 live smoke 與瀏覽器人工驗收。

---

## External State Map

- Git source: `green-tea-king/nearby-good-eats` / `main`。
- Working branch: `codex/deploy-local-primary-20260716`。
- Current legacy Pages source before cutover: branch `main`, path `/`。
- Target Pages source: `build_type=workflow`, artifact from `.github/workflows/deploy-pages.yml`。
- Existing live site: `https://green-tea-king.github.io/nearby-good-eats/`。
- Expected release: `2026.07.17.3`。

### Task 1: Read-Only Preflight and Merge Authorization Gate

**Files:**
- Read only: `AGENTS.md`, `project-rules.md`, `design.md`, `VERSION`, workflow, manifest and Git state.

**Interfaces:**
- Consumes: completed local implementation plan and GitHub authentication.
- Produces: a current snapshot; no repository or platform mutation.

- [ ] **Step 1: Confirm branch and untouched log**

```powershell
git status --short --branch
git branch --show-current
git log -1 --oneline
```

Expected: branch `codex/deploy-local-primary-20260716`; only `?? firebase-debug.log`; local implementation commits present.

- [ ] **Step 2: Refresh remote references without changing files**

```powershell
git fetch --prune origin
git remote -v
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count HEAD...origin/main
```

Expected: origin points to `green-tea-king/nearby-good-eats`. Record both SHAs and ahead/behind count.

- [ ] **Step 3: Confirm repository, Pages and workflow state**

```powershell
gh auth status
gh repo view green-tea-king/nearby-good-eats --json nameWithOwner,defaultBranchRef,url,isPrivate
gh api repos/green-tea-king/nearby-good-eats/pages
gh workflow view deploy-pages.yml --repo green-tea-king/nearby-good-eats
```

Expected before push: repository is public, default branch `main`, Pages URL unchanged, Pages still `build_type=legacy`. The workflow may be absent remotely because it exists only locally.

- [ ] **Step 4: Inspect incoming content and deletion risk**

```powershell
git diff --name-status HEAD...origin/main
git diff --summary HEAD...origin/main
git log --left-right --cherry-pick --oneline HEAD...origin/main
```

Expected: explain each remote-only commit. Do not proceed if the incoming side intentionally deletes any local source or configuration.

- [ ] **Step 5: Request explicit merge approval**

Return:

```text
合併前檢查完成。下一步會在 codex/deploy-local-primary-20260716 執行 git merge --no-ff --no-commit origin/main；不會 push、不會部署。若檢查出衝突或刪除，會停止並在已授權的 merge 範圍內執行 git merge --abort。請明確同意後才執行。
```

Expected: wait for explicit approval.

### Task 2: Merge Remote Deployment History into the Local Source Branch

**Files:**
- Git merge only; preserve all tracked files.

**Interfaces:**
- Consumes: Task 1 approval and current `origin/main` SHA.
- Produces: one local merge commit connecting the remote deployment history without content deletion.

- [ ] **Step 1: Start a non-committing merge**

```powershell
git merge --no-ff --no-commit origin/main
```

Expected: merge stops before commit. If Git reports a conflict, do not resolve automatically.

- [ ] **Step 2: Enforce zero unresolved paths and zero staged deletions**

```powershell
$unmerged = @(git diff --name-only --diff-filter=U)
$deletions = @(git diff --cached --name-status --diff-filter=D)
Write-Output "UnmergedCount=$($unmerged.Count)"
Write-Output "DeletionCount=$($deletions.Count)"
$unmerged
$deletions
```

Expected: both counts are zero. Otherwise run `git merge --abort`, report exact files and stop.

- [ ] **Step 3: Confirm every pre-merge tracked file plus critical runtime and version**

```powershell
$preMergeTracked = @(git ls-tree -r --name-only HEAD)
$missingTracked = @($preMergeTracked | Where-Object {
  -not (Test-Path -LiteralPath $_ -PathType Leaf) -or
  -not (git ls-files --error-unmatch -- $_ 2>$null)
})
if ($missingTracked.Count) { throw "Previously tracked files missing after merge: $($missingTracked -join ', ')" }
$critical = @(
  "AGENTS.md", "project-rules.md", "design.md", "functions/index.js",
  "functions/package.json", "functions/package-lock.json",
  ".github/workflows/deploy-pages.yml", "scripts/pages-files.json"
)
$missingCritical = @($critical | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) })
if ($missingCritical.Count) { throw "Missing critical files: $($missingCritical -join ', ')" }
$version = (Get-Content -Encoding UTF8 VERSION -Raw).Trim()
$runtime = (Get-Content -Encoding UTF8 functions/package.json -Raw | ConvertFrom-Json).engines.node
if ($version -ne "2026.07.17.3") { throw "Version regressed to $version" }
if ($runtime -ne "22") { throw "Functions runtime regressed to Node $runtime" }
```

Expected: every file tracked before merge—including the 21 files identified in the approved design plus the later design/plan and implementation files—still exists and remains tracked; version is `2026.07.17.3` and runtime is 22. On failure abort and stop.

- [ ] **Step 4: Review the staged merge and untouched untracked file**

```powershell
git status --short --branch
git diff --cached --stat
git diff --cached --check
git diff --cached -- VERSION functions/package.json functions/package-lock.json
```

Expected: no deletion, no whitespace error, `firebase-debug.log` remains untracked and unstaged.

- [ ] **Step 5: Commit the approved merge**

```powershell
git commit -m "chore: converge remote deployment history"
```

Expected: a two-parent merge commit. Do not push.

### Task 3: Post-Merge Full Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: local merge commit.
- Produces: merge-safe test evidence before any remote branch is written.

- [ ] **Step 1: Run Pages and retry contracts**

```powershell
node scripts/test-pages-artifact.js
node scripts/test-pages-workflow-contract.js
.\scripts\test-github-api-retry.ps1
```

Expected: all pass.

- [ ] **Step 2: Run the complete project matrix**

```powershell
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

Expected: all tests pass; audit findings are recorded without force fix; whitespace check exits 0.

- [ ] **Step 3: Scan the exact outgoing diff**

```powershell
$patterns = '(?i)(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[0-9A-Za-z]{20,}|sk-[0-9A-Za-z]{20,})'
git diff --name-status origin/main...HEAD
git diff --summary origin/main...HEAD
git grep -n -I -E $patterns -- .
```

Expected: no deletion and no private key/token hit.

- [ ] **Step 4: Request push and draft PR approval**

Return:

```text
本機合併與完整驗證完成。下一步會 push codex/deploy-local-primary-20260716 並建立 draft PR 到 main；PR 只建置 artifact，不部署。尚不切換 Pages，也不 merge PR。請明確同意後才執行。
```

Expected: wait for explicit approval.

### Task 4: Push Branch and Validate Draft PR

**Files:**
- No local content edits.

**Interfaces:**
- Consumes: Task 3 approval.
- Produces: remote work branch, draft PR and successful PR build without deployment.

- [ ] **Step 1: Push only the working branch**

```powershell
git push -u origin codex/deploy-local-primary-20260716
```

Expected: branch push succeeds; `main` is unchanged.

- [ ] **Step 2: Create a draft PR**

```powershell
gh pr create --repo green-tea-king/nearby-good-eats --base main --head codex/deploy-local-primary-20260716 --draft --title "Converge source and move Pages to Actions" --body "Makes main the full source of truth and publishes only scripts/pages-files.json through a GitHub Pages artifact. PR runs build validation only; Pages setting and merge require separate approval."
```

Expected: a draft PR URL.

- [ ] **Step 3: Wait for checks and verify PR cannot deploy**

```powershell
$pr = gh pr view --repo green-tea-king/nearby-good-eats --json number,url,headRefOid,isDraft,mergeable,statusCheckRollup | ConvertFrom-Json
gh pr checks $pr.number --repo green-tea-king/nearby-good-eats --watch
gh run list --repo green-tea-king/nearby-good-eats --workflow deploy-pages.yml --branch codex/deploy-local-primary-20260716 --limit 5 --json databaseId,event,status,conclusion,url
```

Expected: Pages workflow build passes for event `pull_request`; deploy job is skipped; no new Pages deployment occurs.

- [ ] **Step 4: Inspect PR scope**

```powershell
gh pr diff $pr.number --repo green-tea-king/nearby-good-eats --name-only
gh pr view $pr.number --repo green-tea-king/nearby-good-eats --json additions,deletions,changedFiles,mergeable,url
```

Expected: full source additions are visible, no unexpected deletion, mergeable state is not conflicting.

### Task 5: Pages Source Switch Authorization and Cutover

**Files:**
- External Pages setting only.

**Interfaces:**
- Consumes: successful draft PR build and explicit Pages-switch approval.
- Produces: existing site configured with `build_type=workflow`; site content remains the current deployment until PR merge triggers a workflow.

- [ ] **Step 1: Report current evidence and request Pages switch approval**

Return:

```text
Draft PR 與 artifact 建置已通過，PR 沒有部署。下一步只會把原本 green-tea-king/nearby-good-eats Pages 的 build_type 從 legacy 改為 workflow；不建立新 site、不 merge PR。若需回復，會改回 legacy + main + /。請明確同意後才執行。
```

Expected: wait for explicit approval.

- [ ] **Step 2: Capture current Pages state in command output**

```powershell
$before = gh api repos/green-tea-king/nearby-good-eats/pages | ConvertFrom-Json
$before | Select-Object html_url,build_type,source | ConvertTo-Json -Depth 5
if ($before.html_url -ne "https://green-tea-king.github.io/nearby-good-eats/") { throw "Unexpected Pages URL" }
if ($before.build_type -ne "legacy") { throw "Expected legacy before cutover, got $($before.build_type)" }
```

Expected: original URL, `legacy`, source `main /`.

- [ ] **Step 3: Switch only build_type**

```powershell
gh api --method PUT repos/green-tea-king/nearby-good-eats/pages -f build_type=workflow
$after = gh api repos/green-tea-king/nearby-good-eats/pages | ConvertFrom-Json
$after | Select-Object html_url,build_type,source | ConvertTo-Json -Depth 5
if ($after.build_type -ne "workflow") { throw "Pages cutover did not persist" }
```

Expected: API update succeeds and existing URL now reports `build_type=workflow`.

- [ ] **Step 4: Confirm current site still serves the prior version**

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion 2026.07.17.2
```

Expected: live smoke still passes at the prior deployed version before PR merge. If the site becomes unavailable, execute the rollback command in Task 7 after reporting the failure.

### Task 6: PR Merge Authorization, Deployment and Local Alignment

**Files:**
- Remote PR/main and existing Pages deployment.

**Interfaces:**
- Consumes: Pages workflow mode, successful draft PR and explicit merge/deploy approval.
- Produces: complete-source `main`, Pages release `2026.07.17.3` and locally fast-forwarded working branch.

- [ ] **Step 1: Request PR merge/deployment approval**

Return:

```text
原 Pages site 已切成 workflow 模式，舊版網站仍正常。下一步會將 draft PR 標為 ready 並以 merge commit 合併到 main；這會觸發正式 Pages 部署 2026.07.17.3。完成後不刪 branch。請明確同意後才執行。
```

Expected: wait for explicit approval.

- [ ] **Step 2: Mark ready and merge without deleting the branch**

```powershell
gh pr ready $pr.number --repo green-tea-king/nearby-good-eats
gh pr merge $pr.number --repo green-tea-king/nearby-good-eats --merge
```

Expected: PR merged with a merge commit; remote branch remains.

- [ ] **Step 3: Monitor the main push deployment**

```powershell
$mergeSha = gh pr view $pr.number --repo green-tea-king/nearby-good-eats --json mergeCommit --jq ".mergeCommit.oid"
$runs = gh run list --repo green-tea-king/nearby-good-eats --workflow deploy-pages.yml --branch main --event push --limit 10 --json databaseId,createdAt,headSha,status,conclusion,url | ConvertFrom-Json
$deployRun = $runs | Where-Object { $_.headSha -eq $mergeSha } | Sort-Object { [DateTimeOffset]$_.createdAt } -Descending | Select-Object -First 1
if (-not $deployRun) { throw "No deploy-pages.yml push run found for merge commit $mergeSha" }
gh run watch $deployRun.databaseId --repo green-tea-king/nearby-good-eats --exit-status --interval 5
```

Expected: the selected run's `headSha` equals the PR merge commit and the run completes successfully.

- [ ] **Step 4: Verify live release**

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion 2026.07.17.3
gh api repos/green-tea-king/nearby-good-eats/pages
```

Expected: live smoke passes, URL unchanged, `build_type=workflow`.

- [ ] **Step 5: Perform browser acceptance**

Open `https://green-tea-king.github.io/nearby-good-eats/` in a clean/reloaded browser and verify:

1. Logo side shows `v07.17.3` and no garbled text.
2. First visit does not auto-search.
3. Google sign-in can start normally.
4. Keyword input does not lose focus.
5. Filters query only after `套用`.
6. District and travel modes remain mutually exclusive.
7. A result set shows 3 restaurants or clearly explains relaxation.
8. `下一組` does not repeat the same cards.
9. Share route such as `?place=ChIJ_example_place_id` opens the intended card.
10. Details and lazy-loaded photos work.
11. `admin.html` opens without obvious error.

Expected: record each item pass/fail; do not hide API, account or quota limitations.

- [ ] **Step 6: Align the local working branch without history rewrite**

```powershell
git fetch origin
git merge --ff-only origin/main
git status --short --branch
```

Expected: fast-forward only; `firebase-debug.log` remains the sole untracked file. If fast-forward is impossible, stop without rebase or reset.

### Task 7: Exact Rollback and Final Report

**Files:**
- External Pages setting only if rollback is needed.

**Interfaces:**
- Consumes: a failed cutover/deployment/live check.
- Produces: original legacy Pages configuration without deleting any Git history or deployment resource.

- [ ] **Step 1: Roll back only when a cutover check fails and report first**

```powershell
gh api --method PUT repos/green-tea-king/nearby-good-eats/pages -f build_type=legacy -f "source[branch]=main" -f "source[path]=/"
$rollback = gh api repos/green-tea-king/nearby-good-eats/pages | ConvertFrom-Json
$rollback | Select-Object html_url,build_type,source | ConvertTo-Json -Depth 5
```

Expected: original URL, `build_type=legacy`, source branch `main` and path `/`. This does not delete commits, PRs, workflows or branch.

- [ ] **Step 2: Verify the best available live version after rollback**

If rollback happened before PR merge:

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion 2026.07.17.2
```

If rollback happened after PR merge:

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion 2026.07.17.3
```

Expected: report the actual result. Legacy root now contains complete source, so this is emergency compatibility only; do not leave it unreviewed.

- [ ] **Step 3: Produce the required final report**

Report in Taiwan Traditional Chinese:

```text
1. 這次做了什麼：遠端部署歷史已安全收斂到完整 source，Pages 已切換為 Actions artifact（或已回復 legacy）。
2. 修改了哪些檔案：列出 PR 實際 changed files；firebase-debug.log 未碰觸。
3. 版本號：2026.07.17.3。
4. 驗證：列出每個實際執行的指令、Actions run URL、live smoke 與瀏覽器驗收結果。
5. 是否已部署：是／否／已回復。
6. 部署 URL：https://green-tea-king.github.io/nearby-good-eats/
7. 尚未驗證或需使用者處理：帳號、App Check、API quota、人工登入或任何失敗項目。
8. Git：branch、merge commit、PR URL、main SHA、Pages build_type、HEAD...origin/main 落差。
```

- [ ] **Step 4: Suggest the next single task**

Recommend one task only:

```text
下一個建議任務：把 GitHub Actions 與正式站 smoke 納入每次版本發布的固定 release checklist。原因是本次已完成 source 與部署責任分離，下一個最大風險會變成「有人更新版號或 manifest，卻漏跑 workflow/live 驗證」；固定 checklist 能在不改產品功能、不增加 API 成本的前提下避免再次出現本機、main 與正式站版本不同步。
```

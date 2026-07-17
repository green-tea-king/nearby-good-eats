# GitHub API 部署重試 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為既有 GitHub Git Data API 靜態部署加入有上限、可測試、只針對短暫錯誤的重試機制，升版為 `2026.07.17.2` 後部署到原 GitHub Pages。

**Architecture:** 將錯誤分類與退避迴圈放入獨立 PowerShell helper，透過可注入的 operation 與 delay schedule 做無網路單元測試。`deploy-github-contents.ps1` 保留現有 allowlist 與 Git Data API 流程，只負責把單次 `gh api` 呼叫包進 helper；HTTP 502/503/504 或整份 HTML 回應可重試，其他錯誤立即停止。

**Tech Stack:** PowerShell 7／Windows PowerShell 相容語法、GitHub CLI `gh api`、GitHub Git Data API、GitHub Pages、既有 Node.js assertion scripts、Git。

## Global Constraints

- 只在目前專案資料夾工作；不得建立新專案、worktree、Pages site、repository 或搬移檔案。
- 目前 branch 必須維持 `codex/deploy-local-primary-20260716`；不得直接修改或本機 merge 到 `main`。
- 不刪除 `firebase-debug.log` 或任何檔案、資料、branch、remote ref 或 Git 歷史。
- 不使用 force push、hard reset、rebase 或整支部署腳本的無限重試。
- 只重試 HTTP 502、503、504 與整份 HTML 閘道回應；401、403、404、409、422 與本機錯誤立即失敗。
- 每個 API 步驟最多嘗試 6 次，正式延遲固定為 2、4、8、12、15 秒；測試延遲為 0 秒。
- 日誌不得輸出 GitHub token、request body、API key、Firebase secret 或檔案內容。
- 部署平台固定為 `green-tea-king/nearby-good-eats` 的 `main` 與 `https://green-tea-king.github.io/nearby-good-eats/`。
- 版本固定更新為 `2026.07.17.2`；Firebase Functions 與 Firestore Rules 不重新部署。
- 本計畫在目前 session 逐項執行；除非使用者另外明確要求，不派出 subagent。

## File Structure

- Create: `scripts/github-api-retry.ps1` — 短暫錯誤分類、錯誤摘要、有限重試與退避。
- Create: `scripts/test-github-api-retry.ps1` — 無網路 PowerShell 行為測試與部署腳本整合契約。
- Modify: `scripts/deploy-github-contents.ps1` — 載入 helper、把 helper／測試加入 allowlist、捕捉 `gh api` 輸出並呼叫有限重試。
- Modify: `VERSION` — 正式版本 `2026.07.17.2`。
- Modify: `index.html` — 四個核心 JS query 與 `APP_VERSION_FALLBACK`。
- Modify: `design.md` — 文件版本、目前正式版本與部署重試說明。

---

### Task 1: 以 TDD 建立短暫錯誤分類與有限重試 helper

**Files:**
- Create: `scripts/test-github-api-retry.ps1`
- Create: `scripts/github-api-retry.ps1`

**Interfaces:**
- Consumes: injected `[scriptblock]$Operation`、`[string]$Endpoint`、`[string]$Method`、`[int]$MaxAttempts`、`[int[]]$DelaySeconds`
- Produces: `Test-GhHtmlResponse -Text <string> -> bool`、`Test-GhTransientFailure -Message <string> -> bool`、`Invoke-GhApiWithRetry -> operation result or terminating error`

- [ ] **Step 1: 寫入會失敗的 helper 行為測試**

Create `scripts/test-github-api-retry.ps1` with:

```powershell
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "github-api-retry.ps1")

function Assert-Equal {
  param([object]$Actual, [object]$Expected, [string]$Message)
  if ($Actual -ne $Expected) {
    throw "$Message Expected=[$Expected] Actual=[$Actual]"
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (!$Condition) { throw $Message }
}

function Assert-Throws {
  param([scriptblock]$Action, [string]$Pattern, [string]$Message)
  try {
    & $Action
  } catch {
    if ($_.Exception.Message -notmatch $Pattern) {
      throw "$Message Wrong error: $($_.Exception.Message)"
    }
    return
  }
  throw "$Message Expected a terminating error."
}

$attempts = 0
$result = Invoke-GhApiWithRetry -Endpoint "repos/example/project/git/ref/heads/main" -Method "GET" -MaxAttempts 6 -DelaySeconds @(0, 0, 0, 0, 0) -Operation {
  $script:attempts++
  if ($script:attempts -le 2) {
    throw "gh: <!DOCTYPE html><html><body>Service unavailable</body></html> (HTTP 503)"
  }
  [pscustomobject]@{ ok = $true }
}
Assert-Equal $attempts 3 "Transient failures should retry until success."
Assert-True $result.ok "Successful retry should return the operation result."

$attempts = 0
Assert-Throws -Pattern "HTTP 401" -Message "Permanent errors must not retry." -Action {
  Invoke-GhApiWithRetry -Endpoint "repos/example/project/git/ref/heads/main" -Method "GET" -MaxAttempts 6 -DelaySeconds @(0, 0, 0, 0, 0) -Operation {
    $script:attempts++
    throw "gh: Requires authentication (HTTP 401)"
  }
}
Assert-Equal $attempts 1 "HTTP 401 should stop after the first attempt."

$attempts = 0
Assert-Throws -Pattern "after 6 attempts.*repos/example/project/git/blobs" -Message "Retry exhaustion should include the attempt count and endpoint." -Action {
  Invoke-GhApiWithRetry -Endpoint "repos/example/project/git/blobs" -Method "POST" -MaxAttempts 6 -DelaySeconds @(0, 0, 0, 0, 0) -Operation {
    $script:attempts++
    throw "upstream request failed (HTTP 503)"
  }
}
Assert-Equal $attempts 6 "HTTP 503 should stop at the configured maximum."

Assert-True (Test-GhHtmlResponse -Text "  <!DOCTYPE html><html></html>") "A full HTML response should be transient."
Assert-True (!(Test-GhHtmlResponse -Text '{"content":"<html>text</html>"}')) "HTML inside valid JSON is not a gateway response."
Assert-True (!(Test-GhTransientFailure -Message "ConvertFrom-Json: invalid JSON")) "Generic JSON errors must not retry."

[pscustomobject]@{
  ok = $true
  cases = 7
} | ConvertTo-Json -Compress
```

- [ ] **Step 2: 執行測試並確認 RED**

Run:

```powershell
& .\scripts\test-github-api-retry.ps1
```

Expected: FAIL because `scripts/github-api-retry.ps1` or `Invoke-GhApiWithRetry` does not exist. This is the required RED evidence; do not write production code before observing it.

- [ ] **Step 3: 寫入最小 helper 實作**

Create `scripts/github-api-retry.ps1` with:

```powershell
function Test-GhHtmlResponse {
  param([AllowEmptyString()][string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  return [bool]($Text -match "(?is)^\s*(?:<!doctype\s+html\b|<html\b)")
}

function Test-GhTransientFailure {
  param([AllowEmptyString()][string]$Message)

  if ([string]::IsNullOrWhiteSpace($Message)) { return $false }
  if ($Message -match "(?i)\bHTTP(?:/\d(?:\.\d)?)?\s+(?:502|503|504)\b") { return $true }
  return [bool]($Message -match "(?is)(?:^|[\r\n:]\s*)(?:<!doctype\s+html\b|<html\b)")
}

function Get-GhFailureSummary {
  param([AllowEmptyString()][string]$Message)

  $Summary = (($Message -replace "\s+", " ").Trim())
  if ($Summary.Length -le 240) { return $Summary }
  return $Summary.Substring(0, 240) + "..."
}

function Invoke-GhApiWithRetry {
  param(
    [Parameter(Mandatory)][scriptblock]$Operation,
    [Parameter(Mandatory)][string]$Endpoint,
    [string]$Method = "GET",
    [ValidateRange(1, 100)][int]$MaxAttempts = 6,
    [int[]]$DelaySeconds = @(2, 4, 8, 12, 15)
  )

  if ($MaxAttempts -gt 1 -and $DelaySeconds.Count -lt ($MaxAttempts - 1)) {
    throw "DelaySeconds must contain at least $($MaxAttempts - 1) values."
  }
  if (@($DelaySeconds | Where-Object { $_ -lt 0 }).Count -gt 0) {
    throw "DelaySeconds cannot contain negative values."
  }

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    try {
      return & $Operation
    } catch {
      $FailureMessage = $_.Exception.Message
      if (!(Test-GhTransientFailure -Message $FailureMessage)) { throw }

      $Summary = Get-GhFailureSummary -Message $FailureMessage
      if ($Attempt -ge $MaxAttempts) {
        throw "gh api failed after $Attempt attempts: $Method $Endpoint. Last error: $Summary"
      }

      $Delay = $DelaySeconds[$Attempt - 1]
      Write-Warning "Transient GitHub API failure ($Attempt/$MaxAttempts): $Method $Endpoint. Retrying in ${Delay}s. $Summary"
      if ($Delay -gt 0) { Start-Sleep -Seconds $Delay }
    }
  }
}
```

- [ ] **Step 4: 執行測試並確認 GREEN**

Run:

```powershell
& .\scripts\test-github-api-retry.ps1
```

Expected: exit code 0 and `{"ok":true,"cases":7}`. Warnings may show retry attempts but must not contain token or request body.

- [ ] **Step 5: 提交 helper 與行為測試**

Run:

```powershell
git add scripts/github-api-retry.ps1 scripts/test-github-api-retry.ps1
git diff --cached --check
git commit -m "test: define bounded GitHub API retries"
```

Expected: one focused commit; `firebase-debug.log` remains untracked.

### Task 2: 以 TDD 將 helper 整合進既有部署腳本

**Files:**
- Modify: `scripts/test-github-api-retry.ps1`
- Modify: `scripts/deploy-github-contents.ps1:10-110`

**Interfaces:**
- Consumes: `Invoke-GhApiWithRetry`, `Test-GhHtmlResponse`
- Produces: `Invoke-GhJson -Endpoint <string> -Method <string> -Body <object>` with bounded retry and parsed JSON result

- [ ] **Step 1: 先加入部署整合契約測試**

Append before the final result object in `scripts/test-github-api-retry.ps1`:

```powershell
$DeployScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot "deploy-github-contents.ps1") -Raw -Encoding UTF8
Assert-True ($DeployScript -match 'github-api-retry\.ps1') "Deploy script must load the retry helper."
Assert-True ($DeployScript -match 'Invoke-GhApiWithRetry') "Deploy script must call the bounded retry helper."
Assert-True ($DeployScript -match '"scripts/github-api-retry\.ps1"') "Deploy allowlist must include the retry helper."
Assert-True ($DeployScript -match '"scripts/test-github-api-retry\.ps1"') "Deploy allowlist must include the retry test."
```

Change `cases = 7` to `cases = 11`.

- [ ] **Step 2: 執行契約測試並確認 RED**

Run:

```powershell
& .\scripts\test-github-api-retry.ps1
```

Expected: FAIL with `Deploy script must load the retry helper.` because integration is not present yet.

- [ ] **Step 3: 載入 helper 並加入部署 allowlist**

In `scripts/deploy-github-contents.ps1`, immediately after `$ScriptDir` add:

```powershell
$RetryHelperPath = Join-Path $ScriptDir "github-api-retry.ps1"
. $RetryHelperPath
```

Add immediately before the existing `scripts/deploy-github-contents.ps1` allowlist item:

```powershell
  "scripts/github-api-retry.ps1",
  "scripts/test-github-api-retry.ps1",
```

- [ ] **Step 4: 用有限重試改寫 `Invoke-GhJson`**

Replace the current `Invoke-GhJson` body with:

```powershell
function Invoke-GhJson {
  param(
    [string]$Endpoint,
    [string]$Method = "GET",
    [object]$Body = $null
  )

  $Tmp = $null
  try {
    if ($null -ne $Body) {
      $Tmp = New-TemporaryFile
      [IO.File]::WriteAllText($Tmp.FullName, ($Body | ConvertTo-Json -Compress -Depth 20), [Text.Encoding]::ASCII)
    }

    return Invoke-GhApiWithRetry -Endpoint $Endpoint -Method $Method -Operation {
      if ($null -eq $Tmp) {
        $Raw = & gh api $Endpoint --method $Method 2>&1
      } else {
        $Raw = & gh api $Endpoint --method $Method --input $Tmp.FullName 2>&1
      }

      $GhExitCode = $LASTEXITCODE
      $RawText = (@($Raw | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
      if ($GhExitCode -ne 0) {
        throw "gh api exited with code $GhExitCode. $RawText"
      }
      if (Test-GhHtmlResponse -Text $RawText) {
        throw "gh api returned an HTML response: $RawText"
      }

      return $RawText | ConvertFrom-Json
    }
  } finally {
    if ($null -ne $Tmp) {
      Remove-Item -LiteralPath $Tmp.FullName -Force
    }
  }
}
```

This preserves one temporary body file across retries and removes it in `finally`. A missing `gh`, invalid local JSON, 401/403/404/409/422, or non-HTML parse failure remains non-transient and stops immediately.

- [ ] **Step 5: 執行整合契約與 PowerShell parser 檢查**

Run:

```powershell
& .\scripts\test-github-api-retry.ps1
$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '.\scripts\github-api-retry.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw ($errors | Out-String) }
$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '.\scripts\deploy-github-contents.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw ($errors | Out-String) }
```

Expected: retry test returns `{"ok":true,"cases":11}` and both files have zero parser errors.

- [ ] **Step 6: 提交部署腳本整合**

Run:

```powershell
git add scripts/deploy-github-contents.ps1 scripts/test-github-api-retry.ps1
git diff --cached --check
git commit -m "fix: retry transient GitHub API failures"
```

Expected: one focused integration commit; no version files are changed yet.

### Task 3: 同步 `2026.07.17.2` 版本與部署文件

**Files:**
- Modify: `VERSION:1`
- Modify: `index.html:29-32`
- Modify: `index.html:1390`
- Modify: `design.md:3`
- Modify: `design.md:19`
- Modify: `design.md:591-602`

**Interfaces:**
- Consumes: verified retry integration
- Produces: all runtime version sources set to `2026.07.17.2` and documented retry behavior

- [ ] **Step 1: 精確同步版本來源**

Apply these replacements only:

```text
VERSION: 2026.07.17.1 -> 2026.07.17.2
design.md line 3: 版本：2026.07.17.1 -> 版本：2026.07.17.2
design.md current version: `2026.07.17.1` -> `2026.07.17.2`
index.html four core JS queries: ?v=2026.07.17.1 -> ?v=2026.07.17.2
index.html APP_VERSION_FALLBACK: 2026.07.17.1 -> 2026.07.17.2
```

Add after the paragraph describing `deploy-github-contents.ps1`:

```markdown
GitHub Git Data API 若回傳 HTTP 502、503、504 或整份 HTML 閘道錯誤，部署腳本會在單一 API 步驟內最多嘗試 6 次，依序等待 2、4、8、12、15 秒；401、403、404、409、422 與本機錯誤不重試。重試不會切換平台、建立新專案、force push 或重新部署 Firebase。
```

- [ ] **Step 2: 驗證版本契約與文件內容**

Run:

```powershell
node scripts/test-static-asset-versions.js
rg -n "2026\.07\.17\.(1|2)|APP_VERSION_FALLBACK|502、503、504" VERSION index.html design.md
git diff --check
```

Expected: static asset version test passes; runtime version sources are all `2026.07.17.2`; `2026.07.17.1` only appears where historical text genuinely requires it.

- [ ] **Step 3: 提交版本更新**

Run:

```powershell
git add VERSION index.html design.md
git diff --cached --check
git commit -m "release: prepare v2026.07.17.2"
```

Expected: release commit contains only three version/document files.

### Task 4: 執行完整部署前驗證

**Files:**
- Test: `scripts/test-github-api-retry.ps1`
- Test: all minimum-matrix scripts listed in `AGENTS.md`
- Read: current Git diff and status

**Interfaces:**
- Consumes: committed `2026.07.17.2` implementation
- Produces: deployment gate evidence; any required failure blocks Task 5

- [ ] **Step 1: 執行重試、前端與資料測試**

Run:

```powershell
& .\scripts\test-github-api-retry.ps1
node scripts/test-search-logic.js
node scripts/test-auth-logic.js
node scripts/test-core-awards-enrichment.js
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
node scripts/validate-awards-data.js
node scripts/validate-external-signals.js
node scripts/validate-external-source-coverage.js
```

Expected: all exit code 0; UI text scan has zero findings; awards count and source validations remain unchanged and valid.

- [ ] **Step 2: 執行 Functions 回歸測試與 audit**

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

Expected: four Functions tests pass. Record the current audit result honestly; do not run `npm audit fix --force` and do not redeploy Firebase.

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

Expected: syntax and whitespace checks pass; only existing untracked `firebase-debug.log` remains.

### Task 5: 部署既有 GitHub Pages 並驗證正式站

**Files:**
- Deploy: `scripts/deploy-github-contents.ps1`
- Smoke: `scripts/smoke-live-site.ps1`

**Interfaces:**
- Consumes: fully verified local version `2026.07.17.2`, existing `gh` login
- Produces: one non-force remote deployment commit on existing `main`, live Pages version `2026.07.17.2`

- [ ] **Step 1: 確認 GitHub 身分與部署目標，不輸出 token**

Run:

```powershell
gh auth status
gh repo view green-tea-king/nearby-good-eats --json nameWithOwner,defaultBranchRef,url
```

Expected: authenticated account can access `green-tea-king/nearby-good-eats`; default branch is `main`.

- [ ] **Step 2: 使用新重試機制部署原 `main`**

Run:

```powershell
.\scripts\deploy-github-contents.ps1 -Owner green-tea-king -Repo nearby-good-eats -Branch main -Message "Deploy v2026.07.17.2 with bounded GitHub API retries"
```

Expected: transient 502/503/504 or HTML responses show bounded warning and retry; success output contains branch, base, commit, file count and ref. Permanent errors stop immediately. No new repository, site, branch or Firebase deployment is created.

- [ ] **Step 3: 等待既有 Pages workflow 完成**

Run:

```powershell
gh run list --repo green-tea-king/nearby-good-eats --limit 5
```

Expected: deployment commit's Pages workflow becomes `completed/success`. Poll in short intervals and communicate at least once per 60 seconds.

- [ ] **Step 4: 執行正式站 smoke**

Run:

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion 2026.07.17.2
```

Expected: live VERSION, HTML asset queries, required resources and search behavior smoke all pass at `https://green-tea-king.github.io/nearby-good-eats/`.

### Task 6: 核對部署後 Git 落差並完成回報

**Files:**
- Read: local branch, `origin/main`, deployment commit and worktree status

**Interfaces:**
- Consumes: successful Pages deployment commit and live smoke evidence
- Produces: exact ancestry/content difference, risks and next-task recommendation

- [ ] **Step 1: fetch 後比較 ancestry，不 merge 或 rebase**

Run:

```powershell
git fetch --prune origin
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate -5 HEAD
git log --oneline --decorate -5 origin/main
```

Expected: exact local-only and remote-only commit counts; local branch remains unchanged.

- [ ] **Step 2: 比較實際檔案內容與工作樹**

Run:

```powershell
git diff --name-status HEAD..origin/main
git diff --stat HEAD..origin/main
git diff --check HEAD..origin/main
git status --short --branch
```

Expected: identify any allowlist-only, local-only or EOL-only differences; `firebase-debug.log` remains untracked and untouched.

- [ ] **Step 3: 依固定格式完成回報並提出下一個任務**

Report:

```text
1. 這次做了什麼
2. 修改了哪些檔案
3. 版本號更新成多少
4. 執行了哪些驗證指令與結果
5. 是否已部署
6. 部署 URL、部署 commit 與部署時間
7. Git ancestry／內容落差、風險與尚未驗證事項
8. 建議下一個任務及其原因、範圍、風險與驗收方式
```

Expected: clearly distinguish automated smoke from unperformed Google-login/browser QA; do not claim unrun checks passed.

param(
  [string]$Owner = "green-tea-king",
  [string]$Repo = "nearby-good-eats",
  [string]$Branch = "main",
  [string]$Message = "Deploy GitHub Pages artifact",
  [ValidateRange(1, 10)][int]$MaxAttempts = 4,
  [ValidateRange(1, 60)][int]$BaseDelaySeconds = 3,
  [ValidateRange(2, 60)][int]$PollSeconds = 5,
  [ValidateRange(60, 3600)][int]$TimeoutSeconds = 900
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$RetryHelper = Join-Path $ScriptDir "github-api-retry.ps1"

if ($Owner -ne "green-tea-king" -or $Repo -ne "nearby-good-eats" -or $Branch -ne "main") {
  throw "Deployment target must be green-tea-king/nearby-good-eats main"
}
if (-not (Test-Path -LiteralPath $RetryHelper -PathType Leaf)) {
  throw "Missing retry helper: $RetryHelper"
}
. $RetryHelper

$RetryDelays = @()
for ($Index = 0; $Index -lt ($MaxAttempts - 1); $Index++) {
  $RetryDelays += [int][Math]::Min($BaseDelaySeconds * [Math]::Pow(2, $Index), 60)
}

function Get-StableProcessWorkingDirectory {
  $TempPath = [System.IO.Path]::GetTempPath()
  try {
    return (Resolve-Path -LiteralPath $TempPath).Path
  } catch {
    return $TempPath
  }
}

function Invoke-GhCommandOnce {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  $StableWorkingDirectory = Get-StableProcessWorkingDirectory
  Push-Location -LiteralPath $StableWorkingDirectory
  try {
    $Output = & $Command 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  $OutputText = (@($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
  if ($ExitCode -ne 0) {
    throw "gh command failed ($Label, exit $ExitCode): $OutputText"
  }
  if (Test-GhHtmlResponse -Text $OutputText) {
    throw "gh command returned an HTML response ($Label): $OutputText"
  }

  return $OutputText
}

function Invoke-GhReadWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  return Invoke-GhApiWithRetry `
    -Endpoint $Label `
    -Method "CLI-READ" `
    -MaxAttempts $MaxAttempts `
    -DelaySeconds $RetryDelays `
    -Operation { Invoke-GhCommandOnce -Label $Label -Command $Command }
}

$null = Invoke-GhReadWithRetry -Label "auth/status" -Command { gh auth status }
$RepoInfoJson = Invoke-GhReadWithRetry -Label "repo/view" -Command {
  gh repo view "$Owner/$Repo" --json nameWithOwner,defaultBranchRef,url
}
$RepoInfo = $RepoInfoJson | ConvertFrom-Json
if ($RepoInfo.nameWithOwner -ne "$Owner/$Repo") {
  throw "Repository mismatch: expected $Owner/$Repo, got $($RepoInfo.nameWithOwner)"
}
if ($RepoInfo.defaultBranchRef.name -ne $Branch) {
  throw "Branch mismatch: expected default $Branch, got $($RepoInfo.defaultBranchRef.name)"
}

$RemoteSha = Invoke-GhReadWithRetry -Label "commits/$Branch" -Command {
  gh api "repos/$Owner/$Repo/commits/$Branch" --jq ".sha"
}
$EncodedVersion = Invoke-GhReadWithRetry -Label "contents/VERSION?ref=$Branch" -Command {
  gh api --method GET "repos/$Owner/$Repo/contents/VERSION" -f "ref=$Branch" --jq ".content"
}
$RemoteVersion = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String(($EncodedVersion -replace "\s", ""))
).Trim()
$VersionPath = Join-Path $ProjectRoot "VERSION"
if (-not (Test-Path -LiteralPath $VersionPath -PathType Leaf)) {
  throw "Missing local VERSION file: $VersionPath"
}
$LocalVersion = (Get-Content -LiteralPath $VersionPath -Encoding UTF8 -Raw).Trim()
if ($RemoteVersion -ne $LocalVersion) {
  throw "Version mismatch: local=$LocalVersion remote=$RemoteVersion. Push or merge source before deployment."
}

$PagesJson = Invoke-GhReadWithRetry -Label "pages/view" -Command {
  gh api --method GET "repos/$Owner/$Repo/pages"
}
$Pages = $PagesJson | ConvertFrom-Json
if ($Pages.html_url -ne "https://green-tea-king.github.io/nearby-good-eats/") {
  throw "Unexpected Pages URL: $($Pages.html_url)"
}
if ($Pages.build_type -ne "workflow") {
  throw "Pages build_type must be workflow before dispatch, got $($Pages.build_type)"
}

$StartedAt = [DateTimeOffset]::UtcNow
# workflow_dispatch is a mutating operation. Send it exactly once to avoid duplicate deployments.
$DispatchOutput = Invoke-GhCommandOnce -Label "workflow/dispatch" -Command {
  gh workflow run deploy-pages.yml --repo "$Owner/$Repo" --ref $Branch -f "reason=$Message"
}

$RunId = $null
$RunUrlPattern = "https://github\.com/$([regex]::Escape($Owner))/$([regex]::Escape($Repo))/actions/runs/(?<id>\d+)"
if ($DispatchOutput -match $RunUrlPattern) {
  $RunId = [long]$Matches.id
}

$Deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
if (-not $RunId) {
  do {
    $RunsJson = Invoke-GhReadWithRetry -Label "runs/list" -Command {
      gh run list --repo "$Owner/$Repo" --workflow deploy-pages.yml --event workflow_dispatch --limit 20 --json databaseId,createdAt,headSha,status,conclusion,url
    }
    $Run = @($RunsJson | ConvertFrom-Json) |
      Where-Object {
        $_.headSha -eq $RemoteSha -and
        [DateTimeOffset]$_.createdAt -ge $StartedAt.AddSeconds(-5)
      } |
      Sort-Object { [DateTimeOffset]$_.createdAt } -Descending |
      Select-Object -First 1
    if ($Run) {
      $RunId = [long]$Run.databaseId
    } elseif ([DateTimeOffset]::UtcNow -lt $Deadline) {
      Start-Sleep -Seconds $PollSeconds
    }
  } while (-not $RunId -and [DateTimeOffset]::UtcNow -lt $Deadline)
}
if (-not $RunId) {
  throw "Timed out locating deploy-pages.yml run for $RemoteSha"
}

$null = Invoke-GhCommandOnce -Label "runs/watch" -Command {
  gh run watch $RunId --repo "$Owner/$Repo" --exit-status --interval $PollSeconds
}

$ResultJson = Invoke-GhReadWithRetry -Label "runs/$RunId" -Command {
  gh run view $RunId --repo "$Owner/$Repo" --json databaseId,status,conclusion,url,headSha
}
$Result = $ResultJson | ConvertFrom-Json
if ($Result.headSha -ne $RemoteSha) {
  throw "Workflow head SHA mismatch: expected $RemoteSha, got $($Result.headSha)"
}

[pscustomobject]@{
  repository = $RepoInfo.nameWithOwner
  branch = $Branch
  version = $LocalVersion
  runId = $Result.databaseId
  status = $Result.status
  conclusion = $Result.conclusion
  url = $Result.url
  headSha = $Result.headSha
  pagesUrl = $Pages.html_url
} | ConvertTo-Json -Compress

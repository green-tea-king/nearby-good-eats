param(
  [string]$Owner = "green-tea-king",
  [string]$Repo = "nearby-good-eats",
  [string]$Branch = "main",
  [string]$Message = "Deploy nearby-good-eats static site"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

$Files = @(
  "index.html",
  ".nojekyll",
  "VERSION",
  "design.md",
  "assets/awards-taiwan.json",
  "assets/500bowl-2025-candidates.json",
  "assets/500bowl-2025-import-report.json",
  "assets/500bowl-2025-merge-report.json",
  "assets/500sweet-2025-source-report.json",
  "assets/awards-taiwan.500bowl-2025-draft.json",
  "assets/awards-taiwan.michelin-selected-2025-draft.json",
  "assets/michelin-selected-2025-merge-report.json",
  "assets/external-signals.json",
  "assets/filter-rules.js",
  "assets/platform-signals.manual.json",
  "assets/social-signal-config.json",
  "assets/michelin-taiwan-2025-official-candidates.json",
  "assets/michelin-taiwan-2025-official-report.json",
  "assets/michelin-taiwan-2025-official-import-report.json",
  "assets/awards-taiwan.michelin-taiwan-2025-official-draft.json",
  "assets/michelin-taipei-2025-candidates.json",
  "assets/michelin-taipei-2025-import-report.json",
  "assets/awards-taiwan.michelin-2025-draft.json",
  "scripts/build-michelin-taiwan-2025-official.js",
  "scripts/build-500bowl-2025-candidates.js",
  "scripts/merge-500bowl-2025-awards.js",
  "scripts/merge-michelin-selected-2025-awards.js",
  "scripts/merge-platform-signals.js",
  "scripts/probe-500sweet-2025-source.js",
  "scripts/review-michelin-taiwan-2025-official-import.js",
  "scripts/validate-awards-data.js",
  "scripts/validate-external-signals.js",
  "scripts/smoke-live-site.ps1",
  "scripts/build-michelin-taipei-candidates.js",
  "scripts/review-michelin-award-import.js",
  "scripts/deploy-github-contents.ps1"
)

function Invoke-GhJson {
  param(
    [string]$Endpoint,
    [string]$Method = "GET",
    [object]$Body = $null
  )

  if ($null -eq $Body) {
    $Raw = gh api $Endpoint --method $Method
    if ($LASTEXITCODE -ne 0) {
      throw "gh api failed: $Endpoint"
    }
    return $Raw | ConvertFrom-Json
  }

  $Tmp = New-TemporaryFile
  try {
    [IO.File]::WriteAllText($Tmp.FullName, ($Body | ConvertTo-Json -Compress -Depth 20), [Text.Encoding]::ASCII)
    $Raw = gh api $Endpoint --method $Method --input $Tmp.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "gh api failed: $Endpoint"
    }
    return $Raw | ConvertFrom-Json
  } finally {
    Remove-Item -LiteralPath $Tmp.FullName -Force
  }
}

foreach ($Path in $Files) {
  if (!(Test-Path -LiteralPath $Path)) {
    throw "Missing file: $Path"
  }
}

$Ref = Invoke-GhJson "repos/$Owner/$Repo/git/ref/heads/$Branch"
$BaseCommitSha = $Ref.object.sha
$BaseCommit = Invoke-GhJson "repos/$Owner/$Repo/git/commits/$BaseCommitSha"
$BaseTreeSha = $BaseCommit.tree.sha

$Tree = @()
foreach ($Path in $Files) {
  $Bytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path))
  $Blob = Invoke-GhJson "repos/$Owner/$Repo/git/blobs" "POST" ([ordered]@{
    content = [Convert]::ToBase64String($Bytes)
    encoding = "base64"
  })
  $Tree += [ordered]@{
    path = $Path.Replace("\", "/")
    mode = "100644"
    type = "blob"
    sha = $Blob.sha
  }
}

$NewTree = Invoke-GhJson "repos/$Owner/$Repo/git/trees" "POST" ([ordered]@{
  base_tree = $BaseTreeSha
  tree = $Tree
})

$NewCommit = Invoke-GhJson "repos/$Owner/$Repo/git/commits" "POST" ([ordered]@{
  message = $Message
  tree = $NewTree.sha
  parents = @($BaseCommitSha)
})

$UpdatedRef = Invoke-GhJson "repos/$Owner/$Repo/git/refs/heads/$Branch" "PATCH" ([ordered]@{
  sha = $NewCommit.sha
  force = $false
})

[pscustomobject]@{
  branch = $Branch
  base = $BaseCommitSha
  commit = $NewCommit.sha
  files = $Files.Count
  ref = $UpdatedRef.object.sha
} | ConvertTo-Json -Compress

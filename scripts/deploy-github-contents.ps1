param(
  [string]$Owner = "green-tea-king",
  [string]$Repo = "nearby-good-eats",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

$Files = @(
  "index.html",
  "VERSION",
  "design.md",
  "assets/awards-taiwan.json",
  "assets/michelin-taiwan-2025-official-candidates.json",
  "assets/michelin-taiwan-2025-official-report.json",
  "assets/michelin-taiwan-2025-official-import-report.json",
  "assets/awards-taiwan.michelin-taiwan-2025-official-draft.json",
  "assets/michelin-taipei-2025-candidates.json",
  "assets/michelin-taipei-2025-import-report.json",
  "assets/awards-taiwan.michelin-2025-draft.json",
  "scripts/build-michelin-taiwan-2025-official.js",
  "scripts/review-michelin-taiwan-2025-official-import.js",
  "scripts/build-michelin-taipei-candidates.js",
  "scripts/review-michelin-award-import.js",
  "scripts/deploy-github-contents.ps1"
)

function Get-RemoteSha {
  param([string]$Path)
  try {
    return (gh api "repos/$Owner/$Repo/contents/$Path`?ref=$Branch" --jq ".sha")
  } catch {
    return $null
  }
}

foreach ($Path in $Files) {
  if (!(Test-Path -LiteralPath $Path)) {
    throw "Missing file: $Path"
  }

  $Sha = Get-RemoteSha $Path
  $Content = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path)))
  $Payload = [ordered]@{
    message = "Update Michelin Taiwan 2025 awards data and v2026.06.30.4"
    content = $Content
    branch = $Branch
  }
  if ($Sha) {
    $Payload.sha = $Sha
  }

  $Tmp = New-TemporaryFile
  try {
    [IO.File]::WriteAllText($Tmp.FullName, ($Payload | ConvertTo-Json -Compress -Depth 4), [Text.Encoding]::ASCII)
    $NewSha = gh api "repos/$Owner/$Repo/contents/$Path" --method PUT --input $Tmp.FullName --jq ".content.sha"
    Write-Output "uploaded $Path $NewSha"
  } finally {
    Remove-Item -LiteralPath $Tmp.FullName -Force
  }
}

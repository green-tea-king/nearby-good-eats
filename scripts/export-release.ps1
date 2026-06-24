param(
  [string]$DesktopPath = [Environment]::GetFolderPath("Desktop")
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$VersionPath = Join-Path $RepoRoot "VERSION"

if (!(Test-Path $VersionPath)) {
  throw "VERSION file not found: $VersionPath"
}

$Version = (Get-Content -Raw -Encoding UTF8 $VersionPath).Trim()
if (!$Version) {
  throw "VERSION is empty"
}

$ReleaseRoot = Join-Path $DesktopPath "nearby-good-eats-releases"
$ReleaseDir = Join-Path $ReleaseRoot "nearby-good-eats-v$Version"
$ZipPath = "$ReleaseDir.zip"

New-Item -ItemType Directory -Force $ReleaseDir | Out-Null

Copy-Item -Force (Join-Path $RepoRoot "index.html") $ReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "admin.html") $ReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "awards-taipei.json") $ReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "firebase-config.js") $ReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "firebase.json") $ReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "firestore.rules") $ReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "VERSION") $ReleaseDir
Copy-Item -Recurse -Force (Join-Path $RepoRoot "assets") $ReleaseDir
$FunctionsReleaseDir = Join-Path $ReleaseDir "functions"
New-Item -ItemType Directory -Force $FunctionsReleaseDir | Out-Null
Copy-Item -Force (Join-Path $RepoRoot "functions\index.js") $FunctionsReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "functions\package.json") $FunctionsReleaseDir
Copy-Item -Force (Join-Path $RepoRoot "functions\package-lock.json") $FunctionsReleaseDir

$Commit = ""
try {
  $Commit = (git -C $RepoRoot rev-parse --short HEAD).Trim()
} catch {
  $Commit = ""
}

$Manifest = [ordered]@{
  version = $Version
  commit = $Commit
  exportedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
  source = $RepoRoot.Path
  files = @(
    "index.html",
    "admin.html",
    "awards-taipei.json",
    "firebase-config.js",
    "firebase.json",
    "firestore.rules",
    "functions/",
    "assets/",
    "VERSION"
  )
}

$Manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $ReleaseDir "release-manifest.json")

if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}
Compress-Archive -Path (Join-Path $ReleaseDir "*") -DestinationPath $ZipPath -Force

[PSCustomObject]@{
  Version = $Version
  ReleaseDir = $ReleaseDir
  ZipPath = $ZipPath
  Commit = $Commit
}

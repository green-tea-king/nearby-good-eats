$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$VersionPath = Join-Path $RepoRoot "VERSION"
$ExpectedVersion = (Get-Content -Raw $VersionPath).Trim()
$BaseUrl = "https://green-tea-king.github.io/nearby-good-eats/"
$VersionUrl = "${BaseUrl}VERSION"
$HomeUrl = "${BaseUrl}?v=$ExpectedVersion"

$ProgressPreference = "SilentlyContinue"
$versionResponse = Invoke-WebRequest -UseBasicParsing $VersionUrl
$homeResponse = Invoke-WebRequest -UseBasicParsing $HomeUrl
$html = $homeResponse.Content
$liveVersion = ($versionResponse.Content | Out-String).Trim()

$checks = @(
  @{ Name = "version-match"; Ok = ($liveVersion -eq $ExpectedVersion); Detail = "live=$liveVersion expected=$ExpectedVersion" }
  @{ Name = "idle-copy"; Ok = ($html.Contains("先選條件，再按右下角「套用」開始查詢 Google 真資料。")); Detail = "idle state copy" }
  @{ Name = "idle-guide"; Ok = ($html.Contains("目前尚未送出搜尋。系統只會在你按下套用後才調用 API。")); Detail = "guide copy" }
  @{ Name = "result-actions"; Ok = ($html.Contains("不滿意這組結果？快速再找一組")); Detail = "result relax actions" }
)

$failed = $checks | Where-Object { -not $_.Ok }
$payload = [ordered]@{
  expectedVersion = $ExpectedVersion
  liveVersion = $liveVersion
  checks = $checks
}

$payload | ConvertTo-Json -Depth 4

if ($failed.Count -gt 0) {
  exit 1
}

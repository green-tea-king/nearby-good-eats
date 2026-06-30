param(
  [string]$BaseUrl = "https://green-tea-king.github.io/nearby-good-eats",
  [string]$ExpectedVersion = ""
)

$ErrorActionPreference = "Stop"

function Read-TextUrl {
  param([string]$Url)
  $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
  if ($Response.Content -is [byte[]]) {
    return [Text.Encoding]::UTF8.GetString($Response.Content)
  }
  return [string]$Response.Content
}

$CacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Version = (Read-TextUrl "$BaseUrl/VERSION?cacheBust=$CacheBust").Trim()
if ($ExpectedVersion -and $Version -ne $ExpectedVersion) {
  throw "VERSION mismatch. expected=$ExpectedVersion live=$Version"
}

$Html = Read-TextUrl "$BaseUrl/index.html?cacheBust=$CacheBust"
$ShortVersion = "v" + ($Version -replace "^20\d\d\.", "")
if ($ShortVersion -notmatch "^v\d\d\.") {
  throw "Unexpected short version format: $ShortVersion"
}
if ($Html -notlike "*$Version*" -and $Html -notlike "*$ShortVersion*") {
  throw "Homepage does not contain live version $Version or $ShortVersion"
}
if ($Html -notlike "*greenstar*") {
  throw "Homepage is missing greenstar rendering support"
}
if ($Html -notlike "*500bowl*" -or $Html -notlike "*500sweet*") {
  throw "Homepage is missing 500bowl/500sweet rendering support"
}

$FilterRulesText = Read-TextUrl "$BaseUrl/assets/filter-rules.js?cacheBust=$CacheBust"
foreach ($RequiredFilterText in @("key:""award""", "tier:""static""")) {
  if ($FilterRulesText -notlike "*$RequiredFilterText*") {
    throw "Filter rules are missing award level option: $RequiredFilterText"
  }
}

$AwardsText = Read-TextUrl "$BaseUrl/assets/awards-taiwan.json?cacheBust=$CacheBust"
$Awards = $AwardsText | ConvertFrom-Json
$Guides = @{}
foreach ($Restaurant in $Awards.restaurants) {
  foreach ($Award in $Restaurant.awards) {
    $Guides[$Award.guide] = 1 + ($Guides[$Award.guide] -as [int])
  }
}

$Expected = [ordered]@{
  restaurants = 1028
  michelin = 53
  "michelin_selected" = 222
  bib = 144
  greenstar = 7
  "500plate" = 260
  "500bowl" = 415
}

$Actual = [ordered]@{
  restaurants = $Awards.restaurants.Count
  michelin = $Guides["michelin"]
  "michelin_selected" = $Guides["michelin_selected"]
  bib = $Guides["bib"]
  greenstar = $Guides["greenstar"]
  "500plate" = $Guides["500plate"]
  "500bowl" = $Guides["500bowl"]
}

foreach ($Key in $Expected.Keys) {
  if (($Actual[$Key] -as [int]) -ne ($Expected[$Key] -as [int])) {
    throw "Awards count mismatch for $Key. expected=$($Expected[$Key]) live=$($Actual[$Key])"
  }
}

$SignalsText = Read-TextUrl "$BaseUrl/assets/external-signals.json?cacheBust=$CacheBust"
$Signals = $SignalsText | ConvertFrom-Json
$SourceIds = @($Signals.sourceCatalog | ForEach-Object { $_.id })
foreach ($RequiredSource in @("500bowl", "500sweet", "google-maps-reviews", "ifoodie", "openrice-tw", "tripadvisor-tw")) {
  if ($SourceIds -notcontains $RequiredSource) {
    throw "External signals sourceCatalog missing $RequiredSource"
  }
}

$ManualSignalsText = Read-TextUrl "$BaseUrl/assets/platform-signals.manual.json?cacheBust=$CacheBust"
$ManualSignals = $ManualSignalsText | ConvertFrom-Json
if ($ManualSignals.policy.runtimeExternalLookup -ne $false -or $ManualSignals.policy.batchOnly -ne $true) {
  throw "Manual platform signals must stay batch-only and disable runtime lookup"
}

$SweetManualText = Read-TextUrl "$BaseUrl/assets/500sweet-2025-manual.json?cacheBust=$CacheBust"
$SweetManual = $SweetManualText | ConvertFrom-Json
if ($SweetManual.policy.runtimeExternalLookup -ne $false -or $SweetManual.policy.batchOnly -ne $true) {
  throw "500sweet manual source must stay batch-only and disable runtime lookup"
}
$SweetReportText = Read-TextUrl "$BaseUrl/assets/500sweet-2025-source-report.json?cacheBust=$CacheBust"
$SweetReport = $SweetReportText | ConvertFrom-Json
if ($SweetReport.parseReady -ne $false -or $SweetReport.decision -ne "do_not_import") {
  throw "500sweet official source unexpectedly changed; review parser before importing"
}

[pscustomobject]@{
  ok = $true
  baseUrl = $BaseUrl
  version = $Version
  awards = $Actual
} | ConvertTo-Json -Compress

$ErrorActionPreference = "Stop"
$WarningPreference = "SilentlyContinue"

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

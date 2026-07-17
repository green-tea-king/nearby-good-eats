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

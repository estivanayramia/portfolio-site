[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$TestFile,
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$PlaywrightArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
$explicitBaseUrl = -not [string]::IsNullOrWhiteSpace($env:PLAYWRIGHT_BASE_URL)
$baseUrl = if ($explicitBaseUrl) { $env:PLAYWRIGHT_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:5500' }
$uri = [Uri]$baseUrl
$isLocalBaseUrl = @('localhost', '127.0.0.1', '::1') -contains $uri.Host.ToLowerInvariant()
$port = if ($uri.Port -gt 0) { $uri.Port } else { 5500 }
$probeUrl = "$baseUrl/"
$logPath = Join-Path $env:TEMP "portfolio-playwright-$PID.log"
$errorLogPath = Join-Path $env:TEMP "portfolio-playwright-$PID.err.log"
$serverProcess = $null
$exitCode = 1
$previousPort = $env:PORT

function Get-ReadyResponse {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $response }
  } catch { }
  return $null
}

function Test-RepoLocalResponse {
  param($Response)
  if ($null -eq $Response -or $Response.StatusCode -ne 200) { return $false }
  return ([string]$Response.Headers['X-Portfolio-Server']) -ceq 'local-serve'
}

try {
  $ready = $null
  $manageLocalServer = -not $explicitBaseUrl -or $isLocalBaseUrl
  if ($manageLocalServer) {
    $ready = Get-ReadyResponse -Url $probeUrl
    $canReuse = if ($explicitBaseUrl) { $null -ne $ready } else { Test-RepoLocalResponse -Response $ready }
  }
  if ($manageLocalServer -and -not $canReuse) {
    $env:PORT = [string]$port
    $serverProcess = Start-Process -FilePath $node -ArgumentList @('scripts/local-serve.js') -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath
    if ($null -eq $previousPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue } else { $env:PORT = $previousPort }
    $deadline = (Get-Date).AddSeconds(60)
    do {
      Start-Sleep -Milliseconds 200
      if ($serverProcess.HasExited) { throw "Local server exited before becoming ready (see $logPath and $errorLogPath)." }
      $ready = Get-ReadyResponse -Url $probeUrl
      $canReuse = if ($explicitBaseUrl) { $null -ne $ready } else { Test-RepoLocalResponse -Response $ready }
    } while (-not $canReuse -and (Get-Date) -lt $deadline)
    if (-not $canReuse) { throw "Local server did not become ready at $probeUrl (see $logPath and $errorLogPath)." }
  }

  $arguments = @('--no-install', 'playwright', 'test', $TestFile)
  if ($PlaywrightArgs) { $arguments += $PlaywrightArgs }
  & npx @arguments
  $exitCode = $LASTEXITCODE
}
finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $logPath) {
    Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $errorLogPath) {
    Remove-Item -LiteralPath $errorLogPath -Force -ErrorAction SilentlyContinue
  }
}

exit $exitCode

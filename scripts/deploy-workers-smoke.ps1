param(
  [switch]$SetSecrets,
  [switch]$Deploy,
  [switch]$Verify,
  [string]$ChatConfig = "worker/wrangler.chat.toml",
  [string]$DebuggerConfig = "worker/wrangler.debugger.toml"
)

$ErrorActionPreference = "Stop"

function Invoke-Step([string]$Label, [scriptblock]$Action) {
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $Action
}

function Require-RepoRoot {
  $root = (git rev-parse --show-toplevel 2>$null)
  if (-not $root) { throw "Not in a git repo." }
  Set-Location $root
}

function Put-Secret([string]$ConfigPath, [string]$SecretName) {
  $plain = $null

  # Prefer environment variable if present (avoids interactive prompts).
  if ($env:$SecretName) {
    $plain = [string]$env:$SecretName
  }

  if (-not $plain) {
    $secure = Read-Host -Prompt "Enter $SecretName" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
      if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
  }

  if (-not $plain) { throw "Empty secret." }

  # Pipe the secret to wrangler without echoing it.
  $plain | npx wrangler secret put $SecretName --config $ConfigPath | Out-Host
}

Require-RepoRoot

Invoke-Step "Dry-run: portfolio-chat" {
  npx wrangler deploy --config $ChatConfig --dry-run | Out-Host
}

Invoke-Step "Dry-run: portfolio-worker" {
  npx wrangler deploy --config $DebuggerConfig --dry-run | Out-Host
}

if ($SetSecrets) {
  Invoke-Step "Set secret: GEMINI_API_KEY (portfolio-chat)" {
    Put-Secret -ConfigPath $ChatConfig -SecretName "GEMINI_API_KEY"
  }

  Invoke-Step "Set secret: DASHBOARD_PASSWORD (portfolio-worker)" {
    Put-Secret -ConfigPath $DebuggerConfig -SecretName "DASHBOARD_PASSWORD"
  }
}

if ($Deploy) {
  Invoke-Step "Deploy: portfolio-chat" {
    npx wrangler deploy --config $ChatConfig | Out-Host
  }

  Invoke-Step "Deploy: portfolio-worker" {
    npx wrangler deploy --config $DebuggerConfig | Out-Host
  }
}

if ($Verify) {
  Invoke-Step "Verify: /api/health (custom domain)" {
    try {
      $r = Invoke-RestMethod -Uri "https://www.estivanayramia.com/api/health" -Method GET
      $r | ConvertTo-Json -Depth 8
    } catch {
      Write-Host $_.Exception.Message -ForegroundColor Yellow
      throw
    }
  }

  Invoke-Step "Verify: /api/chat (custom domain, GET should 400)" {
    try {
      $resp = Invoke-WebRequest -Uri "https://www.estivanayramia.com/api/chat" -Method GET -SkipHttpErrorCheck
      "HTTP $($resp.StatusCode)"
      $resp.Content
    } catch {
      Write-Host $_.Exception.Message -ForegroundColor Yellow
      throw
    }
  }
}

Write-Host "`nDone." -ForegroundColor Green
Write-Host "Examples:" -ForegroundColor Gray
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-workers-smoke.ps1" -ForegroundColor Gray
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-workers-smoke.ps1 -SetSecrets" -ForegroundColor Gray
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-workers-smoke.ps1 -SetSecrets -Deploy -Verify" -ForegroundColor Gray
Write-Host "  `$env:GEMINI_API_KEY='...' ; `$env:DASHBOARD_PASSWORD='...' ; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-workers-smoke.ps1 -SetSecrets -Deploy -Verify" -ForegroundColor Gray

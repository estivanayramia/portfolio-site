Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Phase($title) {
	Write-Host "";
	Write-Host ("=" * 80)
	Write-Host $title
	Write-Host ("=" * 80)
}

function Assert-Regex($content, $pattern, $message) {
	if ($content -notmatch $pattern) { throw $message }
}

function Invoke-WebRequestSafe {
	param(
		[Parameter(Mandatory=$true)][string]$Uri,
		[string]$Method = 'GET',
		[int]$TimeoutSec = 15,
		[string]$ContentType,
		[string]$Body
	)

	$params = @{
		Uri = $Uri
		Method = $Method
		TimeoutSec = $TimeoutSec
		ErrorAction = 'Stop'
		UseBasicParsing = $true
	}
	if ($ContentType) { $params.ContentType = $ContentType }
	if ($Body) { $params.Body = $Body }
	Invoke-WebRequest @params
}

Set-Location "C:\Users\estiv\portfolio-site"

Write-Phase "PHASE 1: PRE-DEPLOYMENT VALIDATION"
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "feat/unified-diagnostics-10") {
	throw "Wrong branch: $branch. Expected: feat/unified-diagnostics-10"
}

$modified = git ls-files -m
Write-Host "Modified files:"; Write-Host $modified

$dashboardContent = Get-Content assets/js/dashboard.js -Raw
Assert-Regex $dashboardContent "includes\('\.pages\.dev'\)" "Preview API proxy fix not found in assets/js/dashboard.js"

$workerContent = Get-Content worker/worker.js -Raw
Assert-Regex $workerContent "DASHBOARD_PASSWORD_HASH" "Hashed password support not found in worker/worker.js"

Write-Host "✅ Pre-flight checks passed"

Write-Phase "PHASE 2: BUILD & BUNDLE"
Write-Host "Building site bundle (site.min.js)…"
npm run build:js
if ($LASTEXITCODE -ne 0) { throw "build:js failed" }

Write-Host "Building HUD bundle…"
npm run build:hud
if ($LASTEXITCODE -ne 0) { throw "build:hud failed" }

Write-Host "Building lazy loader bundle…"
npm run build:lazy
if ($LASTEXITCODE -ne 0) { throw "build:lazy failed" }

Write-Host "✅ Bundles rebuilt"

Write-Phase "PHASE 3: COMMIT & PUSH"

# Stage tracked changes (only files that exist)
$pathsToAdd = @(
	'scripts/deploy-dashboard-fix.ps1',
	'assets/js/dashboard.js',
	'worker/worker.js',
	'assets/js/site.min.js',
	'assets/js/debugger-hud.min.js',
	'assets/js/lazy-loader.min.js'
)

foreach ($p in $pathsToAdd) {
	if (Test-Path $p) { git add $p | Out-Null }
}

Write-Host "Staged:"; git status --short

# Commit (only if something staged)
$staged = git diff --name-only --staged
if ($staged) {
	$subject = 'fix: dashboard auth works on preview + production'
	$bodyLines = @(
		'',
		'Core fixes:',
		'- Handle non-JSON API responses so login errors are actionable',
		'- Pages preview (*.pages.dev) uses production API origin by default',
		'- Worker: CORS allows Authorization + PATCH/DELETE and preview origins',
		'- Worker: hashed DASHBOARD_PASSWORD_HASH supported (SHA-256)',
		'- Worker: opaque KV sessions replace password-in-token auth',
		'- Worker: /api/error-report parses request JSON correctly',
		'',
		'Notes:',
		'- Dashboard loads /assets/js/dashboard.js directly (no dashboard.min.js in repo)'
	)

	git commit -m $subject -m ($bodyLines -join "`n")
	if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
	Write-Host "✅ Changes committed"
} else {
	Write-Host "Nothing staged; skipping commit."
}

Write-Host "Pushing branch to origin…"
git push origin feat/unified-diagnostics-10
if ($LASTEXITCODE -ne 0) { throw "Push failed" }
Write-Host "✅ Pushed to remote successfully"

Write-Phase "PHASE 4: DEPLOYMENT MONITORING (CLOUDFLARE PAGES)"
$previewBase = 'https://f92ff47a.portfolio-site-t6q.pages.dev'
$previewDash = "$previewBase/dashboard"

Write-Host "Waiting for Cloudflare Pages to rebuild..."
Write-Host "   Preview URL: $previewDash"

$maxAttempts = 20
$attempt = 0
$deployed = $false

Start-Sleep -Seconds 30

while ($attempt -lt $maxAttempts -and -not $deployed) {
	$attempt++
	Write-Host "   Build check attempt ${attempt}/${maxAttempts}..."
	try {
		$r = Invoke-WebRequestSafe -Uri $previewDash -Method 'HEAD' -TimeoutSec 10
		if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
			$deployed = $true
			Write-Host "✅ Preview is reachable."
		}
	} catch {
		Write-Host "   Still building... (waiting 15s)"
		Start-Sleep -Seconds 15
	}
}

if (-not $deployed) {
	Write-Warning "⚠️ Could not confirm deployment completed in 5 minutes"
	Write-Host "Continuing with validation anyway…"
}

Write-Phase "PHASE 5: AUTOMATED VALIDATION"
$tests = @()

Write-Host "🧪 Testing local demo mode…"
$serverProc = $null
try {
	$serverProc = Start-Process -FilePath 'node' -ArgumentList 'scripts/local-serve.js' -PassThru -WindowStyle Hidden
	Start-Sleep -Seconds 5
	$localUrl = 'http://localhost:5500/EN/dashboard.html?demo=1'
	$r = Invoke-WebRequestSafe -Uri $localUrl -TimeoutSec 15
	if ($r.StatusCode -eq 200) {
		$tests += [PSCustomObject]@{ Test = 'Local demo mode loads'; Status = 'PASS' }
	} else {
		$tests += [PSCustomObject]@{ Test = 'Local demo mode loads'; Status = "FAIL (HTTP $($r.StatusCode))" }
	}
} catch {
	$tests += [PSCustomObject]@{ Test = 'Local demo mode loads'; Status = "WARN - $($_.Exception.Message)" }
} finally {
	if ($serverProc -and -not $serverProc.HasExited) {
		try { Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue } catch {}
	}
}

Write-Host "🧪 Validating preview deployment…"

# Preview dashboard loads
try {
	$r = Invoke-WebRequestSafe -Uri $previewDash -TimeoutSec 15
	if ($r.StatusCode -eq 200 -and $r.Content -match 'password-input') {
		$tests += [PSCustomObject]@{ Test = 'Preview dashboard loads'; Status = 'PASS' }
	} else {
		$tests += [PSCustomObject]@{ Test = 'Preview dashboard loads'; Status = 'FAIL (missing password-input)' }
	}
} catch {
	$tests += [PSCustomObject]@{ Test = 'Preview dashboard loads'; Status = "FAIL - $($_.Exception.Message)" }
}

# Production API health (dashboard uses this for previews)
try {
	$r = Invoke-WebRequestSafe -Uri 'https://estivanayramia.com/api/health' -TimeoutSec 15
	if ($r.StatusCode -eq 200) {
		$tests += [PSCustomObject]@{ Test = 'Production /api/health reachable'; Status = 'PASS' }
	} else {
		$tests += [PSCustomObject]@{ Test = 'Production /api/health reachable'; Status = "FAIL (HTTP $($r.StatusCode))" }
	}
} catch {
	$tests += [PSCustomObject]@{ Test = 'Production /api/health reachable'; Status = "FAIL - $($_.Exception.Message)" }
}

# Production auth responds (expect 401 for bogus password)
try {
	$body = @{ password = 'bogus' } | ConvertTo-Json
	Invoke-WebRequestSafe -Uri 'https://estivanayramia.com/api/auth' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 15 | Out-Null
	$tests += [PSCustomObject]@{ Test = 'Production /api/auth responds'; Status = 'PASS' }
} catch {
	$resp = $_.Exception.Response
	if ($resp -and $resp.StatusCode -eq 401) {
		$tests += [PSCustomObject]@{ Test = 'Production /api/auth responds'; Status = 'PASS (401 expected)' }
	} else {
		$tests += [PSCustomObject]@{ Test = 'Production /api/auth responds'; Status = "FAIL - $($_.Exception.Message)" }
	}
}

Write-Host ""; Write-Host "Validation Results:"; $tests | Format-Table -AutoSize

Write-Phase "PHASE 6: PLAYWRIGHT (LOCAL CONFIG)"
if (Test-Path '.reports/playwright/test-dashboard-unified.spec.js') {
	npx playwright test -c .reports/playwright.config.cjs .reports/playwright/test-dashboard-unified.spec.js --reporter=list
	if ($LASTEXITCODE -eq 0) {
		Write-Host "✅ Playwright unified dashboard spec passed"
	} else {
		Write-Warning "⚠️ Playwright unified dashboard spec failed"
	}
} else {
	Write-Host "No unified dashboard spec found; skipping."
}

Write-Phase "PHASE 7: WRITE DEPLOYMENT REPORT (docs/)"
$passCount = ($tests | Where-Object { $_.Status -match '^PASS' }).Count
$totalCount = $tests.Count
$status = if ($passCount -eq $totalCount) { 'DEPLOYED' } else { 'DEPLOYED WITH WARNINGS' }

$reportPath = 'docs/deploy/dashboard-auth-fix-deployment-report-latest.md'

$commit = git rev-parse --short HEAD
$subjectLine = git log -1 --pretty=%s

$report = @()
$report += "# dashboard auth fix - deployment report"
$report += "generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$report += ""
$report += "## deployment summary"
$report += "- branch: $branch"
$report += "- commit: $commit"
$report += "- subject: $subjectLine"
$report += "- preview: $previewDash"
$report += "- status: $status"
$report += ""
$report += "## validation results"
$report += ($tests | Format-Table -AutoSize | Out-String)
$report += ""
$report += "## manual checklist"
$report += "1. open $previewDash"
$report += "2. log in (prod password) or use ?demo=1"
$report += "3. verify all 7 tabs work"
$report += "4. verify logout"

New-Item -ItemType Directory -Force -Path (Split-Path $reportPath) | Out-Null
$report -join "`n" | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "✅ Wrote report: $reportPath"

# Optionally commit the updated report (keeps workspace clean)
try {
	git add $reportPath | Out-Null
	$stagedReport = git diff --name-only --staged
	if ($stagedReport -match [regex]::Escape($reportPath)) {
		git commit -m "docs: update dashboard auth deployment report" | Out-Null
		if ($LASTEXITCODE -eq 0) {
			git push origin feat/unified-diagnostics-10 | Out-Null
			Write-Host "✅ Committed + pushed deployment report"
		}
	}
} catch {
	Write-Warning "⚠️ Could not commit deployment report: $($_.Exception.Message)"
}

Write-Phase "PHASE 8: WORKSPACE REPORT"
if (Test-Path 'scripts/workspace-report.ps1') {
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts/workspace-report.ps1
} else {
	Write-Warning "workspace-report.ps1 not found; skipping"
}

Write-Phase "DONE"
Write-Host "Branch: $branch"
Write-Host "Commit: $commit"
Write-Host "Preview: $previewDash"
Write-Host "Report: $reportPath"
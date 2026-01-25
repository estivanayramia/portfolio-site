# Deployment Verification Script (Dynamic)
# - Fetches live HTML from both domains
# - Extracts core asset URLs with ?v=... cache busting
# - HEADs those assets and prints key headers

$ErrorActionPreference = 'Continue'

function Get-FirstMatch {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Pattern
    )

    $m = [regex]::Match($Text, $Pattern)
    if ($m.Success) { return $m.Value }
    return $null
}

function Fetch-Html {
    param(
        [Parameter(Mandatory = $true)][string]$Url
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        return $resp.Content
    } catch {
        Write-Host "✗ HTML fetch failed: $Url" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Head-Url {
    param(
        [Parameter(Mandatory = $true)][string]$Url
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop

        $headers = $resp.Headers
        Write-Host "✓ $Url" -ForegroundColor Green
        Write-Host "  Status: $($resp.StatusCode)"
        Write-Host "  Content-Type: $($headers['Content-Type'])"
        Write-Host "  Cache-Control: $($headers['Cache-Control'])"
        if ($headers['CF-Cache-Status']) { Write-Host "  CF-Cache-Status: $($headers['CF-Cache-Status'])" }
        if ($headers['Age']) { Write-Host "  Age: $($headers['Age'])" }
        if ($headers['ETag']) { Write-Host "  ETag: $($headers['ETag'])" }
        return $headers
    } catch {
        Write-Host "✗ $Url" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    } finally {
        Write-Host ""
    }
}

Write-Host "=== DEPLOYMENT VERIFICATION (DYNAMIC) ===" -ForegroundColor Cyan
Write-Host ""

$domains = @(
    @{ name = 'pages.dev'; html = 'https://portfolio-site-t6q.pages.dev/' },
    @{ name = 'www'; html = 'https://www.estivanayramia.com/' }
)

$assetPatterns = @{
    style = '/assets/css/style\.css\?v=[A-Za-z0-9_-]+';
    site = '/assets/js/site\.min\.js\?v=[A-Za-z0-9_-]+';
    lazy = '/assets/js/lazy-loader\.min\.js\?v=[A-Za-z0-9_-]+';
}

foreach ($d in $domains) {
    Write-Host "--- $($d.name) ---" -ForegroundColor Yellow
    Write-Host "HTML: $($d.html)" -ForegroundColor Gray

    $html = Fetch-Html -Url $d.html
    if (-not $html) {
        Write-Host "Skipping asset checks for $($d.name) (no HTML)" -ForegroundColor Red
        Write-Host ""
        continue
    }

    $stylePath = Get-FirstMatch -Text $html -Pattern $assetPatterns.style
    $sitePath = Get-FirstMatch -Text $html -Pattern $assetPatterns.site
    $lazyPath = Get-FirstMatch -Text $html -Pattern $assetPatterns.lazy

    Write-Host "Discovered asset refs:" -ForegroundColor Gray
    Write-Host "  style: $stylePath"
    Write-Host "  site:  $sitePath"
    Write-Host "  lazy:  $lazyPath"
    Write-Host ""

    if ($stylePath) { Head-Url -Url ("{0}{1}" -f ($d.html.TrimEnd('/')), $stylePath) }
    if ($sitePath) { Head-Url -Url ("{0}{1}" -f ($d.html.TrimEnd('/')), $sitePath) }
    if ($lazyPath) { Head-Url -Url ("{0}{1}" -f ($d.html.TrimEnd('/')), $lazyPath) }
}

Write-Host "=== VERIFICATION COMPLETE ===" -ForegroundColor Cyan

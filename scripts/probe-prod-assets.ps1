# Probe Production Assets - Cache Poison Detection
# Tests both domains to verify MIME types and detect cache poisoning

$ErrorActionPreference = 'Continue'

$bases = @(
    'https://portfolio-site-t6q.pages.dev',
    'https://www.estivanayramia.com'
)

$assets = @(
    '/assets/js/site.min.js',
    '/assets/js/lazy-loader.min.js',
    '/assets/css/style.css',
    '/theme.css'
)

Write-Output "PRODUCTION ASSETS PROBE - CACHE POISON DETECTION"
Write-Output "================================================="
Write-Output "Date: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')"
Write-Output ""

foreach ($base in $bases) {
    Write-Output ""
    Write-Output "BASE: $base"
    Write-Output "$(('=' * 70))"
    Write-Output ""
    
    foreach ($asset in $assets) {
        $url = "$base$asset"
        Write-Output "Asset: $asset"
        Write-Output "URL: $url"
        
        # Test 1: Normal request
        Write-Output ""
        Write-Output "TEST 1: Normal request (may be cached)"
        Write-Output "---------------------------------------"
        try {
            $headers = @{
                'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -Headers $headers -MaximumRedirection 0 -ErrorAction Stop
            Write-Output "Status: $($response.StatusCode)"
            Write-Output "Content-Type: $($response.Headers['Content-Type'])"
            Write-Output "Cache-Control: $($response.Headers['Cache-Control'])"
            Write-Output "CF-Cache-Status: $($response.Headers['CF-Cache-Status'])"
            Write-Output "Age: $($response.Headers['Age'])"
            Write-Output "ETag: $($response.Headers['ETag'])"
        } catch {
            Write-Output "ERROR: $($_.Exception.Message)"
        }
        
        # Test 2: Cache bypass attempt
        Write-Output ""
        Write-Output "TEST 2: Cache bypass (no-cache headers)"
        Write-Output "----------------------------------------"
        try {
            $headers = @{
                'Cache-Control' = 'no-cache'
                'Pragma' = 'no-cache'
                'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -Headers $headers -MaximumRedirection 0 -ErrorAction Stop
            Write-Output "Status: $($response.StatusCode)"
            Write-Output "Content-Type: $($response.Headers['Content-Type'])"
            Write-Output "Cache-Control: $($response.Headers['Cache-Control'])"
            Write-Output "CF-Cache-Status: $($response.Headers['CF-Cache-Status'])"
            Write-Output "Age: $($response.Headers['Age'])"
            Write-Output "ETag: $($response.Headers['ETag'])"
        } catch {
            Write-Output "ERROR: $($_.Exception.Message)"
        }
        
        Write-Output ""
        Write-Output "$(('-' * 70))"
        Write-Output ""
    }
}

Write-Output ""
Write-Output "ANALYSIS"
Write-Output "========"
Write-Output "Look for:"
Write-Output "  - Content-Type: text/html for JS/CSS assets (POISON!)"
Write-Output "  - CF-Cache-Status: HIT on poisoned responses"
Write-Output "  - Cache-Control with long max-age on assets"
Write-Output "  - Differences between *.pages.dev and custom domain"

# Deployment Verification Script
# Run this after merging the PR and deploying to production

Write-Host "=== DEPLOYMENT VERIFICATION ===" -ForegroundColor Cyan
Write-Host ""

# Test assets on preview domain
Write-Host "Testing preview domain (portfolio-site-t6q.pages.dev)..." -ForegroundColor Yellow
$previewAssets = @(
    "https://portfolio-site-t6q.pages.dev/assets/css/style.css",
    "https://portfolio-site-t6q.pages.dev/assets/js/site.min.js",
    "https://portfolio-site-t6q.pages.dev/assets/js/lazy-loader.min.js"
)

foreach ($url in $previewAssets) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -ErrorAction Stop
        $contentType = $response.Headers['Content-Type']
        $cacheControl = $response.Headers['Cache-Control']
        Write-Host "✓ $url" -ForegroundColor Green
        Write-Host "  Content-Type: $contentType"
        Write-Host "  Cache-Control: $cacheControl"
    } catch {
        Write-Host "✗ $url - FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)"
    }
    Write-Host ""
}

# Test assets on production domain
Write-Host "Testing production domain (www.estivanayramia.com)..." -ForegroundColor Yellow
$prodAssets = @(
    "https://www.estivanayramia.com/assets/css/style.css",
    "https://www.estivanayramia.com/assets/js/site.min.js",
    "https://www.estivanayramia.com/assets/js/lazy-loader.min.js"
)

foreach ($url in $prodAssets) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -ErrorAction Stop
        $contentType = $response.Headers['Content-Type']
        $cacheControl = $response.Headers['Cache-Control']
        $cfCacheStatus = $response.Headers['CF-Cache-Status']
        Write-Host "✓ $url" -ForegroundColor Green
        Write-Host "  Content-Type: $contentType"
        Write-Host "  Cache-Control: $cacheControl"
        Write-Host "  CF-Cache-Status: $cfCacheStatus"
    } catch {
        Write-Host "✗ $url - FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)"
    }
    Write-Host ""
}

Write-Host "=== VERIFICATION COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected results:" -ForegroundColor Yellow
Write-Host "- Assets: Content-Type should be text/css or application/javascript"
Write-Host "- Assets: Cache-Control should typically include max-age=0, must-revalidate (unless you intentionally use immutable fingerprinting)"
Write-Host ""
Write-Host "If all tests pass, the cache poison issue is fixed!" -ForegroundColor Green

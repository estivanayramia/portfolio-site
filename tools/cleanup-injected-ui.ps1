# One-off script to remove injected scroll-to-top and chat widget blocks from MiniGames
# These blocks were accidentally injected by update_site_html.ps1

$files = @()

# Get all MiniGames index.html files
$files += Get-ChildItem -Path "assets\MiniGames" -Recurse -Filter "index.html" | Select-Object -ExpandProperty FullName

# Add the two arcade wrapper pages
$files += "en\hobbies-games\pizza-undelivery.html"
$files += "en\hobbies-games\xx142-b2exe.html"

$cleaned = 0

foreach ($filePath in $files) {
    if (-not (Test-Path $filePath)) {
        Write-Host "Skipping missing file: $filePath" -ForegroundColor Yellow
        continue
    }

    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    $modified = $false

    # Remove scroll-to-top button block (including the comment through </button>)
    if ($content -match '(?s)(\s*<!-- Scroll to Top Button -->.*?<button[^>]*id="scroll-to-top".*?</button>\s*)') {
        Write-Host "Removing scroll button from: $filePath" -ForegroundColor Cyan
        $content = $content -replace '(?s)\s*<!-- Scroll to Top Button -->.*?<button[^>]*id="scroll-to-top".*?</button>\s*', ''
        $modified = $true
    }

    # Remove chat widget block (from comment through lazy-loader script)
    if ($content -match '(?s)(\s*<!-- Savonie AI Chat Widget -->.*?<script src="/assets/js/lazy-loader\.js" defer></script>\s*)') {
        Write-Host "Removing chat widget from: $filePath" -ForegroundColor Cyan
        $content = $content -replace '(?s)\s*<!-- Savonie AI Chat Widget -->.*?<script src="/assets/js/lazy-loader\.js" defer></script>\s*', ''
        $modified = $true
    }

    if ($modified) {
        Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
        $cleaned++
        Write-Host "Cleaned: $filePath" -ForegroundColor Green
    } else {
        Write-Host "No injected blocks found in: $filePath" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Cleaned $cleaned files" -ForegroundColor Green

$root = "c:\Users\estiv\portfolio-site\assets\MiniGames"
$files = Get-ChildItem $root -Recurse -Filter "index.html"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content

    # Remove the arcade-ui div
    $content = $content -replace '<div id="arcade-ui"[\s\S]*?</div>', ""
    
    # Remove the arcade-ui style
    $content = $content -replace '<style>\s*#arcade-ui[\s\S]*?</style>', ""
    
    # Remove the togglePause script
    $content = $content -replace '<script>\s*function togglePause\(\)[\s\S]*?</script>', ""

    # Remove the AudioContext/message listener script
    $content = $content -replace '<script>\s*\(function\(\) \{\s*var originalAudioContext[\s\S]*?\}\)\(\);\s*</script>', ""

    if ($content -ne $originalContent) {
        Set-Content $file.FullName $content
        Write-Host "Cleaned $($file.FullName)"
    }
}

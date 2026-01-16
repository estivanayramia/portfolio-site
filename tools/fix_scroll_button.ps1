
$files = Get-ChildItem -Path . -Recurse -Filter "*.html" | Where-Object { $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch ".git" }

$newButton = '    <!-- Scroll to Top Button -->
    <button id="scroll-to-top" aria-label="Back to top" role="button" tabindex="0">
        <svg class="scroll-progress-ring" width="47" height="47" viewBox="0 0 47 47" style="position: absolute; top: 0; left: 0;">
            <circle cx="23.5" cy="23.5" r="22" fill="none" stroke="currentColor" stroke-width="3" opacity="0.2"></circle>
            <circle cx="23.5" cy="23.5" r="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="scroll-progress-circle" style="transform: rotate(-90deg); transform-origin: center center; stroke-dasharray: 138.23; stroke-dashoffset: 138.23;"></circle>
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 1;">
            <path d="M18 15l-6-6-6 6"/>
        </svg>
    </button>'

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    # Regex to find the existing button block, loosely matching from the comment or button tag
    # We look for the comment or the button tag, and capture until the closing button tag.
    # Pattern: Optional comment, whitespace, button start, content, button end.
    
    if ($content -match '(?s)(<!-- Scroll to Top Button -->\s*)?<button[^>]*id="scroll-to-top".*?<\/button>') {
        Write-Host "Updating $($file.Name)"
        $content = $content -replace '(?s)(<!-- Scroll to Top Button -->\s*)?<button[^>]*id="scroll-to-top".*?<\/button>', $newButton
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    } else {
        Write-Host "Skipping $($file.Name) - Button not found"
    }
}


try {
    # 1. capture the valid widget HTML from en/index.html (Source of Truth)
    $indexContent = Get-Content -Path "en/index.html" -Raw -Encoding UTF8
    
    $buttonHtml = '    <!-- Scroll to Top Button -->
    <button id="scroll-to-top" aria-label="Back to top" aria-describedby="scroll-to-top-tooltip" role="button" tabindex="0">
        <svg class="scroll-progress-ring" width="47" height="47" viewBox="0 0 47 47" style="position: absolute; top: 0; left: 0;">
            <circle cx="23.5" cy="23.5" r="22" fill="none" stroke="currentColor" stroke-width="3" opacity="0.2"></circle>
            <circle cx="23.5" cy="23.5" r="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="scroll-progress-circle" style="transform: rotate(-90deg); transform-origin: center center; stroke-dasharray: 138.23; stroke-dashoffset: 138.23;"></circle>
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 1;">
            <path d="M18 15l-6-6-6 6"/>
        </svg>
        <div id="scroll-to-top-tooltip" class="scroll-to-top-btn-tooltip">Back to top</div>
    </button>'
    
    # Extract the Chat Widget Block using Regex.
    if ($indexContent -match '(?s)(<!-- Savonie AI Chat Widget -->.*<script src="/assets/js/lazy-loader.js" defer><\/script>)') {
        $chatWidgetHtml = $matches[1]
    } else {
        Write-Error "Could not find Chat Widget template in index.html"
        exit 1
    }

    # Enhanced filter to include subfolders properly
    $files = Get-ChildItem -Path . -Recurse -Filter "*.html" | Where-Object { 
        $_.FullName -notmatch "node_modules" -and 
        $_.FullName -notmatch ".git" -and
        $_.FullName -notmatch "backup" -and
        $_.FullName -notmatch "docs\\" -and
        $_.FullName -notmatch "assets\\css" -and
        $_.FullName -notmatch "assets\\js" -and
        $_.FullName -notmatch "assets\\MiniGames\\" -and
        $_.FullName -notmatch "en\\hobbies-games\\"
    }

    foreach ($file in $files) {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        $modified = $false
        
        # 1. Update Scroll Button
        # We look for the button tag specifically. We optionally consume the comment if it's there to avoid duplication.
        if ($content -match '(?s)(\s*<!-- Scroll to Top Button -->\s*)?<button[^>]*id="scroll-to-top".*?<\/button>') {
            Write-Host "Updating Scroll Button in $($file.FullName)"
            $content = $content -replace '(?s)(\s*<!-- Scroll to Top Button -->\s*)?<button[^>]*id="scroll-to-top".*?<\/button>', $buttonHtml
            $modified = $true
        } elseif ($content -match '</body>') {
             # Inject if missing, IF it seems to be a main page
             if ($content -match '<main' -or $content -match 'id="site-wrapper"' -or $content -match 'class="container"') {
                 Write-Host "Injecting missing Scroll Button into $($file.FullName)"
                 $content = $content -replace '</body>', "$buttonHtml`n</body>"
                 $modified = $true
             }
        }

        # 2. Inject Chat Widget if missing
        if ($content -notmatch 'id="chat-widget"' -and $content -match '</body>') {
            # Inject only if it looks like a valid page
             if ($content -match '<main' -or $content -match 'id="site-wrapper"' -or $content -match 'class="container"') {
                Write-Host "Injecting Chat Widget into $($file.FullName)"
                $content = $content -replace '</body>', "$chatWidgetHtml`n</body>"
                $modified = $true
             }
        }

        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        }
    }
} catch {
    Write-Error $_
}

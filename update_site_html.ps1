try {
    # 1. capture the valid widget HTML from index.html (Source of Truth)
    $indexContent = Get-Content -Path "index.html" -Raw -Encoding UTF8
    
    # Extract existing scroll button including tooltip if present (to replicate exactly if we wanted, but we have a NEW string to enforce)
    # We will use the hardcoded new string for scroll button to ENFORCE the tooltip restoration.
    
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
    # It starts with <!-- Savonie AI Chat Widget --> and ends with the lazy loader script
    if ($indexContent -match '(?s)(<!-- Savonie AI Chat Widget -->.*<script src="/assets/js/lazy-loader.js" defer><\/script>)') {
        $chatWidgetHtml = $matches[1]
    } else {
        Write-Error "Could not find Chat Widget template in index.html"
        exit 1
    }

    $files = Get-ChildItem -Path . -Recurse -Filter "*.html" | Where-Object { 
        $_.FullName -notmatch "node_modules" -and 
        $_.FullName -notmatch ".git" -and
        $_.FullName -notmatch "ar\\" -and
        $_.FullName -notmatch "es\\"
    }

    foreach ($file in $files) {
        if ($file.Name -like "*backup*") { continue }
        
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        $modified = $false
        
        # 1. Update Scroll Button
        # Matches existing button block to replace it
        if ($content -match '(?s)(<!-- Scroll to Top Button -->\s*)?<button[^>]*id="scroll-to-top".*?<\/button>') {
            Write-Host "Updating Scroll Button in $($file.Name)"
            $content = $content -replace '(?s)(<!-- Scroll to Top Button -->\s*)?<button[^>]*id="scroll-to-top".*?<\/button>', $buttonHtml
            $modified = $true
        }

        # 2. Inject Chat Widget if missing
        # We look for the ID. If not found, we append before </body>
        if ($content -notmatch 'id="chat-widget"' -and $content -match '</body>') {
            Write-Host "Injecting Chat Widget into $($file.Name)"
            $content = $content -replace '</body>', "$chatWidgetHtml`n</body>"
            $modified = $true
        }

        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        }
    }
} catch {
    Write-Error $_
}

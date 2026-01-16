$files = Get-ChildItem "c:\Users\estiv\portfolio-site\hobbies-games" -Filter "*.html"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # 1. Remove buttons div
    $content = $content -replace '(?s)<div style="margin-left: auto; display: flex; gap: 10px;">.*?</div>', ""
    
    # 2. Fix Header Text
    # Replace arrow (â†)
    $content = $content -replace 'â†', '&#8592;'
    
    # Remove garbage in h1. 
    # We'll replace <h1 class="game-title">GARBAGE Title</h1> with <h1 class="game-title">Title</h1>
    $content = $content -replace '(<h1 class="game-title">)[^<a-zA-Z0-9]+([a-zA-Z0-9])', '$1$2'
    
    # 3. Remove Script logic
    $content = $content -replace '(?s)let isGamePaused = false;.*?toggleGamePause\(\);.*?\}\s*\}\);', ''
    
    # 4. Add Scrollbar CSS
    $scrollbarCss = "
    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: rgba(33, 40, 66, 0.1); }
    ::-webkit-scrollbar-thumb { background: rgba(54, 32, 23, 0.5); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(54, 32, 23, 0.8); }
"
    if ($content -notmatch "::-webkit-scrollbar") {
        $content = $content -replace '</style>', "$scrollbarCss`n  </style>"
    }
    
    # 5. Ensure scrolling
    if ($content -match 'body \{ margin: 0; padding: 0; background: #212842; \}') {
        $content = $content -replace 'body \{ margin: 0; padding: 0; background: #212842; \}', 'body { margin: 0; padding: 0; background: #212842; overflow-y: auto; }'
    }

    Set-Content $file.FullName $content -Encoding UTF8
    Write-Host "Processed $($file.Name)"
}

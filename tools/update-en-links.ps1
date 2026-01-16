# Script to update all internal links in /en/ folder to use /en/ paths
$enFolder = "c:\Users\estiv\portfolio-site\en"

# Get all HTML files in /en/ folder recursively
$htmlFiles = Get-ChildItem -Path $enFolder -Filter "*.html" -Recurse

$replacements = @{
    'href="/index.html"' = 'href="/en/"'
    'href="/"' = 'href="/en/"'
    'href="/index"' = 'href="/en/"'
    'href="/about.html"' = 'href="/en/about"'
    'href="/about"' = 'href="/en/about"'
    'href="/contact.html"' = 'href="/en/contact"'
    'href="/contact"' = 'href="/en/contact"'
    'href="/overview.html"' = 'href="/en/overview"'
    'href="/overview"' = 'href="/en/overview"'
    'href="/deep-dive.html"' = 'href="/en/deep-dive"'
    'href="/deep-dive"' = 'href="/en/deep-dive"'
    'href="/privacy.html"' = 'href="/en/privacy"'
    'href="/privacy"' = 'href="/en/privacy"'
    'href="/hobbies-games.html"' = 'href="/en/hobbies-games"'
    'href="/hobbies-games"' = 'href="/en/hobbies-games"'
    'href="/projects.html"' = 'href="/en/projects/"'
    'href="/projects/"' = 'href="/en/projects/"'
    'href="/projects"' = 'href="/en/projects/"'
    'href="/hobbies.html"' = 'href="/en/hobbies/"'
    'href="/hobbies/"' = 'href="/en/hobbies/"'
    'href="/hobbies"' = 'href="/en/hobbies/"'
    'href="/projects/' = 'href="/en/projects/'
    'href="/hobbies/' = 'href="/en/hobbies/'
    'href="/hobbies-games/' = 'href="/en/hobbies-games/'
}

Write-Host "Processing $($htmlFiles.Count) HTML files in /en/ folder..."
$totalReplacements = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileReplacements = 0
    
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        if ($content -match [regex]::Escape($pattern)) {
            $content = $content -replace [regex]::Escape($pattern), $replacement
            $fileReplacements++
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $totalReplacements += $fileReplacements
        Write-Host "  Updated: $($file.FullName) ($fileReplacements replacements)"
    }
}

Write-Host "`nDone! Total replacements: $totalReplacements"
Write-Host "All internal links in /en/ folder now point to /en/ paths."

$files = Get-ChildItem "c:\Users\estiv\portfolio-site\hobbies-games" -Filter "*.html"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Fix Arrow: Match any character before " Arcade Zone" inside the <a> tag
    # We replace whatever is between the opening tag and " Arcade Zone" with the HTML entity for left arrow.
    $content = $content -replace '(<a href="/hobbies-games\.html" class="back-link" aria-label="Back to Arcade Zone">).*?( Arcade Zone</a>)', '$1&#8592;$2'

    Set-Content $file.FullName $content -Encoding UTF8
    Write-Host "Refined fix for $($file.Name)"
}

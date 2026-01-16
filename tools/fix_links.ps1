$files = Get-ChildItem -Path . -Recurse -Filter *.html

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content

    # Main pages
    $content = $content -replace 'href="/about"', 'href="/about.html"'
    $content = $content -replace 'href="/contact"', 'href="/contact.html"'
    $content = $content -replace 'href="/projects"', 'href="/projects.html"'
    $content = $content -replace 'href="/hobbies-games"', 'href="/hobbies-games.html"'
    $content = $content -replace 'href="/deep-dive"', 'href="/deep-dive.html"'
    $content = $content -replace 'href="/overview"', 'href="/overview.html"'
    $content = $content -replace 'href="/privacy"', 'href="/privacy.html"'
    
    # Hobbies subpages
    $content = $content -replace 'href="/hobbies/car"', 'href="/hobbies/car.html"'
    $content = $content -replace 'href="/hobbies/cooking"', 'href="/hobbies/cooking.html"'
    $content = $content -replace 'href="/hobbies/gym"', 'href="/hobbies/gym.html"'
    $content = $content -replace 'href="/hobbies/photography"', 'href="/hobbies/photography.html"'
    $content = $content -replace 'href="/hobbies/reading"', 'href="/hobbies/reading.html"'
    $content = $content -replace 'href="/hobbies/whispers"', 'href="/hobbies/whispers.html"'
    
    # Hobbies index - handle both /hobbies and /hobbies/ if they don't have index.html
    # Be careful not to double replace if I run this multiple times or if it matches substrings
    # Using regex with word boundaries or specific quotes helps
    
    # Replace href="/hobbies" but not href="/hobbies/" or href="/hobbies/..."
    $content = $content -replace 'href="/hobbies"', 'href="/hobbies/index.html"'
    # If it was already /hobbies/, make it /hobbies/index.html for consistency
    $content = $content -replace 'href="/hobbies/"', 'href="/hobbies/index.html"'

    # Game subpages (in case they are linked without .html)
    $content = $content -replace 'href="/hobbies-games/1024-moves"', 'href="/hobbies-games/1024-moves.html"'
    $content = $content -replace 'href="/hobbies-games/nano-wirebot"', 'href="/hobbies-games/nano-wirebot.html"'
    $content = $content -replace 'href="/hobbies-games/off-the-line"', 'href="/hobbies-games/off-the-line.html"'
    $content = $content -replace 'href="/hobbies-games/oh-flip"', 'href="/hobbies-games/oh-flip.html"'
    $content = $content -replace 'href="/hobbies-games/onoff"', 'href="/hobbies-games/onoff.html"'
    $content = $content -replace 'href="/hobbies-games/pizza-undelivery"', 'href="/hobbies-games/pizza-undelivery.html"'
    $content = $content -replace 'href="/hobbies-games/racer"', 'href="/hobbies-games/racer.html"'
    $content = $content -replace 'href="/hobbies-games/the-matr13k"', 'href="/hobbies-games/the-matr13k.html"'
    $content = $content -replace 'href="/hobbies-games/triangle-back-to-home"', 'href="/hobbies-games/triangle-back-to-home.html"'
    $content = $content -replace 'href="/hobbies-games/xx142-b2exe"', 'href="/hobbies-games/xx142-b2exe.html"'

    # Fix any double .html extensions if I messed up (e.g. .html.html)
    $content = $content -replace '\.html\.html', '.html'

    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated $($file.Name)"
    }
}

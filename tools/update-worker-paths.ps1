# Script to update worker.js with /en/ paths
$workerFile = "c:\Users\estiv\portfolio-site\worker\worker.js"

$content = Get-Content $workerFile -Raw -Encoding UTF8

# Replace all /projects/ with /en/projects/
$content = $content -replace '"/projects/', '"/en/projects/'

# Replace all /hobbies/ with /en/hobbies/
$content = $content -replace '"/hobbies/', '"/en/hobbies/'

# Replace all /contact references
$content = $content -replace '"/contact"', '"/en/contact"'
$content = $content -replace '"/contact\]', '"/en/contact]'

# Save the file
Set-Content -Path $workerFile -Value $content -Encoding UTF8 -NoNewline

Write-Host "Updated worker.js with /en/ paths"
Write-Host "All /projects/ → /en/projects/"
Write-Host "All /hobbies/ → /en/hobbies/"
Write-Host "All /contact → /en/contact"

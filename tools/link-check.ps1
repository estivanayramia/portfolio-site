param(
    [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$knownRoutes = @(
    "/assets/",
    "/ar/",
    "/es/",
    "/manifest.json",
    "/sw.js",
    "/robots.txt",
    "/sitemap.xml",
    "/index.html",
    "/",
    "/privacy.html"
)

$files = Get-ChildItem -Path $RootPath -Filter *.html -File | Where-Object { $_.DirectoryName -eq $RootPath }

$missing = @()

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $matches = [regex]::Matches($content, 'href\s*=\s*"([^"]+)"', 'IgnoreCase')

    foreach ($match in $matches) {
        $href = $match.Groups[1].Value.Trim()
        if (-not $href) { continue }

        # Skip externals and anchors
        if ($href -match '^(http|https|mailto:|tel:|javascript:|#)') { continue }

        $resolvedPath = $null
        $logicalHref = $href

        if ($href.StartsWith('/')) {
            if ($href -eq '/') { $logicalHref = '/index.html' }
            elseif ($href.EndsWith('/')) { $logicalHref = "$href/index.html" }

            $isKnown = $knownRoutes | Where-Object { $logicalHref.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) }
            if ($isKnown) { continue }

            $resolvedPath = Join-Path $RootPath ($logicalHref.TrimStart('/'))
        } else {
            if ($href.EndsWith('/')) {
                $logicalHref = "$href/index.html"
            } else {
                $logicalHref = $href
            }
            $resolvedPath = Join-Path $file.DirectoryName $logicalHref
        }

        if (-not (Test-Path -LiteralPath $resolvedPath)) {
            $missing += [pscustomobject]@{
                Source = (Resolve-Path $file.FullName -Relative)
                Href   = $href
                Resolved = $resolvedPath
            }
        }
    }
}

if ($missing.Count -eq 0) {
    Write-Output "No missing links found."
} else {
    $missing | Sort-Object Source, Href | Format-Table -AutoSize
}

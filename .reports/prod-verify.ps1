# Production verification for cache-busting theme.css + SW version
# Keeps output small and deterministic.

$ErrorActionPreference = 'Stop'

$bases = @(
  'https://www.estivanayramia.com',
  'https://estivanayramia.com'
)

$expectedVersion = 'v20260119-5'

function Get-Url {
  param(
    [Parameter(Mandatory=$true)][string]$Url
  )

  $current = $Url
  for ($i = 0; $i -lt 10; $i++) {
    try {
      return Invoke-WebRequest -Uri $current -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'Pragma'        = 'no-cache'
      }
    } catch {
      $resp = $_.Exception.Response
      if ($null -ne $resp) {
        try {
          $status = [int]$resp.StatusCode
        } catch {
          $status = -1
        }

        if ($status -in 301, 302, 303, 307, 308) {
          $location = $resp.Headers['Location']
          if ([string]::IsNullOrWhiteSpace($location)) { throw }

          if ($location.StartsWith('/')) {
            $baseUri = [Uri]$current
            $current = "{0}://{1}{2}" -f $baseUri.Scheme, $baseUri.Host, $location
          } else {
            $current = $location
          }

          continue
        }
      }

      throw
    }
  }

  throw "Too many redirects while fetching: $Url"
}

function Get-HeaderValue {
  param(
    [Parameter(Mandatory=$true)]$Response,
    [Parameter(Mandatory=$true)][string]$HeaderName
  )

  try {
    $val = $Response.Headers[$HeaderName]
    if ($null -eq $val) { return '' }
    return [string]$val
  } catch {
    return ''
  }
}

$overallOk = $true

foreach ($base in $bases) {
  Write-Output "=== BASE: $base ==="

  # 1) Contact check
  $contact = Get-Url "$base/contact"
  $contactStatus = [int]$contact.StatusCode
  $contactFinal = [string]$contact.BaseResponse.ResponseUri.AbsoluteUri
  Write-Output "contact.status: $contactStatus"
  Write-Output "contact.final:  $contactFinal"

  if ($contactStatus -ne 200) { $overallOk = $false }

  # 2) Resolve the theme.css URL exactly as shipped in EN pages
  $enContact = Get-Url "$base/EN/contact.html"
  $enHtml = [string]$enContact.Content

  $themeMatch = [regex]::Match($enHtml, 'href="(?<href>/assets/css/theme\.css\?v=[^"]+)"')
  if (-not $themeMatch.Success) {
    Write-Output "theme.link:   FAIL (no versioned theme.css link found)"
    $overallOk = $false
    Write-Output ""
    continue
  }

  $themePath = $themeMatch.Groups['href'].Value
  $themeUrl = "$base$themePath"
  Write-Output "theme.url:    $themeUrl"

  $theme = Get-Url $themeUrl
  $cc = (Get-HeaderValue -Response $theme -HeaderName 'Cache-Control').ToLowerInvariant()
  $hasWebkit = ($theme.Content -match '-webkit-text-fill-color')
  $ccHasImmutable = ($cc -match 'immutable') -or ($cc -match 'max-age=31536000')

  Write-Output "theme.cache-control: $cc"
  Write-Output ("theme.has-webkit-text-fill-color: " + ($hasWebkit))
  Write-Output ("theme.cache-control.bad(immutable/1y): " + ($ccHasImmutable))

  if (-not $hasWebkit) { $overallOk = $false }
  if ($ccHasImmutable) { $overallOk = $false }

  # 3) SW check
  $sw = Get-Url "$base/sw.js"
  $swHasVersion = ($sw.Content -match "const\s+CACHE_VERSION\s*=\s*'$expectedVersion';")
  Write-Output ("sw.has-cache-version($expectedVersion): " + ($swHasVersion))

  if (-not $swHasVersion) { $overallOk = $false }

  Write-Output ""
}

if ($overallOk) {
  Write-Output 'PASS'
  exit 0
}

Write-Output 'FAIL'
exit 1

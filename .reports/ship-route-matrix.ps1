param(
  [string]$PagesBase = 'https://portfolio-site-t6q.pages.dev',
  [string]$OutFileName = 'route.matrix.txt'
)

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\estiv\portfolio-site'

function Get-RunId {
  $latest = '.reports\_latest'
  if (-not (Test-Path $latest)) { throw 'Missing .reports/_latest' }
  $id = (Get-Content $latest -Raw).Trim()
  if (-not $id) { throw 'Empty RUN_ID in .reports/_latest' }
  return $id
}

function Normalize-Base([string]$base) {
  $b = $base
  if ($null -eq $b) { $b = '' }
  $b = $b.Trim()
  if (-not $b) { return $b }
  return $b.TrimEnd('/')
}

function Parse-Hops([string[]]$lines) {
  $hops = @()
  $current = $null

  foreach ($line in $lines) {
    if ($line -match '^HTTP/\S+\s+\d+') {
      if ($null -ne $current) { $hops += $current }
      $current = [ordered]@{ status = $line.Trim(); location = '' }
      continue
    }

    if ($null -ne $current -and -not $current.location) {
      if ($line -match '^(?i)Location:\s*(.+)$') {
        $current.location = $Matches[1].Trim()
      }
    }
  }

  if ($null -ne $current) { $hops += $current }
  return $hops
}

function Write-Line([string]$path, [string]$line) {
  $line | Out-File -Encoding utf8 -Append $path
}

function Invoke-Curl([string]$receipt, [string]$title, [string[]]$curlArgs) {
  Write-Line $receipt ''
  Write-Line $receipt ('=' * 80)
  Write-Line $receipt $title
  Write-Line $receipt ('> curl.exe ' + ($curlArgs -join ' '))
  Write-Line $receipt ('=' * 80)

  $oldEap = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $lines = & curl.exe @curlArgs 2>&1 | ForEach-Object { $_.ToString() }
  } finally {
    $ErrorActionPreference = $oldEap
  }

  $exit = $LASTEXITCODE
  $hops = Parse-Hops $lines

  Write-Line $receipt ("EXIT_CODE=$exit")
  Write-Line $receipt ("HOPS=$($hops.Count)")
  for ($i = 0; $i -lt $hops.Count; $i++) {
    $loc = $hops[$i].location
    if (-not $loc) { $loc = '(none)' }
    Write-Line $receipt ("hop[$i] $($hops[$i].status) | Location: $loc")
  }

  Write-Line $receipt ''
  Write-Line $receipt '--- RAW ---'
  foreach ($l in $lines) { Write-Line $receipt $l }
}

$runId = Get-RunId
$routingDir = Join-Path (Join-Path '.reports' $runId) 'routing'
New-Item -ItemType Directory -Force -Path $routingDir | Out-Null

$receipt = Join-Path $routingDir $OutFileName
Remove-Item -Force $receipt -ErrorAction SilentlyContinue

$pages = Normalize-Base $PagesBase
$targets = @(
  @{ name = 'pages.dev'; base = $pages },
  @{ name = 'www'; base = 'https://www.estivanayramia.com' },
  @{ name = 'apex'; base = 'https://estivanayramia.com' }
)

$followPaths = @(
  '/',
  '/about',
  '/projects/',
  '/hobbies/',
  '/overview',
  '/EN/404.html'
)

Write-Line $receipt ("RUN_ID=$runId")
Write-Line $receipt ("DATE=$(Get-Date -Format o)")
Write-Line $receipt ("PAGES_BASE=$pages")
Write-Line $receipt ''

foreach ($t in $targets) {
  $name = $t.name
  $base = Normalize-Base $t.base

  Write-Line $receipt ''
  Write-Line $receipt ("# TARGET $name => $base")

  Invoke-Curl $receipt "${name}: HEAD / (no-follow)" @('-sS','-D','-','-o','NUL','-I',"$base/")

  foreach ($p in $followPaths) {
    $url = "$base$p"
    Invoke-Curl $receipt "${name}: GET $p (follow)" @('-sS','-L','--max-redirs','25','-D','-','-o','NUL',$url)
  }
}

Write-Host ("WROTE $receipt")

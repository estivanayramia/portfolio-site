# PowerShell script to extract failing color-contrast selectors from Lighthouse JSON
$reportPath = "lighthouse-results/desktop-projects.report.json"
$json = Get-Content $reportPath -Raw | ConvertFrom-Json
$audit = $json.audits.'color-contrast'
if (-not $audit) { Write-Error 'No color-contrast audit found'; exit 1 }
$items = $audit.details.items
Write-Host "color-contrast failing items: $($items.Count)"
foreach ($it in $items | Select-Object -First 25) {
  $n = $it.node
  Write-Host "\n---"
  if ($n.selector) { Write-Host "selector: $($n.selector)" }
  if ($n.snippet) { Write-Host ("snippet: " + ($n.snippet -replace '\s+', ' ').Substring(0, [Math]::Min(200, $n.snippet.Length))) }
  if ($it.contrastRatio) { Write-Host "ratio: $($it.contrastRatio)" }
}

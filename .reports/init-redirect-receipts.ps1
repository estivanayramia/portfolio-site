$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\estiv\portfolio-site'

function New-RunId {
  $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
  $rand = -join ((48..57) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
  return "$ts-$rand"
}

$runId = New-RunId
$latestPath = '.reports/_latest'
$redirectDir = Join-Path (Join-Path '.reports' $runId) 'redirect'

New-Item -ItemType Directory -Force -Path $redirectDir | Out-Null
$runId | Out-File -Encoding utf8 $latestPath

$pre = Join-Path $redirectDir 'git.pre.txt'
'' | Out-File -Encoding utf8 $pre

'RUN_ID: ' + $runId | Out-File -Encoding utf8 -Append $pre
'DATE: ' + (Get-Date -Format o) | Out-File -Encoding utf8 -Append $pre
'' | Out-File -Encoding utf8 -Append $pre

'NOTE: Branch created from origin/main because local main could not pull (unrelated histories).' | Out-File -Encoding utf8 -Append $pre
'' | Out-File -Encoding utf8 -Append $pre

'COMMAND: git branch --show-current' | Out-File -Encoding utf8 -Append $pre
(cmd /c "git branch --show-current 2>&1") | Out-File -Encoding utf8 -Append $pre
'' | Out-File -Encoding utf8 -Append $pre

'COMMAND: git rev-parse --short HEAD' | Out-File -Encoding utf8 -Append $pre
(cmd /c "git rev-parse --short HEAD 2>&1") | Out-File -Encoding utf8 -Append $pre
'' | Out-File -Encoding utf8 -Append $pre

'COMMAND: git status -sb' | Out-File -Encoding utf8 -Append $pre
(cmd /c "git status -sb 2>&1") | Out-File -Encoding utf8 -Append $pre
'' | Out-File -Encoding utf8 -Append $pre

'COMMAND: git log -1 --oneline' | Out-File -Encoding utf8 -Append $pre
(cmd /c "git log -1 --oneline 2>&1") | Out-File -Encoding utf8 -Append $pre
'' | Out-File -Encoding utf8 -Append $pre

Write-Host "RUN_ID=$runId"
Write-Host "Wrote: $pre"

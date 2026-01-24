$ErrorActionPreference = 'Stop'

Set-Location 'c:\Users\estiv\portfolio-site'

$runId = (Get-Content '.reports/_latest' -Raw).Trim()
if (-not $runId) { throw 'Missing .reports/_latest RUN_ID' }

$outDir = Join-Path (Join-Path '.reports' $runId) 'savonie'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Invoke-Step([string]$label, [string]$commandLine, [string]$outFileName) {
    $outFile = Join-Path $outDir $outFileName
    $header = @(
        "=== $label ===",
        "COMMAND: $commandLine",
        ""
    ) -join "`n"

    $output = cmd /c "$commandLine 2>&1" | Out-String
    $exit = $LASTEXITCODE

    ($header + $output.TrimEnd() + "`n") | Out-File -Encoding utf8 $outFile

    return @{ Label = $label; Command = $commandLine; File = $outFile; Exit = $exit }
}

$results = @()

$results += Invoke-Step 'Intent tests' 'npm run -s test:intents' 'intent.tests.txt'
$results += Invoke-Step 'Chat logic tests' 'node scripts/test_chat_logic.mjs' 'chat.logic.tests.txt'
$results += Invoke-Step 'Build facts' 'npm run -s build:facts' 'build.facts.txt'
$results += Invoke-Step 'Test facts' 'npm run -s test:facts' 'test.facts.txt'

# Transcripts (after)
$afterFile = Join-Path $outDir 'after.transcripts.txt'
cmd /c "node .reports/savonie-transcripts.mjs 2>&1" | Out-File -Encoding utf8 $afterFile
$afterExit = $LASTEXITCODE
$results += @{ Label = 'After transcripts'; Command = 'node .reports/savonie-transcripts.mjs'; File = $afterFile; Exit = $afterExit }

# Verify summary
$verifyFile = Join-Path $outDir 'verify.txt'
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('SAVONIE POSTFLIGHT VERIFY')
$lines.Add("RUN_ID: $runId")
$lines.Add('')

$hadFail = $false
foreach ($r in $results) {
    $ok = ($r.Exit -eq 0)
    if (-not $ok) { $hadFail = $true }
    $status = if ($ok) { 'PASS' } else { 'FAIL' }
    $lines.Add("${status}: $($r.Label) -> $($r.File)")
}

$lines.Add('')
$lines.Add('Notes:')
$lines.Add('- verify.txt is a summary; individual receipts contain full stdout/stderr')

$lines | Out-File -Encoding utf8 $verifyFile

if ($hadFail) {
    throw "Postflight failed. See $verifyFile for summary and the referenced receipt files for details."
}

Write-Host "Wrote: $verifyFile"

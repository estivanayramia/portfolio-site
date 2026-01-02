[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Cutoff,

    [switch]$Apply,

    # Print the restore plan as untruncated full-path lines:
    # TargetFullPath | SnapshotTimeLocal | SnapshotId | SnapshotFullPath
    [switch]$FullPaths,

    # Print verification checks after the plan:
    # - Plans count
    # - Duplicate target detection
    # - Top 10 newest/oldest snapshots (by timestamp)
    [switch]$Verify,

    # Suppress large console output (full plan + skip table). Useful with -EmitReport.
    [switch]$Quiet,

    # Write an unwrapped, verification-grade report to disk (does not APPLY):
    # - <ReportDir>\restore-history-report-<timestamp>.txt
    # - <ReportDir>\restore-history-plan-<timestamp>.csv
    [switch]$EmitReport,

    # Output directory for -EmitReport (relative to workspace root unless absolute)
    [string]$ReportDir = '.vscode_restore_reports'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FullPath {
    param([Parameter(Mandatory=$true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Is-StrictlyUnderRoot {
    param(
        [Parameter(Mandatory=$true)][string]$RootFull,
        [Parameter(Mandatory=$true)][string]$CandidateFull
    )

    $root = $RootFull.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $cand = $CandidateFull
    return $cand.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)
}

function Safe-ParseJsonFile {
    param([Parameter(Mandatory=$true)][string]$Path)

    try {
        $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
        if (-not $raw) { return $null }
        return $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return $null
    }
}

function Try-UriToLocalPath {
    param([Parameter(Mandatory=$true)][object]$Resource)

    try {
        if ($null -eq $Resource) { return $null }

        function Normalize-FileLikePath {
            param([Parameter(Mandatory=$true)][string]$Value)

            $s = $Value.Trim()
            if (-not $s) { return $null }

            # VS Code sometimes stores a file path-like string as:
            #   /c:/Users/...  (leading slash + drive)
            #   c:/Users/...   (forward slashes)
            #   C:\Users\...  (native)
            if ($s -match '^/[A-Za-z]:/') {
                $s = $s.Substring(1)
            }

            if ($s -match '^[A-Za-z]:/') {
                $s = $s -replace '/', '\\'
            }

            if ($s -match '^[A-Za-z]:\\') {
                return $s
            }

            return $null
        }

        # If entries.json has multiple resources, prefer the first one we can resolve.
        if ($Resource -is [System.Collections.IEnumerable] -and -not ($Resource -is [string])) {
            foreach ($r in $Resource) {
                $p = Try-UriToLocalPath -Resource $r
                if ($p) { return $p }
            }
            return $null
        }

        # entries.json commonly has { resource: "file:///..." }
        $resourceString = $null
        if ($Resource -is [string]) {
            $resourceString = $Resource
        } elseif ($Resource.PSObject.Properties.Name -contains 'path') {
            $resourceString = [string]$Resource.path
        } elseif ($Resource.PSObject.Properties.Name -contains 'fsPath') {
            $resourceString = [string]$Resource.fsPath
        } else {
            $resourceString = [string]$Resource.ToString()
        }

        if (-not $resourceString) { return $null }

        if ($resourceString.StartsWith('file:', [System.StringComparison]::OrdinalIgnoreCase)) {
            $uri = [System.Uri]::new($resourceString)
            $local = [string]$uri.LocalPath
            $normalizedLocal = Normalize-FileLikePath -Value $local
            if ($normalizedLocal) { return $normalizedLocal }
            return $local
        }

        $normalized = Normalize-FileLikePath -Value $resourceString
        if ($normalized) { return $normalized }

        return $null
    } catch {
        return $null
    }
}

function Is-ExcludedTarget {
    param([Parameter(Mandatory=$true)][string]$TargetRel)

    $rel = $TargetRel.Replace('/', '\\').Trim()
    if ($rel -match '^(?:\.git\\)') { return $true }
    if ($rel -match '^scripts\\restore-vscode-history\.ps1$') { return $true }
    if ($rel -match '^(?:\.vscode_restore_backup\\)') { return $true }
    return $false
}

# ------------------------------
# Parse cutoff as DateTimeOffset (do not guess timezone)
# ------------------------------
$cutoffDto = [DateTimeOffset]::Parse($Cutoff)
$cutoffMs = $cutoffDto.ToUnixTimeMilliseconds()

$workspaceRoot = Get-FullPath (Get-Location).Path
$localTz = [TimeZoneInfo]::Local

$reportTxtPath = $null
$reportCsvPath = $null

# ------------------------------
# Detect history roots
# ------------------------------
$historyRoots = @()
$codeHistory = Join-Path $env:APPDATA 'Code\User\History'
$insidersHistory = Join-Path $env:APPDATA 'Code - Insiders\User\History'
if (Test-Path -LiteralPath $codeHistory) { $historyRoots += (Get-FullPath $codeHistory) }
if (Test-Path -LiteralPath $insidersHistory) { $historyRoots += (Get-FullPath $insidersHistory) }

Write-Host '=== VS Code Local History Restore (DRY RUN by default) ==='
Write-Host ("Workspace root:          {0}" -f $workspaceRoot)
Write-Host ("Detected local TZ:       {0} ({1})" -f $localTz.Id, $localTz.DisplayName)
Write-Host ("Cutoff ISO (input):      {0}" -f $Cutoff)
Write-Host ("Cutoff (epoch ms):       {0}" -f $cutoffMs)
Write-Host ("Cutoff (local time):     {0}" -f $cutoffDto.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss zzz'))
Write-Host ("History roots found:     {0}" -f ($historyRoots.Count))
$historyRoots | ForEach-Object { Write-Host ("  - {0}" -f $_) }

if ($historyRoots.Count -eq 0) {
    throw "No VS Code History roots found under APPDATA. Looked for: $codeHistory and $insidersHistory"
}

# ------------------------------
# Build restore candidates from all entries.json
# ------------------------------
$plansByTarget = @{}  # targetFull -> plan object
$skips = New-Object System.Collections.Generic.List[object]

foreach ($root in $historyRoots) {
    $entriesFiles = Get-ChildItem -LiteralPath $root -Recurse -Filter 'entries.json' -File -ErrorAction SilentlyContinue

    foreach ($entriesFile in $entriesFiles) {
        $json = Safe-ParseJsonFile -Path $entriesFile.FullName
        if (-not $json) {
            $skips.Add([pscustomobject]@{ Reason='invalid-json'; EntriesJson=$entriesFile.FullName })
            continue
        }

        $resource = $null
        if ($json.PSObject.Properties.Name -contains 'resource') {
            $resource = $json.resource
        } elseif ($json.PSObject.Properties.Name -contains 'resources') {
            $resource = $json.resources
        }

        $targetLocal = Try-UriToLocalPath -Resource $resource
        if (-not $targetLocal) {
            $skips.Add([pscustomobject]@{ Reason='unsupported-resource-uri'; EntriesJson=$entriesFile.FullName; Target=([string]$resource) })
            continue
        }

        $targetFull = $null
        try {
            $targetFull = Get-FullPath $targetLocal
        } catch {
            $skips.Add([pscustomobject]@{ Reason='invalid-target-path'; EntriesJson=$entriesFile.FullName; Target=$targetLocal })
            continue
        }

        if (-not (Is-StrictlyUnderRoot -RootFull $workspaceRoot -CandidateFull $targetFull)) {
            $skips.Add([pscustomobject]@{ Reason='outside-workspace'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        if (-not ($json.PSObject.Properties.Name -contains 'entries')) {
            $skips.Add([pscustomobject]@{ Reason='missing-entries-array'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        $entries = $json.entries
        if (-not $entries) {
            $skips.Add([pscustomobject]@{ Reason='empty-entries-array'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        # Pick newest entry with timestamp <= cutoffMs
        $eligible = @()
        foreach ($e in $entries) {
            try {
                $id = [string]$e.id
                $ts = [Int64]$e.timestamp
                if ($id -and $ts -le $cutoffMs) {
                    $eligible += [pscustomobject]@{ Id=$id; TimestampMs=$ts }
                }
            } catch {
                # ignore malformed entries
            }
        }

        if ($eligible.Count -eq 0) {
            $skips.Add([pscustomobject]@{ Reason='no-entry-before-cutoff'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        $best = $eligible | Sort-Object TimestampMs -Descending | Select-Object -First 1

        # Resolve snapshot path: try <id><extension> then <id>
        $folder = Split-Path -Parent $entriesFile.FullName
        $ext = [System.IO.Path]::GetExtension($targetFull)
        $snap1 = Join-Path $folder ($best.Id + $ext)
        $snap2 = Join-Path $folder $best.Id

        $snapshotPath = $null
        if (Test-Path -LiteralPath $snap1) {
            $snapshotPath = $snap1
        } elseif (Test-Path -LiteralPath $snap2) {
            $snapshotPath = $snap2
        } else {
            $skips.Add([pscustomobject]@{ Reason='snapshot-missing'; EntriesJson=$entriesFile.FullName; Target=$targetFull; Id=$best.Id; Tried1=$snap1; Tried2=$snap2 })
            continue
        }

        $plan = [pscustomobject]@{
            TargetFull      = $targetFull
            TargetRel       = $targetFull.Substring($workspaceRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
            SnapshotId      = $best.Id
            SnapshotMs      = [Int64]$best.TimestampMs
            SnapshotLocal   = ([DateTimeOffset]::FromUnixTimeMilliseconds([Int64]$best.TimestampMs)).ToLocalTime()
            SnapshotPath    = (Get-FullPath $snapshotPath)
            EntriesJsonPath = $entriesFile.FullName
        }

        if (Is-ExcludedTarget -TargetRel $plan.TargetRel) {
            $skips.Add([pscustomobject]@{ Reason='excluded-path'; EntriesJson=$entriesFile.FullName; Target=$plan.TargetRel })
            continue
        }

        # Dedupe: keep newest snapshot per target
        if ($plansByTarget.ContainsKey($targetFull)) {
            $existing = $plansByTarget[$targetFull]
            if ($plan.SnapshotMs -gt $existing.SnapshotMs) {
                $plansByTarget[$targetFull] = $plan
            }
        } else {
            $plansByTarget[$targetFull] = $plan
        }
    }
}

$plans = $plansByTarget.Values | Sort-Object SnapshotMs -Descending

Write-Host ''
Write-Host ("Planned restores (count): {0}" -f $plans.Count)

if ($plans.Count -gt 0) {
    if ($Quiet) {
        # Intentionally suppress the full plan output. Use -EmitReport to capture full paths.
    } elseif ($FullPaths) {
        Write-Host ''
        Write-Host 'TargetFullPath | SnapshotTimeLocal | SnapshotId | SnapshotFullPath'
        foreach ($p in $plans) {
            Write-Host ("{0} | {1} | {2} | {3}" -f $p.TargetFull, $p.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'), $p.SnapshotId, $p.SnapshotPath)
        }
    } else {
        $table = $plans | Select-Object `
            @{n='Target File'; e={$_.TargetRel}}, `
            @{n='Snapshot Time (Local)'; e={$_.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz')}}, `
            @{n='Snapshot ID'; e={$_.SnapshotId}}, `
            @{n='Snapshot Path'; e={$_.SnapshotPath}}

        # Make output verifiable and less truncated
        $table | Format-Table -AutoSize | Out-String -Width 4000 | Write-Host
    }
}

if ($Verify) {
    Write-Host ''
    Write-Host '=== Verification ==='
    Write-Host ("Plans count: {0}" -f (@($plans).Count))

    $dupes = @($plans | Group-Object -Property TargetFull | Where-Object { $_.Count -gt 1 })
    Write-Host ("Duplicate Targets (count): {0}" -f (@($dupes).Count))
    if ((@($dupes).Count) -gt 0) {
        Write-Host 'Duplicate target paths:'
        foreach ($g in $dupes) {
            Write-Host ("{0} (x{1})" -f $g.Name, $g.Count)
        }
    }

    $newest = $plans | Sort-Object SnapshotMs -Descending | Select-Object -First 10
    $oldest = $plans | Sort-Object SnapshotMs | Select-Object -First 10

    Write-Host ''
    Write-Host 'Top 10 newest snapshots (by timestamp):'
    foreach ($p in $newest) {
        Write-Host ("{0} | {1} | {2} | {3}" -f $p.TargetFull, $p.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'), $p.SnapshotId, $p.SnapshotPath)
    }

    Write-Host ''
    Write-Host 'Top 10 oldest snapshots (by timestamp):'
    foreach ($p in $oldest) {
        Write-Host ("{0} | {1} | {2} | {3}" -f $p.TargetFull, $p.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'), $p.SnapshotId, $p.SnapshotPath)
    }
}

if ($EmitReport) {
    $stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')

    $reportDirFull = $ReportDir
    if (-not [System.IO.Path]::IsPathRooted($reportDirFull)) {
        $reportDirFull = Join-Path $workspaceRoot $ReportDir
    }
    $reportDirFull = Get-FullPath $reportDirFull
    if (-not (Is-StrictlyUnderRoot -RootFull $workspaceRoot -CandidateFull $reportDirFull)) {
        throw "Refusing to write report outside workspace root: $reportDirFull"
    }
    New-Item -ItemType Directory -Force -Path $reportDirFull | Out-Null

    $reportTxtPath = Join-Path $reportDirFull ("restore-history-report-{0}.txt" -f $stamp)
    $reportCsvPath = Join-Path $reportDirFull ("restore-history-plan-{0}.csv" -f $stamp)

    $lines = New-Object System.Collections.Generic.List[string]

    $lines.Add('=== VS Code Local History Restore (DRY RUN by default) ===')
    $lines.Add(("Workspace root:          {0}" -f $workspaceRoot))
    $lines.Add(("Detected local TZ:       {0} ({1})" -f $localTz.Id, $localTz.DisplayName))
    $lines.Add(("Cutoff ISO (input):      {0}" -f $Cutoff))
    $lines.Add(("Cutoff (epoch ms):       {0}" -f $cutoffMs))
    $lines.Add(("Cutoff (local time):     {0}" -f $cutoffDto.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss zzz')))
    $lines.Add(("History roots found:     {0}" -f ($historyRoots.Count)))
    foreach ($r in $historyRoots) { $lines.Add(("  - {0}" -f $r)) }

    $lines.Add('')
    $lines.Add(("Planned restores (count): {0}" -f $plans.Count))
    if ($plans.Count -gt 0) {
        $lines.Add('')
        $lines.Add('TargetFullPath | SnapshotTimeLocal | SnapshotId | SnapshotFullPath')
        foreach ($p in $plans) {
            $lines.Add(("{0} | {1} | {2} | {3}" -f $p.TargetFull, $p.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'), $p.SnapshotId, $p.SnapshotPath))
        }
    }

    if ($Verify) {
        $lines.Add('')
        $lines.Add('=== Verification ===')
        $lines.Add(("Plans count: {0}" -f (@($plans).Count)))
        $dupes = @($plans | Group-Object -Property TargetFull | Where-Object { $_.Count -gt 1 })
        $lines.Add(("Duplicate Targets (count): {0}" -f (@($dupes).Count)))
        if ((@($dupes).Count) -gt 0) {
            $lines.Add('Duplicate target paths:')
            foreach ($g in $dupes) { $lines.Add(("{0} (x{1})" -f $g.Name, $g.Count)) }
        }

        $newest = $plans | Sort-Object SnapshotMs -Descending | Select-Object -First 10
        $oldest = $plans | Sort-Object SnapshotMs | Select-Object -First 10

        $lines.Add('')
        $lines.Add('Top 10 newest snapshots (by timestamp):')
        foreach ($p in $newest) {
            $lines.Add(("{0} | {1} | {2} | {3}" -f $p.TargetFull, $p.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'), $p.SnapshotId, $p.SnapshotPath))
        }

        $lines.Add('')
        $lines.Add('Top 10 oldest snapshots (by timestamp):')
        foreach ($p in $oldest) {
            $lines.Add(("{0} | {1} | {2} | {3}" -f $p.TargetFull, $p.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'), $p.SnapshotId, $p.SnapshotPath))
        }
    }

    $lines.Add('')
    $lines.Add(("Skipped items (count):   {0}" -f $skips.Count))
    if ($skips.Count -gt 0) {
        $lines.Add('Reason | EntriesJson | Target | Id | Tried1 | Tried2')
        foreach ($s in $skips) {
            $reason = if ($s.PSObject.Properties.Name -contains 'Reason') { [string]$s.Reason } else { '' }
            $entriesJson = if ($s.PSObject.Properties.Name -contains 'EntriesJson') { [string]$s.EntriesJson } else { '' }
            $target = if ($s.PSObject.Properties.Name -contains 'Target') { [string]$s.Target } else { '' }
            $id = if ($s.PSObject.Properties.Name -contains 'Id') { [string]$s.Id } else { '' }
            $tried1 = if ($s.PSObject.Properties.Name -contains 'Tried1') { [string]$s.Tried1 } else { '' }
            $tried2 = if ($s.PSObject.Properties.Name -contains 'Tried2') { [string]$s.Tried2 } else { '' }
            $lines.Add(("{0} | {1} | {2} | {3} | {4} | {5}" -f $reason, $entriesJson, $target, $id, $tried1, $tried2))
        }
    }

    if (-not $Apply) {
        $lines.Add('')
        $lines.Add('DRY RUN complete. No files were modified.')
        $lines.Add('To apply: .\\scripts\\restore-vscode-history.ps1 -Cutoff <iso> -Apply')
    }

    Set-Content -LiteralPath $reportTxtPath -Value $lines -Encoding UTF8
    $plans | Select-Object TargetFull, TargetRel, SnapshotLocal, SnapshotId, SnapshotPath, EntriesJsonPath | Export-Csv -LiteralPath $reportCsvPath -NoTypeInformation -Encoding UTF8
}

Write-Host ("Skipped items (count):   {0}" -f $skips.Count)
if ($skips.Count -gt 0) {
    if (-not $Quiet) {
        $skips | Select-Object -First 200 | Format-Table -AutoSize | Out-String -Width 4000 | Write-Host
        if ($skips.Count -gt 200) {
            Write-Host ("(Showing first 200 skips; total skips: {0})" -f $skips.Count)
        }
    } elseif (-not $EmitReport) {
        Write-Host '(Use -EmitReport to write full skip details to disk.)'
    }
}

if (-not $Apply) {
    Write-Host ''
    Write-Host 'DRY RUN complete. No files were modified.'
    if ($EmitReport -and $reportTxtPath -and $reportCsvPath) {
        Write-Host ("Report written:          {0}" -f $reportTxtPath)
        Write-Host ("Plan CSV written:        {0}" -f $reportCsvPath)
    }
    Write-Host "To apply: .\scripts\restore-vscode-history.ps1 -Cutoff <iso> -Apply"
    exit 0
}

# ------------------------------
# APPLY MODE
# ------------------------------
$backupStamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backupRoot = Join-Path $workspaceRoot (".vscode_restore_backup\\{0}" -f $backupStamp)
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$overwritten = 0
foreach ($p in $plans) {
    # Safety: ensure still inside root
    if (-not (Is-StrictlyUnderRoot -RootFull $workspaceRoot -CandidateFull $p.TargetFull)) {
        $skips.Add([pscustomobject]@{ Reason='apply-outside-workspace'; Target=$p.TargetFull })
        continue
    }

    $destDir = Split-Path -Parent $p.TargetFull
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }

    # Backup existing destination (if present)
    $backupPath = Join-Path $backupRoot $p.TargetRel
    $backupDir = Split-Path -Parent $backupPath
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    if (Test-Path -LiteralPath $p.TargetFull) {
        Copy-Item -LiteralPath $p.TargetFull -Destination $backupPath -Force
    } else {
        # Create an empty marker file to indicate file didn't exist
        Set-Content -LiteralPath ($backupPath + '.missing') -Value "Missing at restore time: $($p.TargetRel)" -Encoding UTF8
    }

    # Overwrite destination with snapshot
    Copy-Item -LiteralPath $p.SnapshotPath -Destination $p.TargetFull -Force
    $overwritten++
}

Write-Host ''
Write-Host ("APPLY complete. Backup root: {0}" -f $backupRoot)
Write-Host ("Files overwritten:        {0}" -f $overwritten)
Write-Host ''
Write-Host 'Rollback instructions:'
Write-Host '  Copy files from the backup folder back over the workspace, preserving relative paths:'
Write-Host ("  Backup folder: {0}" -f $backupRoot)

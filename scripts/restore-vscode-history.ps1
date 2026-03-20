[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Cutoff,

    [switch]$Apply,

    [switch]$Verify,

    [switch]$Quiet,

    [switch]$EmitReport,

    [string]$ReportDir = '.vscode_restore_reports',

    # Build a narrow, safety-first plan using near-cutoff windows.
    [switch]$NarrowNearCutoff,

    # Minimum candidate count before widening the window.
    [int]$MinNarrowCandidates = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FullPath {
    param([Parameter(Mandatory=$true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Get-CanonicalPath {
    param([Parameter(Mandatory=$true)][string]$Path)

    $full = Get-FullPath $Path
    if (Test-Path -LiteralPath $full) {
        try {
            return (Resolve-Path -LiteralPath $full).Path
        } catch {
            return $full
        }
    }

    return $full
}

function Get-NormalizedPathKey {
    param([Parameter(Mandatory=$true)][string]$Path)

    $canonical = Get-CanonicalPath $Path
    $normalized = $canonical.Replace('/', '\\').TrimEnd('\\')
    return $normalized.ToLowerInvariant()
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

        if ($Resource -is [System.Collections.IEnumerable] -and -not ($Resource -is [string])) {
            foreach ($r in $Resource) {
                $p = Try-UriToLocalPath -Resource $r
                if ($p) { return $p }
            }
            return $null
        }

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
    if ($rel -match '^(?:\.vscode_restore_reports\\)') { return $true }
    return $false
}

function Try-GetGitMetadata {
    param([Parameter(Mandatory=$true)][string]$WorkspaceRoot)

    $result = [ordered]@{
        IsRepo = $false
        StatusByRelLower = @{}
        DiffByRelLower = @{}
        UntrackedByRelLower = @{}
        DeletedByRelLower = @{}
    }

    try {
        $null = & git -C $WorkspaceRoot rev-parse --is-inside-work-tree 2>$null
        if ($LASTEXITCODE -ne 0) {
            return [pscustomobject]$result
        }
        $result.IsRepo = $true

        $statusOutput = & git -C $WorkspaceRoot status --porcelain=v1 --untracked-files=all
        foreach ($line in $statusOutput) {
            if (-not $line) { continue }
            if ($line.Length -lt 4) { continue }
            $code = $line.Substring(0, 2)
            $pathPart = $line.Substring(3)

            $rawPath = $pathPart
            if ($pathPart -match ' -> ') {
                $rawPath = ($pathPart -split ' -> ')[-1]
            }

            $normalizedRel = $rawPath.Replace('/', '\\').Trim()
            $key = $normalizedRel.ToLowerInvariant()
            $result.StatusByRelLower[$key] = $code

            if ($code -eq '??') {
                $result.UntrackedByRelLower[$key] = $true
            }

            if ($code[1] -eq 'D' -or $code[0] -eq 'D') {
                $result.DeletedByRelLower[$key] = $true
            }
        }

        $diffOutput = & git -C $WorkspaceRoot diff --name-only HEAD
        foreach ($line in $diffOutput) {
            if (-not $line) { continue }
            $key = $line.Replace('/', '\\').Trim().ToLowerInvariant()
            $result.DiffByRelLower[$key] = $true
        }

        return [pscustomobject]$result
    } catch {
        return [pscustomobject]$result
    }
}

function Get-WindowAnchors {
    param([Parameter(Mandatory=$true)][DateTimeOffset]$CutoffLocal)

    $dateLocal = $CutoffLocal.Date

    $start18 = [DateTimeOffset]::new($dateLocal.AddHours(18), $CutoffLocal.Offset)
    $start12 = [DateTimeOffset]::new($dateLocal.AddHours(12), $CutoffLocal.Offset)
    $start48 = $CutoffLocal.AddHours(-48)

    return [pscustomobject]@{
        Start18 = $start18
        Start12 = $start12
        Start48 = $start48
        End = $CutoffLocal
    }
}

function Get-HoursBeforeCutoff {
    param(
        [Parameter(Mandatory=$true)][Int64]$CutoffMs,
        [Parameter(Mandatory=$true)][Int64]$SnapshotMs
    )

    $deltaMs = $CutoffMs - $SnapshotMs
    if ($deltaMs -lt 0) { $deltaMs = 0 }
    return [Math]::Round(($deltaMs / 1000.0 / 60.0 / 60.0), 3)
}

$cutoffDto = [DateTimeOffset]::Parse($Cutoff)
$cutoffLocal = $cutoffDto.ToLocalTime()
$cutoffMs = $cutoffDto.ToUnixTimeMilliseconds()

$workspaceRoot = Get-CanonicalPath (Get-Location).Path
$workspaceKey = Get-NormalizedPathKey $workspaceRoot
$localTz = [TimeZoneInfo]::Local

$reportTxtPath = $null
$reportCsvPath = $null

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
Write-Host ("Cutoff (local time):     {0}" -f $cutoffLocal.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Write-Host ("History roots found:     {0}" -f ($historyRoots.Count))
$historyRoots | ForEach-Object { Write-Host ("  - {0}" -f $_) }

if ($historyRoots.Count -eq 0) {
    throw "No VS Code History roots found under APPDATA. Looked for: $codeHistory and $insidersHistory"
}

$skips = New-Object System.Collections.Generic.List[object]
$allEligibleCandidates = New-Object System.Collections.Generic.List[object]
$rawTargetPathsByKey = @{}

$totalEntriesScanned = 0
$inWorkspaceCandidates = 0
$eligibleCandidates = 0
$missingSnapshotPayloadCount = 0
$skippedOutsideWorkspaceCount = 0
$skippedExcludedPathsCount = 0

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
            $targetFull = Get-CanonicalPath $targetLocal
        } catch {
            $skips.Add([pscustomobject]@{ Reason='invalid-target-path'; EntriesJson=$entriesFile.FullName; Target=$targetLocal })
            continue
        }

        if (-not (Is-StrictlyUnderRoot -RootFull $workspaceRoot -CandidateFull $targetFull)) {
            $skippedOutsideWorkspaceCount++
            $skips.Add([pscustomobject]@{ Reason='outside-workspace'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        $targetRel = $targetFull.Substring($workspaceRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
        if (Is-ExcludedTarget -TargetRel $targetRel) {
            $skippedExcludedPathsCount++
            $skips.Add([pscustomobject]@{ Reason='excluded-path'; EntriesJson=$entriesFile.FullName; Target=$targetRel })
            continue
        }

        $inWorkspaceCandidates++

        if (-not ($json.PSObject.Properties.Name -contains 'entries')) {
            $skips.Add([pscustomobject]@{ Reason='missing-entries-array'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        $entries = $json.entries
        if (-not $entries) {
            $skips.Add([pscustomobject]@{ Reason='empty-entries-array'; EntriesJson=$entriesFile.FullName; Target=$targetFull })
            continue
        }

        $targetKey = Get-NormalizedPathKey $targetFull
        if (-not $rawTargetPathsByKey.ContainsKey($targetKey)) {
            $rawTargetPathsByKey[$targetKey] = New-Object System.Collections.Generic.List[string]
        }
        if (-not ($rawTargetPathsByKey[$targetKey] -contains $targetFull)) {
            [void]$rawTargetPathsByKey[$targetKey].Add($targetFull)
        }

        $folder = Split-Path -Parent $entriesFile.FullName
        $ext = [System.IO.Path]::GetExtension($targetFull)

        foreach ($e in $entries) {
            $totalEntriesScanned++
            try {
                $id = [string]$e.id
                $ts = [Int64]$e.timestamp
                if (-not $id) { continue }
                if ($ts -gt $cutoffMs) { continue }

                $eligibleCandidates++

                $snap1 = Join-Path $folder ($id + $ext)
                $snap2 = Join-Path $folder $id
                $snapshotPath = $null

                if (Test-Path -LiteralPath $snap1) {
                    $snapshotPath = $snap1
                } elseif (Test-Path -LiteralPath $snap2) {
                    $snapshotPath = $snap2
                } else {
                    $missingSnapshotPayloadCount++
                    $skips.Add([pscustomobject]@{ Reason='snapshot-missing'; EntriesJson=$entriesFile.FullName; Target=$targetFull; Id=$id; Tried1=$snap1; Tried2=$snap2 })
                    continue
                }

                $snapshotLocal = ([DateTimeOffset]::FromUnixTimeMilliseconds($ts)).ToLocalTime()
                $hoursBefore = Get-HoursBeforeCutoff -CutoffMs $cutoffMs -SnapshotMs $ts

                $allEligibleCandidates.Add([pscustomobject]@{
                    TargetFullCanonical = $targetFull
                    TargetRel = $targetRel
                    TargetKey = $targetKey
                    SnapshotId = $id
                    SnapshotMs = $ts
                    SnapshotLocal = $snapshotLocal
                    SnapshotPath = (Get-FullPath $snapshotPath)
                    EntriesJsonPath = $entriesFile.FullName
                    HoursBeforeCutoff = $hoursBefore
                })
            } catch {
                # Ignore malformed entry.
            }
        }
    }
}

$canonicalCollisions = @($rawTargetPathsByKey.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 })

$allDedupByTarget = @{}
foreach ($candidate in $allEligibleCandidates) {
    if ($allDedupByTarget.ContainsKey($candidate.TargetKey)) {
        if ($candidate.SnapshotMs -gt $allDedupByTarget[$candidate.TargetKey].SnapshotMs) {
            $allDedupByTarget[$candidate.TargetKey] = $candidate
        }
    } else {
        $allDedupByTarget[$candidate.TargetKey] = $candidate
    }
}
$allDedupPlans = $allDedupByTarget.Values | Sort-Object SnapshotMs -Descending

$windowAnchors = Get-WindowAnchors -CutoffLocal $cutoffLocal

$w1 = @($allEligibleCandidates | Where-Object { $_.SnapshotLocal -ge $windowAnchors.Start18 -and $_.SnapshotLocal -le $windowAnchors.End })
$w2 = @($allEligibleCandidates | Where-Object { $_.SnapshotLocal -ge $windowAnchors.Start12 -and $_.SnapshotLocal -le $windowAnchors.End })
$w3 = @($allEligibleCandidates | Where-Object { $_.SnapshotLocal -ge $windowAnchors.Start48 -and $_.SnapshotLocal -le $windowAnchors.End })

$cutoffDateLabel = $cutoffLocal.ToString('yyyy-MM-dd')
$window1Label = "$cutoffDateLabel 18:00..cutoff"
$window2Label = "$cutoffDateLabel 12:00..cutoff"
$window3Label = 'cutoff-48h..cutoff'

$selectedWindowName = 'all<=cutoff'
$selectedCandidates = @($allEligibleCandidates | ForEach-Object { $_ })

if ($NarrowNearCutoff) {
    $selectedWindowName = $window1Label
    $selectedCandidates = $w1

    if (@($selectedCandidates).Count -lt $MinNarrowCandidates) {
        $selectedWindowName = $window2Label
        $selectedCandidates = $w2
    }

    if (@($selectedCandidates).Count -lt $MinNarrowCandidates) {
        $selectedWindowName = $window3Label
        $selectedCandidates = $w3
    }
}

$selectedByTarget = @{}
foreach ($candidate in $selectedCandidates) {
    if ($selectedByTarget.ContainsKey($candidate.TargetKey)) {
        if ($candidate.SnapshotMs -gt $selectedByTarget[$candidate.TargetKey].SnapshotMs) {
            $selectedByTarget[$candidate.TargetKey] = $candidate
        }
    } else {
        $selectedByTarget[$candidate.TargetKey] = $candidate
    }
}
$selectedPlans = $selectedByTarget.Values | Sort-Object SnapshotMs -Descending

$selectedSnapshotCountsByTarget = @{}
foreach ($candidate in $selectedCandidates) {
    if ($selectedSnapshotCountsByTarget.ContainsKey($candidate.TargetKey)) {
        $selectedSnapshotCountsByTarget[$candidate.TargetKey]++
    } else {
        $selectedSnapshotCountsByTarget[$candidate.TargetKey] = 1
    }
}

$gitMeta = Try-GetGitMetadata -WorkspaceRoot $workspaceRoot

$narrowDetails = New-Object System.Collections.Generic.List[object]
$plannedRestores = New-Object System.Collections.Generic.List[object]

foreach ($plan in $selectedPlans) {
    $targetFull = $plan.TargetFullCanonical
    $targetRel = $plan.TargetRel
    $relKey = $targetRel.Replace('/', '\\').ToLowerInvariant()

    $exists = Test-Path -LiteralPath $targetFull
    $size = $null
    if ($exists) {
        try {
            $size = (Get-Item -LiteralPath $targetFull).Length
        } catch {
            $size = $null
        }
    }

    $gitStatus = ''
    $differsFromHead = $false
    $isUntracked = $false
    $isModified = $false
    $isDeleted = $false

    if ($gitMeta.IsRepo) {
        if ($gitMeta.StatusByRelLower.ContainsKey($relKey)) {
            $gitStatus = [string]$gitMeta.StatusByRelLower[$relKey]
            if ($gitStatus -eq '??') {
                $isUntracked = $true
            } else {
                if ($gitStatus[0] -ne ' ' -or $gitStatus[1] -ne ' ') {
                    $isModified = $true
                }
                if ($gitStatus[0] -eq 'D' -or $gitStatus[1] -eq 'D') {
                    $isDeleted = $true
                }
            }
        }

        if ($gitMeta.DiffByRelLower.ContainsKey($relKey)) {
            $differsFromHead = $true
        }

        if ($gitMeta.UntrackedByRelLower.ContainsKey($relKey)) {
            $isUntracked = $true
        }

        if ($gitMeta.DeletedByRelLower.ContainsKey($relKey)) {
            $isDeleted = $true
        }
    }

    $multiSnapshots = $false
    if ($selectedSnapshotCountsByTarget.ContainsKey($plan.TargetKey)) {
        $multiSnapshots = ($selectedSnapshotCountsByTarget[$plan.TargetKey] -gt 1)
    }

    $hoursBefore = $plan.HoursBeforeCutoff
    $reason = ''

    if ($isUntracked) {
        $reason = "Near-cutoff snapshot; file is currently untracked."
    } elseif ($isDeleted) {
        $reason = "Near-cutoff snapshot; file is currently deleted in worktree."
    } elseif ($isModified -or $differsFromHead) {
        $reason = "Near-cutoff snapshot; file has current git modifications."
    } elseif ($hoursBefore -le 3.0) {
        $reason = "Near-cutoff snapshot within 3 hours; plausible reverted local edit."
    } else {
        $reason = "Near-cutoff window snapshot, but no current git signal."
    }

    $row = [pscustomobject]@{
        TargetPath = $targetRel
        NormalizedAbsolutePath = $targetFull
        SnapshotTimestampLocal = $plan.SnapshotLocal.ToString('yyyy-MM-dd HH:mm:ss zzz')
        HoursBeforeCutoff = $hoursBefore
        CurrentFileExists = $exists
        CurrentFileSize = $size
        GitStatus = $gitStatus
        DiffersFromHEAD = $differsFromHead
        IsUntracked = $isUntracked
        IsModified = $isModified
        IsDeleted = $isDeleted
        SnapshotPayloadPath = $plan.SnapshotPath
        MultipleSnapshotsSameTarget = $multiSnapshots
        Reason = $reason
        TargetKey = $plan.TargetKey
        SnapshotMs = $plan.SnapshotMs
    }

    $narrowDetails.Add($row)

    $includeInPlan = $false
    if ($isUntracked -or $isDeleted -or $isModified -or $differsFromHead) {
        $includeInPlan = $true
    } elseif ($hoursBefore -le 3.0) {
        $includeInPlan = $true
    }

    if ($includeInPlan) {
        $plannedRestores.Add($row)
    }
}

$narrowDetailsSorted = $narrowDetails | Sort-Object SnapshotMs -Descending
$plannedRestoresSorted = $plannedRestores | Sort-Object SnapshotMs -Descending

$newest20 = $narrowDetailsSorted | Select-Object -First 20

Write-Host ''
Write-Host ("Planned restores (count): {0}" -f $allDedupPlans.Count)
Write-Host ''
Write-Host 'Summary counts:'
Write-Host ("  Total entries scanned:               {0}" -f $totalEntriesScanned)
Write-Host ("  In-workspace candidates:            {0}" -f $inWorkspaceCandidates)
Write-Host ("  Eligible candidates <= cutoff:      {0}" -f $eligibleCandidates)
Write-Host ("  Unique target files after dedupe:   {0}" -f $allDedupPlans.Count)
Write-Host ("  Missing snapshot payload count:     {0}" -f $missingSnapshotPayloadCount)
Write-Host ("  Skipped outside workspace count:    {0}" -f $skippedOutsideWorkspaceCount)
Write-Host ("  Skipped excluded paths count:       {0}" -f $skippedExcludedPathsCount)
Write-Host ("  Canonical target collisions:        {0}" -f (@($canonicalCollisions).Count))

if ($NarrowNearCutoff) {
    Write-Host ''
    Write-Host 'Narrowing windows:'
    Write-Host ("  Window 1 ({0}) candidates: {1}" -f $window1Label, @($w1).Count)
    Write-Host ("  Window 2 ({0}) candidates: {1}" -f $window2Label, @($w2).Count)
    Write-Host ("  Window 3 ({0}) candidates: {1}" -f $window3Label, @($w3).Count)
    Write-Host ("  Min narrow candidates threshold:      {0}" -f $MinNarrowCandidates)
    Write-Host ("  Selected window:                      {0}" -f $selectedWindowName)
    Write-Host ("  Total narrowed candidates:            {0}" -f @($selectedCandidates).Count)
    Write-Host ("  Unique normalized targets:            {0}" -f @($selectedPlans).Count)
    Write-Host ("  Proposed safe restore targets:        {0}" -f @($plannedRestoresSorted).Count)
}

if ($Verify) {
    Write-Host ''
    Write-Host '=== Verification ==='
    Write-Host ("Canonical collision groups after normalization: {0}" -f @($canonicalCollisions).Count)

    if ((@($canonicalCollisions).Count) -gt 0) {
        Write-Host 'Colliding raw target path variants:'
        foreach ($collision in $canonicalCollisions) {
            Write-Host ("{0}" -f $collision.Key)
            foreach ($variant in $collision.Value) {
                Write-Host ("  - {0}" -f $variant)
            }
        }
    }

    Write-Host ''
    Write-Host 'Newest 20 snapshots nearest to cutoff:'
    foreach ($r in $newest20) {
        Write-Host ("{0} | {1} | {2}h | {3} | {4}" -f $r.NormalizedAbsolutePath, $r.SnapshotTimestampLocal, $r.HoursBeforeCutoff, $r.GitStatus, $r.SnapshotPayloadPath)
    }

    Write-Host ''
    Write-Host 'Exact restore list (safe narrowed set):'
    foreach ($r in $plannedRestoresSorted) {
        Write-Host ("{0} | {1} | Reason: {2}" -f $r.NormalizedAbsolutePath, $r.SnapshotTimestampLocal, $r.Reason)
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
    $lines.Add(("Cutoff (local time):     {0}" -f $cutoffLocal.ToString('yyyy-MM-dd HH:mm:ss zzz')))
    $lines.Add(("History roots found:     {0}" -f ($historyRoots.Count)))
    foreach ($r in $historyRoots) { $lines.Add(("  - {0}" -f $r)) }

    $lines.Add('')
    $lines.Add('Summary counts:')
    $lines.Add(("  Total entries scanned:               {0}" -f $totalEntriesScanned))
    $lines.Add(("  In-workspace candidates:            {0}" -f $inWorkspaceCandidates))
    $lines.Add(("  Eligible candidates <= cutoff:      {0}" -f $eligibleCandidates))
    $lines.Add(("  Unique target files after dedupe:   {0}" -f $allDedupPlans.Count))
    $lines.Add(("  Missing snapshot payload count:     {0}" -f $missingSnapshotPayloadCount))
    $lines.Add(("  Skipped outside workspace count:    {0}" -f $skippedOutsideWorkspaceCount))
    $lines.Add(("  Skipped excluded paths count:       {0}" -f $skippedExcludedPathsCount))
    $lines.Add(("  Canonical target collisions:        {0}" -f (@($canonicalCollisions).Count)))

    if ($NarrowNearCutoff) {
        $lines.Add('')
        $lines.Add('Narrowing windows:')
        $lines.Add(("  Window 1 ({0}) candidates: {1}" -f $window1Label, @($w1).Count))
        $lines.Add(("  Window 2 ({0}) candidates: {1}" -f $window2Label, @($w2).Count))
        $lines.Add(("  Window 3 ({0}) candidates: {1}" -f $window3Label, @($w3).Count))
        $lines.Add(("  Min narrow candidates threshold:      {0}" -f $MinNarrowCandidates))
        $lines.Add(("  Selected window:                      {0}" -f $selectedWindowName))
        $lines.Add(("  Total narrowed candidates:            {0}" -f @($selectedCandidates).Count))
        $lines.Add(("  Unique normalized targets:            {0}" -f @($selectedPlans).Count))
        $lines.Add(("  Proposed safe restore targets:        {0}" -f @($plannedRestoresSorted).Count))
    }

    $lines.Add('')
    $lines.Add('Newest 20 snapshots nearest to cutoff:')
    foreach ($r in $newest20) {
        $lines.Add(("{0} | {1} | {2}h | {3} | {4}" -f $r.NormalizedAbsolutePath, $r.SnapshotTimestampLocal, $r.HoursBeforeCutoff, $r.GitStatus, $r.SnapshotPayloadPath))
    }

    $lines.Add('')
    $lines.Add('Exact restore list (safe narrowed set):')
    foreach ($r in $plannedRestoresSorted) {
        $lines.Add(("{0} | {1} | Reason: {2}" -f $r.NormalizedAbsolutePath, $r.SnapshotTimestampLocal, $r.Reason))
    }

    if ((@($canonicalCollisions).Count) -gt 0) {
        $lines.Add('')
        $lines.Add('Canonical collisions detail:')
        foreach ($collision in $canonicalCollisions) {
            $lines.Add(("{0}" -f $collision.Key))
            foreach ($variant in $collision.Value) {
                $lines.Add(("  - {0}" -f $variant))
            }
        }
    }

    $lines.Add('')
    $lines.Add(("Skipped items (count): {0}" -f $skips.Count))

    if (-not $Apply) {
        $lines.Add('')
        $lines.Add('DRY RUN complete. No files were modified.')
        $lines.Add('To apply: .\\scripts\\restore-vscode-history.ps1 -Cutoff <iso> -Apply -NarrowNearCutoff')
    }

    Set-Content -LiteralPath $reportTxtPath -Value $lines -Encoding UTF8

    if (@($narrowDetailsSorted).Count -gt 0) {
        $narrowDetailsSorted |
            Sort-Object NormalizedAbsolutePath |
            Select-Object TargetPath, NormalizedAbsolutePath, SnapshotTimestampLocal, HoursBeforeCutoff, CurrentFileExists, CurrentFileSize, GitStatus, DiffersFromHEAD, IsUntracked, IsModified, IsDeleted, SnapshotPayloadPath, MultipleSnapshotsSameTarget, Reason |
            Export-Csv -LiteralPath $reportCsvPath -NoTypeInformation -Encoding UTF8
    } else {
        $csvHeader = '"TargetPath","NormalizedAbsolutePath","SnapshotTimestampLocal","HoursBeforeCutoff","CurrentFileExists","CurrentFileSize","GitStatus","DiffersFromHEAD","IsUntracked","IsModified","IsDeleted","SnapshotPayloadPath","MultipleSnapshotsSameTarget","Reason"'
        Set-Content -LiteralPath $reportCsvPath -Value $csvHeader -Encoding UTF8
    }
}

Write-Host ("Skipped items (count):   {0}" -f $skips.Count)
if ($skips.Count -gt 0 -and -not $Quiet) {
    $skips | Select-Object -First 200 | Format-Table -AutoSize | Out-String -Width 4000 | Write-Host
    if ($skips.Count -gt 200) {
        Write-Host ("(Showing first 200 skips; total skips: {0})" -f $skips.Count)
    }
}

if (-not $Apply) {
    Write-Host ''
    Write-Host 'DRY RUN complete. No files were modified.'
    if ($EmitReport -and $reportTxtPath -and $reportCsvPath) {
        Write-Host ("Report written:          {0}" -f $reportTxtPath)
        Write-Host ("Plan CSV written:        {0}" -f $reportCsvPath)
    }
    Write-Host 'To apply: .\scripts\restore-vscode-history.ps1 -Cutoff <iso> -Apply -NarrowNearCutoff'
    exit 0
}

$backupStamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backupRoot = Join-Path $workspaceRoot (".vscode_restore_backup\\{0}" -f $backupStamp)
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$applyPlans = $selectedPlans
if ($NarrowNearCutoff) {
    $applyPlans = $plannedRestoresSorted
}

$overwritten = 0
foreach ($p in $applyPlans) {
    $targetFull = $null
    $targetRel = $null
    $snapshotPath = $null

    if ($p.PSObject.Properties.Name -contains 'TargetFullCanonical') {
        $targetFull = [string]$p.TargetFullCanonical
        $targetRel = [string]$p.TargetRel
        $snapshotPath = [string]$p.SnapshotPath
    } else {
        $targetFull = [string]$p.NormalizedAbsolutePath
        $targetRel = [string]$p.TargetPath
        $snapshotPath = [string]$p.SnapshotPayloadPath
    }

    if (-not (Is-StrictlyUnderRoot -RootFull $workspaceRoot -CandidateFull $targetFull)) {
        $skips.Add([pscustomobject]@{ Reason='apply-outside-workspace'; Target=$targetFull })
        continue
    }

    $destDir = Split-Path -Parent $targetFull
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }

    $backupPath = Join-Path $backupRoot $targetRel
    $backupDir = Split-Path -Parent $backupPath
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    if (Test-Path -LiteralPath $targetFull) {
        Copy-Item -LiteralPath $targetFull -Destination $backupPath -Force
    } else {
        Set-Content -LiteralPath ($backupPath + '.missing') -Value "Missing at restore time: $targetRel" -Encoding UTF8
    }

    Copy-Item -LiteralPath $snapshotPath -Destination $targetFull -Force
    $overwritten++
}

Write-Host ''
Write-Host ("APPLY complete. Backup root: {0}" -f $backupRoot)
Write-Host ("Files overwritten:        {0}" -f $overwritten)
Write-Host ''
Write-Host 'Rollback instructions:'
Write-Host '  Copy files from the backup folder back over the workspace, preserving relative paths:'
Write-Host ("  Backup folder: {0}" -f $backupRoot)

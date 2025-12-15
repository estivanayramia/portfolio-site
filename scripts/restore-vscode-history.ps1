param(
    [string]$HistoryRoot = "$env:APPDATA\Code\User\History",
    [string]$WorkspaceRoot = (Get-Location).Path,
    [datetime]$Cutoff = "2025-12-14T12:00:00",
    [switch]$Apply
)

$ErrorActionPreference = 'SilentlyContinue'
Write-Host "Scanning VS Code History in: $HistoryRoot"
Write-Host "Target Workspace: $WorkspaceRoot"
Write-Host "Cutoff Time: $Cutoff"

# Convert Cutoff to Unix Ms
$Epoch = New-Object DateTime 1970,1,1,0,0,0,([DateTimeKind]::Utc)
# Ensure Cutoff is treated as Local if unspecified, then convert to UTC
if ($Cutoff.Kind -eq 'Unspecified') {
    $Cutoff = [DateTime]::SpecifyKind($Cutoff, [DateTimeKind]::Local)
}
$CutoffUtc = $Cutoff.ToUniversalTime()
$CutoffMs = ($CutoffUtc - $Epoch).TotalMilliseconds

$candidates = @{}

$dirs = Get-ChildItem -Path $HistoryRoot -Directory
foreach ($d in $dirs) {
    $jsonPath = Join-Path $d.FullName "entries.json"
    if (-not (Test-Path $jsonPath)) { continue }

    try {
        $json = Get-Content $jsonPath -Raw | ConvertFrom-Json
        if (-not $json.resource) { continue }
        
        # Decode URI to file path
        # e.g. file:///c%3A/Users/estiv/portfolio-site/deep-dive.html
        $uri = $json.resource
        if ($uri -match "^file:///") {
            $unescaped = [Uri]::UnescapeDataString($uri)
            # Remove file:///
            $localPath = $unescaped -replace "^file:///", ""
            # Fix drive letter format /c:/ -> c:/
            if ($localPath -match "^([a-zA-Z]):/") {
                # already looks like c:/...
            } elseif ($localPath -match "^/([a-zA-Z]):/") {
                $localPath = $localPath.Substring(1)
            }
            
            # Normalize slashes
            $localPath = $localPath -replace "/", "\"
            
            # Check if inside workspace (Case Insensitive)
            if ($localPath.StartsWith($WorkspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                # Found a file in this workspace
                
                # Find best entry
                $bestEntry = $null
                foreach ($entry in $json.entries) {
                    if ($entry.timestamp -le $CutoffMs) {
                        # We want the latest one that is still <= cutoff
                        if ($null -eq $bestEntry -or $entry.timestamp -gt $bestEntry.timestamp) {
                            $bestEntry = $entry
                        }
                    }
                }
                
                if ($bestEntry) {
                    $snapshotFile = Join-Path $d.FullName $bestEntry.id
                    if (Test-Path $snapshotFile) {
                        # Check if we already have a candidate for this file, is this one newer?
                        if ($candidates.ContainsKey($localPath)) {
                            if ($bestEntry.timestamp -gt $candidates[$localPath].Timestamp) {
                                $candidates[$localPath] = @{
                                    SnapshotPath = $snapshotFile
                                    Timestamp = $bestEntry.timestamp
                                    Date = $Epoch.AddMilliseconds($bestEntry.timestamp).ToLocalTime()
                                }
                            }
                        } else {
                            $candidates[$localPath] = @{
                                SnapshotPath = $snapshotFile
                                Timestamp = $bestEntry.timestamp
                                Date = $Epoch.AddMilliseconds($bestEntry.timestamp).ToLocalTime()
                            }
                        }
                    }
                }
            }
        }
    } catch {
        # ignore json errors
    }
}

Write-Host "`nFound $($candidates.Count) files to restore:"
$candidates.GetEnumerator() | Sort-Object Name | ForEach-Object {
    $relPath = $_.Key.Substring($WorkspaceRoot.Length + 1)
    Write-Host " - $relPath (Snapshot from $($_.Value.Date))"
}

if ($Apply) {
    Write-Host "`nApplying restores..."
    foreach ($key in $candidates.Keys) {
        $info = $candidates[$key]
        Copy-Item -Path $info.SnapshotPath -Destination $key -Force
        Write-Host "Restored $key"
    }
    Write-Host "Done."
} else {
    Write-Host "`nRun with -Apply to perform the restore."
}

# scripts/workspace-report.ps1
# Canonical workspace report for live repository and push-state verification.
# Keeps raw command output visible, PASS (empty) behavior, and noise control.

$ErrorActionPreference = "Continue"
$global:LASTEXITCODE = 0

function Section {
  param([Parameter(Mandatory = $true)][string]$Title)
  Write-Output ""
  Write-Output $Title
  Write-Output ("-" * $Title.Length)
}

function Ensure-ReportsDir {
  New-Item -ItemType Directory -Force ".reports" | Out-Null
}

function Normalize-Lines {
  param($Value)
  if ($null -eq $Value) { return @() }
  return @($Value | ForEach-Object { $_.ToString() })
}

function Invoke-Capture {
  param([Parameter(Mandatory = $true)][scriptblock]$Cmd)

  try {
    $out = & $Cmd 2>&1
    $exitCode = $LASTEXITCODE
  } catch {
    $out = @($_ | Out-String)
    $exitCode = 1
  }

  $global:LASTEXITCODE = 0

  $lines = Normalize-Lines $out
  $text = ($lines -join "`n").Trim()

  return [pscustomobject]@{
    Lines = $lines
    Text = $text
    ExitCode = $exitCode
  }
}

function Emit-Lines {
  param(
    [Parameter(Mandatory = $true)]$Result,
    [switch]$PassEmpty,
    [switch]$NoiseControl
  )

  $lines = Normalize-Lines $Result.Lines

  if ($lines.Count -eq 0) {
    if ($PassEmpty) { Write-Output "PASS (empty)" }
    return
  }

  if ($NoiseControl -and $lines.Count -gt 200) {
    Ensure-ReportsDir
    $path = ".reports/workspace-report-latest.txt"
    $lines | Set-Content -Encoding UTF8 $path
    $lines | Select-Object -First 50
    Write-Output "..."
    $lines | Select-Object -Last 50
    Write-Output $path
    return
  }

  $lines
}

function Run-Cmd {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Cmd,
    [switch]$PassEmpty,
    [switch]$NoiseControl
  )

  Write-Output ""
  Write-Output "COMMAND:"
  Write-Output $Label
  Write-Output "OUTPUT:"

  $result = Invoke-Capture -Cmd $Cmd
  Emit-Lines -Result $result -PassEmpty:$PassEmpty -NoiseControl:$NoiseControl
}

function Print-KV {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )
  Write-Output "${Key}: $Value"
}

function Get-UpstreamRef {
  $upstream = Invoke-Capture -Cmd { git rev-parse --abbrev-ref --symbolic-full-name '@{u}' }
  if ($upstream.ExitCode -ne 0) { return $null }
  if ([string]::IsNullOrWhiteSpace($upstream.Text)) { return $null }
  return ($upstream.Text -split "`n")[0].Trim()
}

function Has-Ref {
  param([Parameter(Mandatory = $true)][string]$RefName)
  $res = Invoke-Capture -Cmd { git rev-parse --verify $RefName }
  return ($res.ExitCode -eq 0)
}

function Get-AheadBehind {
  param([string]$Upstream)

  if ([string]::IsNullOrWhiteSpace($Upstream)) {
    return [pscustomobject]@{
      Raw = "NO_UPSTREAM"
      Behind = "unknown"
      Ahead = "unknown"
    }
  }

  $res = Invoke-Capture -Cmd { git rev-list --left-right --count "$Upstream...HEAD" }
  $raw = if ([string]::IsNullOrWhiteSpace($res.Text)) { "unknown" } else { $res.Text }
  $behind = "unknown"
  $ahead = "unknown"

  if ($raw -match '^\s*(\d+)\s+(\d+)\s*$') {
    $behind = $Matches[1]
    $ahead = $Matches[2]
  }

  return [pscustomobject]@{
    Raw = $raw
    Behind = $behind
    Ahead = $ahead
  }
}

Section "WORKSPACE REPORT"

Section "REPO STATE"
Run-Cmd -Label "Get-Location" -Cmd { Get-Location }
Run-Cmd -Label "git rev-parse --show-toplevel" -Cmd { git rev-parse --show-toplevel }
Run-Cmd -Label "git branch --show-current" -Cmd { git branch --show-current }
Run-Cmd -Label "git status --short --branch" -Cmd { git status --short --branch } -NoiseControl
Run-Cmd -Label "git remote -v" -Cmd { git remote -v }
Run-Cmd -Label "git fetch --all --prune" -Cmd { git fetch --all --prune }
Run-Cmd -Label "git rev-parse HEAD" -Cmd { git rev-parse HEAD }
Run-Cmd -Label "git rev-parse --short HEAD" -Cmd { git rev-parse --short HEAD }
Run-Cmd -Label "git show -s --format=%H%n%ci%n%s HEAD" -Cmd { git show -s --format=%H%n%ci%n%s HEAD }

$upstream = Get-UpstreamRef

Run-Cmd -Label "git rev-parse --abbrev-ref --symbolic-full-name @{u}" -Cmd {
  if ($upstream) { $upstream } else { "NO_UPSTREAM" }
}

Run-Cmd -Label "git rev-list --left-right --count @{u}...HEAD" -Cmd {
  if ($upstream) {
    git rev-list --left-right --count "$upstream...HEAD"
  } else {
    "NO_UPSTREAM"
  }
}

Run-Cmd -Label "git show -s --format=%H%n%ci%n%s @{u}" -Cmd {
  if ($upstream) {
    git show -s --format=%H%n%ci%n%s "$upstream"
  } else {
    "NO_UPSTREAM"
  }
}

Run-Cmd -Label "git branch -vv" -Cmd { git branch -vv } -NoiseControl
Run-Cmd -Label "git log --oneline --decorate -n 8" -Cmd { git log --oneline --decorate -n 8 } -NoiseControl
Run-Cmd -Label "git branch -r --contains HEAD" -Cmd { git branch -r --contains HEAD } -PassEmpty -NoiseControl

Section "FAST SUMMARY"
Run-Cmd -Label "repo/push fast summary" -Cmd {
  $repoRoot = (Invoke-Capture -Cmd { git rev-parse --show-toplevel }).Text
  $branch = (Invoke-Capture -Cmd { git branch --show-current }).Text
  $headFull = (Invoke-Capture -Cmd { git rev-parse HEAD }).Text
  $headShort = (Invoke-Capture -Cmd { git rev-parse --short HEAD }).Text
  $headMeta = Invoke-Capture -Cmd { git show -s --format=%ci`n%s HEAD }
  $headDate = if ($headMeta.Lines.Count -ge 1) { $headMeta.Lines[0] } else { "unknown" }
  $headSubject = if ($headMeta.Lines.Count -ge 2) { $headMeta.Lines[1] } else { "unknown" }

  $up = Get-UpstreamRef
  $ab = Get-AheadBehind -Upstream $up

  $remoteContainsHead = (Invoke-Capture -Cmd { git branch -r --contains HEAD }).Lines |
    ForEach-Object { $_.Trim() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  $latestCommitPushed = "UNKNOWN_NO_UPSTREAM"
  if ($up) {
    if ($ab.Ahead -eq "0") {
      $latestCommitPushed = "YES"
    } else {
      $latestCommitPushed = "NO"
    }
  }

  $staged = (Invoke-Capture -Cmd { git diff --name-only --staged }).Lines
  $unstaged = (Invoke-Capture -Cmd { git diff --name-only }).Lines
  $untracked = (Invoke-Capture -Cmd { git ls-files -o --exclude-standard }).Lines

  $unpushedCount = "unknown"
  if ($up) {
    $unpushed = (Invoke-Capture -Cmd { git diff --name-only "$up..HEAD" }).Lines
    $unpushedCount = [string]$unpushed.Count
  }

  $originMainExists = Has-Ref "origin/main"
  $originMainDiffCount = "NO_ORIGIN_MAIN"
  if ($originMainExists) {
    $originMainDiff = (Invoke-Capture -Cmd { git diff --name-only "origin/main...HEAD" }).Lines
    $originMainDiffCount = [string]$originMainDiff.Count
  }

  Print-KV "repo_root" $(if ([string]::IsNullOrWhiteSpace($repoRoot)) { "unknown" } else { $repoRoot })
  Print-KV "current_branch" $(if ([string]::IsNullOrWhiteSpace($branch)) { "unknown" } else { $branch })
  Print-KV "head_sha" $(if ([string]::IsNullOrWhiteSpace($headFull)) { "unknown" } else { $headFull })
  Print-KV "head_short_sha" $(if ([string]::IsNullOrWhiteSpace($headShort)) { "unknown" } else { $headShort })
  Print-KV "head_date" $headDate
  Print-KV "head_subject" $headSubject
  Print-KV "upstream_branch" $(if ($up) { $up } else { "NO_UPSTREAM" })
  Print-KV "ahead_behind_raw" $ab.Raw
  Print-KV "behind_count" $ab.Behind
  Print-KV "ahead_count" $ab.Ahead
  Print-KV "latest_commit_pushed" $latestCommitPushed
  Print-KV "head_visible_on_remote_refs" $(if ($remoteContainsHead.Count -gt 0) { "YES" } else { "NO" })
  Print-KV "staged_files_count" ([string]$staged.Count)
  Print-KV "unstaged_files_count" ([string]$unstaged.Count)
  Print-KV "untracked_files_count" ([string]$untracked.Count)
  Print-KV "unpushed_files_count_vs_upstream" $unpushedCount
  Print-KV "diff_files_count_vs_origin_main" $originMainDiffCount

  Write-Output "remote_refs_containing_head:"
  if ($remoteContainsHead.Count -eq 0) { Write-Output "PASS (empty)" } else { $remoteContainsHead }
} -NoiseControl

Section "CHANGE STATE"
Run-Cmd -Label "git diff --name-status --staged" -Cmd { git diff --name-status --staged } -PassEmpty -NoiseControl
Run-Cmd -Label "git diff --name-status" -Cmd { git diff --name-status } -PassEmpty -NoiseControl
Run-Cmd -Label "git ls-files -m" -Cmd { git ls-files -m } -PassEmpty -NoiseControl
Run-Cmd -Label "git ls-files -o --exclude-standard" -Cmd { git ls-files -o --exclude-standard } -PassEmpty -NoiseControl
Run-Cmd -Label "git diff --stat --staged" -Cmd { git diff --stat --staged } -PassEmpty -NoiseControl
Run-Cmd -Label "git diff --stat" -Cmd { git diff --stat } -PassEmpty -NoiseControl
Run-Cmd -Label "git show --stat --summary -1 HEAD" -Cmd { git show --stat --summary -1 HEAD } -NoiseControl

Section "REMOTE / PUSH STATE"
Run-Cmd -Label "git diff --name-status @{u}..HEAD" -Cmd {
  if ($upstream) {
    git diff --name-status "$upstream..HEAD"
  } else {
    "NO_UPSTREAM"
  }
} -PassEmpty -NoiseControl

Run-Cmd -Label "git diff --name-status HEAD..@{u}" -Cmd {
  if ($upstream) {
    git diff --name-status "HEAD..$upstream"
  } else {
    "NO_UPSTREAM"
  }
} -PassEmpty -NoiseControl

Run-Cmd -Label "git log --oneline @{u}..HEAD" -Cmd {
  if ($upstream) {
    git log --oneline "$upstream..HEAD"
  } else {
    "NO_UPSTREAM"
  }
} -PassEmpty -NoiseControl

Run-Cmd -Label "git log --oneline HEAD..@{u}" -Cmd {
  if ($upstream) {
    git log --oneline "HEAD..$upstream"
  } else {
    "NO_UPSTREAM"
  }
} -PassEmpty -NoiseControl

Run-Cmd -Label "git diff --name-status origin/main...HEAD" -Cmd {
  if (Has-Ref "origin/main") {
    git diff --name-status "origin/main...HEAD"
  } else {
    "NO_ORIGIN_MAIN"
  }
} -PassEmpty -NoiseControl

Run-Cmd -Label "push-state summary" -Cmd {
  $branch = (Invoke-Capture -Cmd { git branch --show-current }).Text
  $head = (Invoke-Capture -Cmd { git rev-parse HEAD }).Text
  $up = Get-UpstreamRef
  $ab = Get-AheadBehind -Upstream $up

  Print-KV "current_branch" $(if ([string]::IsNullOrWhiteSpace($branch)) { "unknown" } else { $branch })
  Print-KV "head_sha" $(if ([string]::IsNullOrWhiteSpace($head)) { "unknown" } else { $head })
  Print-KV "upstream_branch" $(if ($up) { $up } else { "NO_UPSTREAM" })
  Print-KV "behind_count" $ab.Behind
  Print-KV "ahead_count" $ab.Ahead

  if (-not $up) {
    Print-KV "latest_commit_pushed" "UNKNOWN_NO_UPSTREAM"
    return
  }

  if ($ab.Ahead -eq "0") {
    Print-KV "latest_commit_pushed" "YES"
  } else {
    Print-KV "latest_commit_pushed" "NO"
  }

  Write-Output "unpushed_files_vs_upstream:"
  $unpushed = (Invoke-Capture -Cmd { git diff --name-only "$up..HEAD" }).Lines
  if ($unpushed.Count -eq 0) { Write-Output "PASS (empty)" } else { $unpushed }

  Write-Output "upstream_only_files_vs_local:"
  $upstreamOnly = (Invoke-Capture -Cmd { git diff --name-only "HEAD..$up" }).Lines
  if ($upstreamOnly.Count -eq 0) { Write-Output "PASS (empty)" } else { $upstreamOnly }

  if (Has-Ref "origin/main") {
    Write-Output "files_vs_origin_main:"
    $mainDiff = (Invoke-Capture -Cmd { git diff --name-only "origin/main...HEAD" }).Lines
    if ($mainDiff.Count -eq 0) { Write-Output "PASS (empty)" } else { $mainDiff }
  } else {
    Print-KV "origin_main_compare" "NO_ORIGIN_MAIN"
  }
} -NoiseControl

Section "ROOT / POLICY CHECKS"
Run-Cmd -Label "Get-ChildItem -Path . -File | Select-Object -ExpandProperty Name" -Cmd {
  Get-ChildItem -Path . -File | Select-Object -ExpandProperty Name
} -NoiseControl

Run-Cmd -Label "Get-ChildItem -Path . -Directory | Select-Object -ExpandProperty Name" -Cmd {
  Get-ChildItem -Path . -Directory | Select-Object -ExpandProperty Name
} -NoiseControl

Run-Cmd -Label "space-path check (allowlist assets/img/Portolio-Media/, .github/agents/)" -Cmd {
  git ls-files |
    Where-Object { $_ -match '\s' } |
    Where-Object { $_ -notmatch '^assets/img/Portolio-Media/' -and $_ -notmatch '^\.github/agents/' }
} -PassEmpty -NoiseControl

Run-Cmd -Label "git ls-files | Where-Object { $_ -match '\.(tmp|bak|old|swp)$' }" -Cmd {
  git ls-files | Where-Object { $_ -match '\.(tmp|bak|old|swp)$' }
} -PassEmpty

Section "SECRET / CONFIG VISIBILITY"
$secretScan = Invoke-Capture -Cmd {
  git grep -n "OPENAI|API_KEY|SECRET|PRIVATE_KEY|BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|aws_access_key_id|aws_secret_access_key|Authorization:\s*Bearer" -- .
}

if ($secretScan.ExitCode -ne 0 -or $secretScan.Lines.Count -eq 0) {
  Run-Cmd -Label "git grep secret scan" -Cmd { "no-matches" }
} else {
  Run-Cmd -Label "git grep secret scan" -Cmd { $secretScan.Lines } -NoiseControl
}

Run-Cmd -Label "git config --get core.autocrlf (or unset)" -Cmd {
  $v = Invoke-Capture -Cmd { git config --get core.autocrlf }
  if ($v.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($v.Text)) {
    "unset"
  } else {
    $v.Text
  }
}

Run-Cmd -Label "git config --get core.eol (or unset)" -Cmd {
  $v = Invoke-Capture -Cmd { git config --get core.eol }
  if ($v.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($v.Text)) {
    "unset"
  } else {
    $v.Text
  }
}

Section "DOCS POLICY CHECKS"
Run-Cmd -Label "Tracked .md outside docs excluding .github/copilot-instructions.md" -Cmd {
  git ls-files -- '*.md' |
    Where-Object {
      $_ -notmatch '^docs/' -and
      $_ -ne '.github/copilot-instructions.md' -and
      $_ -ne 'CLAUDE.md'
    }
} -PassEmpty -NoiseControl

Run-Cmd -Label "Non-ignored .md outside docs excluding .github/copilot-instructions.md" -Cmd {
  git ls-files -co --exclude-standard -- '*.md' |
    Where-Object {
      $_ -notmatch '^docs/' -and
      $_ -ne '.github/copilot-instructions.md' -and
      $_ -ne 'CLAUDE.md'
    }
} -PassEmpty -NoiseControl

Run-Cmd -Label "Root-level .md files" -Cmd {
  Get-ChildItem -Path . -File -Filter '*.md' |
    Where-Object { $_.Name -ne 'CLAUDE.md' } |
    Select-Object -ExpandProperty Name
} -PassEmpty

Run-Cmd -Label "Root-level dirs ending with .md" -Cmd {
  Get-ChildItem -Path . -Directory |
    Where-Object { $_.Name -like '*.md' } |
    Select-Object -ExpandProperty Name
} -PassEmpty

$global:LASTEXITCODE = 0
# scripts/workspace-report.ps1
# Generates a stable WORKSPACE REPORT with PASS (empty) and noise control.

$ErrorActionPreference = "Continue"

function Section($title) {
  Write-Output ""
  Write-Output $title
  Write-Output ("-" * $title.Length)
}

function Run-Cmd {
  param(
    [Parameter(Mandatory=$true)][string]$Label,
    [Parameter(Mandatory=$true)][scriptblock]$Cmd,
    [switch]$PassEmpty,
    [switch]$NoiseControl
  )

  Write-Output ""
  Write-Output "COMMAND:"
  Write-Output $Label
  Write-Output "OUTPUT:"

  $out = & $Cmd 2>&1
  if ($null -eq $out -or ($out | Measure-Object).Count -eq 0) {
    if ($PassEmpty) { Write-Output "PASS (empty)" }
    return
  }

  $lines = @($out | ForEach-Object { $_.ToString() })

  if ($NoiseControl -and $lines.Count -gt 200) {
    New-Item -ItemType Directory -Force ".reports" | Out-Null
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

Section "WORKSPACE REPORT"

Section "A) Identity"
Run-Cmd -Label "Get-Location" -Cmd { Get-Location }
Run-Cmd -Label "git rev-parse --show-toplevel" -Cmd { git rev-parse --show-toplevel }
Run-Cmd -Label "git branch --show-current" -Cmd { git branch --show-current }
Run-Cmd -Label "git rev-parse --short HEAD" -Cmd { git rev-parse --short HEAD }

Section "B) Git state"
Run-Cmd -Label "git status -sb" -Cmd { git status -sb }
Run-Cmd -Label "git diff --name-status --staged" -Cmd { git diff --name-status --staged } -PassEmpty
Run-Cmd -Label "git diff --name-status" -Cmd { git diff --name-status } -PassEmpty
Run-Cmd -Label "git diff --stat --staged" -Cmd { git diff --stat --staged } -PassEmpty
Run-Cmd -Label "git diff --stat" -Cmd { git diff --stat } -PassEmpty

Section "C) Change inventory (tracked + untracked excluding ignored)"
Run-Cmd -Label "git diff --name-only --staged" -Cmd { git diff --name-only --staged } -PassEmpty
Run-Cmd -Label "git diff --name-only" -Cmd { git diff --name-only } -PassEmpty
Run-Cmd -Label "git ls-files -m" -Cmd { git ls-files -m } -PassEmpty
Run-Cmd -Label "git ls-files -o --exclude-standard" -Cmd { git ls-files -o --exclude-standard } -PassEmpty

Section "D) Root hygiene"
Run-Cmd -Label "Get-ChildItem -Path . -File | Select-Object -ExpandProperty Name" -Cmd { Get-ChildItem -Path . -File | Select-Object -ExpandProperty Name } -NoiseControl
Run-Cmd -Label "Get-ChildItem -Path . -Directory | Select-Object -ExpandProperty Name" -Cmd { Get-ChildItem -Path . -Directory | Select-Object -ExpandProperty Name } -NoiseControl

Section "E) Tracked paths with spaces (flag only non-allowlisted)"
Run-Cmd -Label "space-path check (allowlist assets/img/Portolio-Media/, .github/agents/)" -Cmd {
  git ls-files |
    Where-Object { $_ -match '\\s' } |
    Where-Object { $_ -notmatch '^assets/img/Portolio-Media/' -and $_ -notmatch '^\\.github/agents/' }
} -PassEmpty -NoiseControl

Section "F) Junk extensions in tracked files"
Run-Cmd -Label "git ls-files | Where-Object { $_ -match '\\.(tmp|bak|old|swp)$' }" -Cmd {
  git ls-files | Where-Object { $_ -match '\\.(tmp|bak|old|swp)$' }
} -PassEmpty

Section "G) Cheap secret scan"
$out = & { git grep -n "OPENAI|API_KEY|SECRET|PRIVATE_KEY|BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|aws_access_key_id|aws_secret_access_key|Authorization:\\s*Bearer" -- . } 2>&1
if ($LASTEXITCODE -ne 0 -or ($out | Measure-Object).Count -eq 0) {
  Run-Cmd -Label "git grep secret scan" -Cmd { "no-matches" }
} else {
  Run-Cmd -Label "git grep secret scan" -Cmd { $out }
}

Section "H) Line ending config visibility"
Run-Cmd -Label "git config --get core.autocrlf (or unset)" -Cmd {
  $v = git config --get core.autocrlf 2>&1
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($v | Out-String))) { "unset" } else { $v }
}
Run-Cmd -Label "git config --get core.eol (or unset)" -Cmd {
  $v = git config --get core.eol 2>&1
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($v | Out-String))) { "unset" } else { $v }
}

Section "I) Docs policy checks"
Run-Cmd -Label "Tracked .md outside docs excluding .github/copilot-instructions.md" -Cmd {
  git ls-files -- '*.md' | Where-Object { $_ -notmatch '^docs/' -and $_ -ne '.github/copilot-instructions.md' }
} -PassEmpty
Run-Cmd -Label "Non-ignored .md outside docs excluding .github/copilot-instructions.md" -Cmd {
  git ls-files -co --exclude-standard -- '*.md' | Where-Object { $_ -notmatch '^docs/' -and $_ -ne '.github/copilot-instructions.md' }
} -PassEmpty
Run-Cmd -Label "Root-level .md files" -Cmd {
  Get-ChildItem -Path . -File -Filter '*.md' | Select-Object -ExpandProperty Name
} -PassEmpty
Run-Cmd -Label "Root-level dirs ending with .md" -Cmd {
  Get-ChildItem -Path . -Directory | Where-Object { $_.Name -like '*.md' } | Select-Object -ExpandProperty Name
} -PassEmpty

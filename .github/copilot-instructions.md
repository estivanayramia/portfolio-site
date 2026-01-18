You are my local repo agent for `portfolio-site` in VS Code (Visual Studio Code).

PRIMARY GOAL
Keep the repo clean, consistent, and verifiable. Every response must include a full self-audit so I can trust changes without seeing your filesystem.

ABSOLUTE RULE
After EVERY response you produce, append exactly one section titled `WORKSPACE REPORT`.
- Do not skip it.
- Put all diagnostics inside it.
- If a command fails, include the command and full raw error output.
- Do not paraphrase command outputs.
- If a check has no output, explicitly print `PASS (empty)` as the script output.

PERSISTENCE
This exact instruction text must live at `.github/copilot-instructions.md` and be committed.
It is an allowed exception to any “no Markdown outside docs” rule because it is tool configuration and must remain in `.github/` to load.

DOCS POLICY (ENFORCED)
- All documentation Markdown belongs under `./docs/**`.
- No `.md` files in repo root.
- No root directories ending with `.md`.
- Allowed exception outside docs: `.github/copilot-instructions.md` only.
- Never put copies of copilot instructions under `docs/`. Delete duplicates immediately.

PATH RULES
- Docs filenames: lowercase-kebab-case.md
- Docs folders: lowercase-kebab-case/
- Use `git mv` for renames/moves.

REALISTIC “SPACES IN PATHS” RULE
Spaces in paths are only allowed in these prefixes (allowlist):
- `assets/img/Portolio-Media/`
- `.github/agents/`
Flag any other tracked path containing spaces.

NOISE CONTROL
Never recursively scan the filesystem for repo policy (node_modules noise). Use git-based commands.
If any command output exceeds 200 lines:
- Save full output to `.reports/workspace-report-latest.txt`
- Print first 50 and last 50 lines
- Print the saved path as a final line

FINISHING BEHAVIOR
If the user says “perfect this”, “finish”, or “make it good”:
1) Remove duplicates (example: delete docs copies of instructions).
2) Ensure `.github/copilot-instructions.md` exists and is tracked (not ignored).
3) `git add -A`
4) Run the full WORKSPACE REPORT
5) If clean and staged, commit once with a clear message
6) If branch is ahead, remind to `git push` (do not push automatically)

WORKSPACE REPORT CONTENT (REQUIRED EVERY TIME)
Run these in PowerShell and paste the raw outputs in order.

A) Identity
COMMANDS:
- Get-Location
- git rev-parse --show-toplevel
- git branch --show-current
- git rev-parse --short HEAD

B) Git state
COMMANDS:
- git status -sb
- git diff --name-status --staged
- git diff --name-status
- git diff --stat --staged
- git diff --stat

C) Change inventory (tracked + untracked excluding ignored)
COMMANDS:
- git diff --name-only --staged
- git diff --name-only
- git ls-files -m
- git ls-files -o --exclude-standard

If any of these outputs are empty, print:
PASS (empty)

D) Root hygiene (applies to everything)
COMMANDS:
- Get-ChildItem -Path . -File | Select-Object -ExpandProperty Name
- Get-ChildItem -Path . -Directory | Select-Object -ExpandProperty Name

E) Tracked paths with spaces, flag only non-allowlisted
COMMAND:
- $spacePaths = git ls-files | Where-Object { $_ -match '\s' } |
    Where-Object { $_ -notmatch '^assets/img/Portolio-Media/' -and $_ -notmatch '^\.github/agents/' }
- If $spacePaths is empty: print PASS (empty)
- Else: print $spacePaths (with noise control rule if > 200 lines)

F) Junk extensions in tracked files
COMMAND:
- $junk = git ls-files | Where-Object { $_ -match '\.(tmp|bak|old|swp)$' }
- If empty: PASS (empty) else print list

G) Cheap secret scan
COMMAND:
- git grep -n "OPENAI|API_KEY|SECRET|PRIVATE_KEY|BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|aws_access_key_id|aws_secret_access_key|Authorization:\s*Bearer" -- .
- If no matches: print no-matches

H) Line ending config visibility (never show exit-code confusion)
COMMANDS:
- git config --get core.autocrlf; if ($LASTEXITCODE -ne 0) { "unset" }
- git config --get core.eol; if ($LASTEXITCODE -ne 0) { "unset" }

I) Docs policy checks (git-based)
1) Tracked Markdown outside docs excluding allowed exception
COMMAND:
- $badTrackedMd = git ls-files -- '*.md' | Where-Object { $_ -notmatch '^docs/' -and $_ -ne '.github/copilot-instructions.md' }
- If empty: PASS (empty) else print list

2) Non-ignored Markdown outside docs excluding allowed exception
COMMAND:
- $badUntrackedMd = git ls-files -co --exclude-standard -- '*.md' | Where-Object { $_ -notmatch '^docs/' -and $_ -ne '.github/copilot-instructions.md' }
- If empty: PASS (empty) else print list

3) Root-level Markdown files
COMMAND:
- $rootMd = Get-ChildItem -Path . -File -Filter '*.md' | Select-Object -ExpandProperty Name
- If empty: PASS (empty) else print list

4) Root-level directories ending with .md
COMMAND:
- $rootMdDirs = Get-ChildItem -Path . -Directory | Where-Object { $_.Name -like '*.md' } | Select-Object -ExpandProperty Name
- If empty: PASS (empty) else print list

J) Docs link regression check (only if docs changed this response)
COMMAND:
- git grep -n "DEPLOYMENT\.md|ANALYTICS\.md|TESTING\.md|PHASE1_REFACTORING_SUMMARY\.md|Notes\.md|GAME_FIXES_SUMMARY\.md|FIXES_APPLIED\.md|ANALYTICS_IMPLEMENTATION\.md" -- docs
- If none: print no-matches

You are my local repo agent for `portfolio-site` running inside VS Code (Visual Studio Code).

GOAL
Make the repo state clean, consistent, and verifiable. Enforce docs organization, enforce workspace hygiene, and make every response self-auditing.

ABSOLUTE OUTPUT RULE
After EVERY response you produce, append exactly one section titled `WORKSPACE REPORT` containing the required command outputs. No exceptions.
- Put all diagnostics in WORKSPACE REPORT.
- If any command fails, include the command and the full raw error output.
- Do not paraphrase command outputs.

WHERE THIS MUST LIVE (PERSISTENCE)
This instruction text must be stored at `.github/copilot-instructions.md` and committed so it loads in every Copilot session.
This file is an allowed exception to any “no Markdown outside docs” rule because it is tool configuration.

FIRST-RUN CLEANUP (DO THIS ONCE PER CLONE)
1) Delete any duplicate instruction copies inside docs. Keep only `.github/copilot-instructions.md`.
   - If `docs/**/copilot-instructions.md` exists, delete it.
2) Do NOT ignore `.github/copilot-instructions.md` in `.gitignore`. It must be tracked.
3) If a root `README.md` exists, move it under `docs/` and replace root with a non-Markdown `README` file that points to `docs/index.md`.

DOCS RULES (NON-NEGOTIABLE)
1) All project documentation Markdown must live under `./docs/` subfolders.
2) No `.md` files in repo root.
3) No directories in repo root whose names end with `.md`.
4) Allowed Markdown exceptions outside `docs/`:
   - `.github/copilot-instructions.md` only.

PATH AND NAMING RULES
- Docs files: `lowercase-kebab-case.md`
- Docs folders: `lowercase-kebab-case/`
- Use `git mv` for moves and renames.

SPACES IN PATHS (MAKE THIS RULE REALISTIC)
Spaces in tracked paths are normally bad, but this repo already contains media paths with spaces.
So enforce this as: “No tracked paths with spaces outside an allowlist.”
ALLOWLIST (edit if needed):
- `assets/img/Portolio-Media/`
- `.github/agents/`
Check must only flag paths with spaces that are NOT in the allowlist.

NOISE CONTROL
Some checks can explode output (especially space-path listings).
When output exceeds 200 lines:
- Print the first 50 lines and the last 50 lines in WORKSPACE REPORT.
- Also write the full output to `.reports/workspace-report-latest.txt` and note the file path in WORKSPACE REPORT.
Never do a recursive filesystem scan for `.md` (node_modules spam). Use git-based listings only.

WHEN YOU CHANGE FILES
If you changed anything in this response:
- Ensure the repo rules still pass.
- Stage intentionally changed files (`git add -A`).
- If asked to finish or “make it good”, create a commit with a clear message.

WORKSPACE REPORT (REQUIRED EVERY TIME)
Run these commands in PowerShell and paste raw outputs.

A) Identity
- Get-Location
- git rev-parse --show-toplevel
- git branch --show-current
- git rev-parse --short HEAD

B) Git state
- git status -sb
- git diff --name-status --staged
- git diff --name-status
- git diff --stat --staged
- git diff --stat

C) Change inventory (tracked + untracked, excluding ignored)
- git diff --name-only --staged
- git diff --name-only
- git ls-files -m
- git ls-files -o --exclude-standard

D) Root hygiene (applies to everything)
- Get-ChildItem -Path . -File | Select-Object -ExpandProperty Name
- Get-ChildItem -Path . -Directory | Select-Object -ExpandProperty Name

E) Tracked paths with spaces (flag only non-allowlisted)
- git ls-files | Where-Object { $_ -match '\s' } |
  Where-Object { $_ -notmatch '^assets/img/Portolio-Media/' -and $_ -notmatch '^\.github/agents/' }

F) Junk extensions in tracked files
- git ls-files | Where-Object { $_ -match '\.(tmp|bak|old|swp)$' }

G) Cheap secret leak scan (applies to everything)
- git grep -n "OPENAI|API_KEY|SECRET|PRIVATE_KEY|BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|aws_access_key_id|aws_secret_access_key|Authorization:\s*Bearer" -- .
If no matches, print exactly:
no-matches

H) Line ending config visibility
- git config --get core.autocrlf
- git config --get core.eol

I) Docs policy checks (git-based, no filesystem recursion)
1) Tracked Markdown outside docs, excluding allowed exception (must be empty)
- git ls-files -- '*.md' | Where-Object { $_ -notmatch '^docs/' -and $_ -ne '.github/copilot-instructions.md' }

2) Non-ignored Markdown outside docs, excluding allowed exception (must be empty)
- git ls-files -co --exclude-standard -- '*.md' |
  Where-Object { $_ -notmatch '^docs/' -and $_ -ne '.github/copilot-instructions.md' }

3) Root-level Markdown files (must be empty)
- Get-ChildItem -Path . -File -Filter '*.md' | Select-Object -ExpandProperty Name

4) Root-level directories ending with .md (must be empty)
- Get-ChildItem -Path . -Directory | Where-Object { $_.Name -like '*.md' } | Select-Object -ExpandProperty Name

J) If docs were touched in this response
- git grep -n "DEPLOYMENT\.md|ANALYTICS\.md|TESTING\.md|PHASE1_REFACTORING_SUMMARY\.md|Notes\.md|GAME_FIXES_SUMMARY\.md|FIXES_APPLIED\.md|ANALYTICS_IMPLEMENTATION\.md" -- docs
If no matches, print exactly:
no-matches

CURRENT-STATE “PERFECT IT” CHECKLIST (USE THIS REPO RIGHT NOW)
1) Delete `docs/notes/copilot-instructions.md` if present.
2) Ensure `.github/copilot-instructions.md` exists, is not ignored, and is staged.
3) Stage everything intended: `git add -A`
4) Verify docs policy checks return empty.
5) Commit once: `git commit -m "chore: docs reorg and persistent workspace reporting rules"`
6) After commit, WORKSPACE REPORT should show clean status.

END.

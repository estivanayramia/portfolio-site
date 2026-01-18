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

WORKSPACE REPORT GENERATION
Always generate the WORKSPACE REPORT by running this one command and pasting its entire stdout:

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/workspace-report.ps1

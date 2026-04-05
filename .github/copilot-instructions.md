You are my local repo agent for `portfolio-site` in VS Code (Visual Studio Code).

PRIMARY GOAL
Keep the repo clean, consistent, and verifiable.
Every response must include a full self-audit so I can trust changes without seeing your filesystem.

ABSOLUTE RULE
After EVERY response you produce, append exactly one section titled `WORKSPACE REPORT`.
- Do not skip it.
- Put all diagnostics inside it.
- If a command fails, include the command and full raw error output.
- Do not paraphrase command outputs.
- If a check has no output, explicitly print `PASS (empty)` as the script output.

PERSISTENCE
This exact instruction text must live at `.github/copilot-instructions.md` and be committed.
It is an allowed exception to any “no Markdown outside docs” rule because it is tool configuration and must remain in `.github/`.

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

REPO-STATE PREFLIGHT (REQUIRED)
Before answering any repo question involving pushes, pulls, commits, branches, merges, deploys, regressions, “what changed”, “did this push”, “is this on GitHub”, “what branch is this”, or “what is unmerged”, you must collect live repo state first.

Run these checks before reasoning:
1. `git rev-parse --show-toplevel`
2. `git branch --show-current`
3. `git status --short --branch`
4. `git remote -v`
5. `git fetch --all --prune`
6. `git rev-parse HEAD`
7. `git show -s --format=%H%n%ci%n%s HEAD`
8. `git rev-parse --abbrev-ref --symbolic-full-name @{u}`
9. `git rev-list --left-right --count @{u}...HEAD`
10. `git branch -vv`
11. `git log --oneline --decorate -n 8`
12. `git show --stat --summary -1 HEAD`
13. `git diff --name-status @{u}..HEAD`
14. `git diff --name-status origin/main...HEAD`

If upstream does not exist, say so explicitly and fall back to the most relevant comparison target, usually `origin/main`.

PUSH / REMOTE VERIFICATION RULE
Never claim something is “pushed”, “on GitHub”, “merged”, “live”, or “included” unless you verified:
- current branch
- current HEAD SHA
- upstream branch or lack of one
- ahead/behind counts
- latest upstream commit identity
- whether HEAD appears on remote refs (for example via `git branch -r --contains HEAD`)
- whether the relevant commit exists remotely
- whether the relevant files are present in the pushed diff

For “check the push” style requests, also run:
- `git diff --name-status @{u}..HEAD`
- `git diff --name-status origin/main...HEAD`

If the request is about a specific fix, bug, component, file, route, stylesheet, PR, or feature:
- identify the exact relevant files
- say whether they appear in the latest local commit
- say whether they appear in unpushed commits
- say whether they appear relative to `origin/main`
- do not guess from memory

BRANCH / MERGE SAFETY
Before recommending any merge, deletion, cleanup, or “just use this branch” decision, verify:
- current branch
- merge target branch
- ahead/behind counts
- changed file set
- whether the branch contains unique work not in main
- whether stale history should be avoided with cherry-pick or clean integration

LOCAL-FIRST CONTEXT RULE
Prefer the local workspace as source of truth for:
- current branch
- latest edits
- staged vs unstaged changes
- untracked files
- local-only commits
- repo scripts and config
Do not make the user repeat facts that local git can answer.

RELEVANT-FILE RULE
For debugging or change-verification requests, inspect the specific file(s) actually tied to the issue.
Examples:
- CSS layout issue → inspect the actual CSS, component markup, and route/page that loads it
- form issue → inspect submit handler, endpoint, env usage, and network-facing code
- push question → inspect git state plus the exact files expected in the push

FINISHING BEHAVIOR
If the user says “perfect this”, “finish”, or “make it good”:
1) Remove duplicates (example: delete docs copies of instructions).
2) Ensure `.github/copilot-instructions.md` exists and is tracked (not ignored).
3) `git add -A`
4) Run the full WORKSPACE REPORT
5) If clean and staged, commit once with a clear message
6) If branch is ahead, remind to `git push` (do not push automatically)

WORKSPACE REPORT STRUCTURE
The single required `WORKSPACE REPORT` section must include these subsections when relevant:

1. `REPO STATE`
- repo root
- current branch
- HEAD SHA
- HEAD short SHA
- HEAD commit date
- HEAD subject
- remotes
- upstream branch
- upstream latest commit (or explicit `NO_UPSTREAM`)
- ahead/behind counts

2. `CHANGE STATE`
- staged files
- unstaged files
- untracked files
- latest commit file summary
- relevant file paths checked for this task

3. `REMOTE / PUSH STATE`
- whether latest commit is pushed
- whether branch tracks a remote
- whether HEAD appears on remote refs
- unpushed commit list vs upstream
- upstream-only commit list vs local
- diff vs upstream
- diff vs `origin/main` when relevant
- unpushed commit/file visibility

4. `SCRIPT OUTPUT`
- the exact stdout from the workspace report script below

The canonical report script must provide a fast readable summary for repo/push state using live git data, while still preserving raw command output sections.

The fast summary must explicitly surface:
- branch tracking status
- upstream latest commit identity (SHA/date/subject)
- ahead/behind counts
- latest commit pushed status
- unpushed file count vs upstream
- diff file count vs `origin/main`

Do not paraphrase raw command output inside these subsections.
You may explain above the WORKSPACE REPORT, but the WORKSPACE REPORT itself must stay exact and verifiable.

WORKSPACE REPORT GENERATION
Always run this command and paste its entire stdout inside the `SCRIPT OUTPUT` subsection of the WORKSPACE REPORT:

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/workspace-report.ps1
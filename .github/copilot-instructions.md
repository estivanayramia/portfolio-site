# Copilot instructions for this repository

## Goal
Help improve this portfolio site with small, correct, maintainable changes that are safe to ship.

Priorities:
- correctness
- minimal diffs
- low regression risk
- clean UX
- accessibility
- performance
- accurate verification

## Default behavior
- Be concise by default.
- Prefer the smallest change that fully solves the task.
- Read the relevant files before editing.
- Preserve existing conventions unless there is a strong reason to improve them.
- Keep unrelated edits out of the diff.
- Do not invent repo facts, command results, logs, or verification.

## How to work
- Diagnose before changing code.
- Fix root causes, not just symptoms.
- State assumptions briefly when they affect the solution.
- When a request is underspecified, make the safest reasonable interpretation from the repo context.
- Update obvious references when renaming or moving files.
- Avoid broad refactors unless they are necessary to solve the task.

## Verification
Use the lightest relevant verification for the change.
- Run relevant checks when practical.
- Do not paste raw command output unless the user asks for it or it is the key evidence for a blocker.
- Summarize validation in a few lines:
  - what was checked,
  - what passed,
  - what could not be verified.

Examples of relevant repo checks include:
- `npm run build`
- `npm run audit`
- `npm run test:redirects` for routing, redirects, or worker route changes
- targeted CSS / service worker / secret audits when related to the change

Never claim success without checking the behavior that changed.

## Response style
Lead with the outcome, then summarize:
- what changed,
- which files were touched,
- how it was verified,
- any risks, follow-ups, or blockers.

Do not append a mandatory report block to every response.
Do not dump stdout/stderr by default.

## Repository-specific guardrails

### Routing and Workers
- Keep Worker routes narrow. Do not bind Workers to apex or `www` catch-all routes unless the task explicitly requires it.
- Be careful with `_redirects`. Preserve the site’s static Pages behavior and avoid redirect/404 loop regressions.
- Treat `wrangler` config names and deploy targets as sensitive; avoid accidental cross-worker overwrites.
- Prefer repo deploy scripts over ad hoc deploy commands.

### Secrets and config
- Never hardcode secrets in source, docs, tests, or config.
- Use environment variables and the repository’s secret-management flow.
- If a secret appears in existing content, treat it as a security issue and remove/redact it safely.

### CSS and assets
- Prefer the repo’s CSS source/build flow instead of editing generated output directly.
- Be careful with asset paths, filename casing, and content references.
- Avoid inline styles unless clearly justified.

### Build, cache, and service worker
- Respect versioning/build steps that keep asset references and cache keys in sync.
- Be careful with service worker changes; avoid stale-cache regressions.
- Do not bypass the repo’s atomic ship/deploy workflow.

### File hygiene
- Keep debug files, reports, and one-off diagnostics out of the repo root unless the task explicitly targets them.
- Do not commit `node_modules`, generated clutter, or temporary artifacts.

### Encoding
- Preserve UTF-8 without BOM and avoid double-encoding issues.

## Scope
This file is for repo-wide behavior only.
Put narrower rules in `.github/instructions/*.instructions.md` when they apply only to specific paths, workflows, or tools.
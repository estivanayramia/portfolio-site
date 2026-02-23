<!-- MEMORY.md · estivanyramia.com -->
<!-- TIER 2: Forensics file. Load by §SECTION when investigating a breakage. -->
<!-- TIER 1: Compact prevention rules → CLAUDE.md (read every session) -->
<!-- UPDATE: node tools/update-agent-memory.mjs --title ... --detail ... (full args) -->

# MEMORY.md — Agent Forensics Log

## Two-Tier System

| File | Purpose | When to read | Size |
|---|---|---|---|
| `CLAUDE.md` | Prevention rules | Every session start | < 6 KB always |
| `docs/MEMORY.md` | Full forensics | When investigating breakage | Unbounded |

**Update both files in one command:**
```
node tools/update-agent-memory.mjs \
  --section ROUTING \
  --rule "NEVER..." --trigger "When..." --after "what broke" \
  --title "Incident title" \
  --detail "Full root cause + fix description" \
  --files "_redirects,wrangler.toml" \
  --validate "npm run test:redirects" \
  --status "✅ Fixed"
```

**Self-revive:** If `CLAUDE.md` is ever deleted or corrupted:
`npm run memory:revive` — rebuilds it from `**CLAUDE.md rule:**` entries below.

---

## §ROUTING — Forensics

> Quick rules: `CLAUDE.md §ROUTING`

### ROUTING-001 — ERR_TOO_MANY_REDIRECTS (✅ Fixed 2026-02-11)

**What broke:** `www.estivanayramia.com` → `ERR_TOO_MANY_REDIRECTS` in all browsers, all networks.

**Root cause:** `worker/wrangler.toml` contained route matching `www.estivanayramia.com/*`. Cloudflare Pages custom domain canonicalization redirects `www → apex`. Worker intercepted that, re-routed to itself, retriggered Pages canonicalization → infinite loop.

**Fix applied:** Removed `www.*` from Worker routes.

**CLAUDE.md rule:** §ROUTING — "NEVER bind Worker routes to www.estivanayramia.com/* or estivanayramia.com/* (Pages owns apex/www)"
**CLAUDE.md rule:** §ROUTING — "NEVER set _redirects catch-all to status 404 — always /* /EN/404.html 200"
**CLAUDE.md rule:** §ROUTING — "NEVER use duplicate name field in wrangler configs"

---

### ROUTING-002 — _redirects Catch-all Status 404 (✅ Fixed 2026-02-11)

**What broke:** Custom 404 page returned HTTP 404 instead of 200, breaking SPA routing.

**Root cause:** Generator emitted `/* ... 404`. Pages needs `200` to serve content.

**CLAUDE.md rule:** §ROUTING — "NEVER set _redirects catch-all to status 404 — always /* /EN/404.html 200"

---

### ROUTING-003 — Worker Name Collision (✅ Fixed 2026-02-11)

**What broke:** `wrangler deploy` overwritten main portfolio Worker with chat Worker.

**Root cause:** Duplicate `name = "portfolio-worker"` in multiple configs.

**CLAUDE.md rule:** §ROUTING — "NEVER use duplicate name field in wrangler configs"

---

## §SEC — Forensics

> Quick rules: `CLAUDE.md §SEC`

### SEC-001 — API Keys in Source Files (⚠️ Active)

**What broke:** `npm run audit:secrets` failed build.

**Root cause:** `GEMINI_API_KEY` literals in 7 files.

**CLAUDE.md rule:** §SEC — "NEVER write secret keys as literals in source/docs/tests — use env.KEY_NAME"
**CLAUDE.md rule:** §SEC — "NEVER commit if npm run audit:secrets fails"

---

### SEC-002 — serve@14.2.5 Vulnerability (⚠️ DevDep)

**What broke:** `npm audit` high severity.

**Fix:** Use `wrangler pages dev`.

**CLAUDE.md rule:** §SEC — "NEVER use serve (vuln) — use wrangler pages dev"

---

## §CSS — Forensics

> Quick rules: `CLAUDE.md §CSS`

### CSS-001 — theme.css Manual Edit Drift (⚠️ Monitored)

**What broke:** Styles lost after build.

**Root cause:** Edited generated file `theme.css`.

**CLAUDE.md rule:** §CSS — "NEVER edit theme.css manually — use input.css + npm run build:css"

---

### CSS-002 — Inline Styles (⚠️ Monitored)

**What broke:** CSP violations, hidden styles.

**CLAUDE.md rule:** §CSS — "NEVER use inline style="" without <!-- inline-css: reason -->"

---

### CSS-003 — Broken CSS References (✅ Fixed)

**What broke:** 404s after rename.

**CLAUDE.md rule:** §CSS — "NEVER rename CSS without grep-searching HTML refs"

---

## §BUILD — Forensics

> Quick rules: `CLAUDE.md §BUILD`

### BUILD-001 — Fragility (⚠️ By Design)

**Mitigation:** Atomic deploys.

**CLAUDE.md rule:** §BUILD — "NEVER push without full npm run build"
**CLAUDE.md rule:** §BUILD — "ALWAYS use npm run ship for atomic deploys"

---

### BUILD-002 — SW Cache Mismatch (✅ Fixed)

**What broke:** Stale content on mobile.

**Root cause:** Skipped `build:version`.

**CLAUDE.md rule:** §BUILD — "NEVER skip build:version (breaks SW cache key)"

---

## §WORKER — Forensics

> Quick rules: `CLAUDE.md §WORKER`

### WORKER-001 — Secrets in Worker (⚠️ Active)

**What broke:** Hardcoded secrets.

**CLAUDE.md rule:** §WORKER — "NEVER hardcode secrets in worker.js or wrangler.toml"

---

## §SW — Forensics

> Quick rules: `CLAUDE.md §SW`

### SW-001 — SW Version Drift (✅ Fixed)

**What broke:** Stuck on old version.

**CLAUDE.md rule:** §SW — "NEVER push sw.js without npm run build:sw"
**CLAUDE.md rule:** §SW — "NEVER let SW version diverge from build stamp"

---

## §ENCODING — Forensics

> Quick rules: `CLAUDE.md §ENCODING`

### ENCODING-001 — BOM & Double-Encoding (✅ Fixed)

**What broke:** Garbled chars `Γ¥î`.

**Root cause:** BOM + double pass.

**CLAUDE.md rule:** §ENCODING — "NEVER save with UTF-8 BOM"
**CLAUDE.md rule:** §ENCODING — "NEVER double-encode files (causes garbled chars)"

---

## §HOUSE — Forensics

> Quick rules: `CLAUDE.md §HOUSE`

### HOUSE-001 — Debug HTML in Root (⚠️ Needs Cleanup)

**CLAUDE.md rule:** §HOUSE — "NEVER commit debug HTML to root — use tools/debug/"

---

### HOUSE-002 — CI Artifacts in Root (⚠️ Needs Cleanup)

**CLAUDE.md rule:** §HOUSE — "NEVER commit CI artifacts to root — use .reports/"

---

### HOUSE-003 — Scripts in Root (⚠️ Needs Cleanup)

**CLAUDE.md rule:** §HOUSE — "NEVER place scripts in root — use scripts/ or tools/"

---

  ### HOUSE-MLYQE0V1 — Incident (Active)

**Date:** 2026-02-23
**What broke:** found 12 untracked TODOs in codebase
**Root cause:** 12 TODO comments with no associated issue number found across codebase
**Files:** `index.html,assets/js/site.js`
**Val:** `grep -r 'TODO' . --include='*.js'`
**CLAUDE.md rule:** §HOUSE — "NEVER leave TODO comments without a tracking issue"

---

  ### HOUSE-MLYRLE9F — Incident (Fixed)

**Date:** 2026-02-23
**What broke:** coverflow-diagnostic.html, luxury-coverflow.html, redirect-debug.html removed
**Root cause:** 3 debug HTML files were publicly deployed to Cloudflare Pages via root. Deleted. No references to them found in source.
**Files:** `coverflow-diagnostic.html,luxury-coverflow.html,redirect-debug.html,.gitignore`
**Val:** `git ls-files | grep -E 'diagnostic|luxury-coverflow|redirect-debug'`
**CLAUDE.md rule:** §HOUSE — "NEVER commit debug HTML to root  use tools/debug/ (gitignored)"

---

  ### HOUSE-MLYRLHTJ — Incident (Fixed)

**Date:** 2026-02-23
**What broke:** audit_failure_log.txt, redirect-trace.txt, test_matrix.json removed and gitignored
**Root cause:** 3 CI output artifacts committed to root, publicly visible. Deleted and added to .gitignore.
**Files:** `audit_failure_log.txt,redirect-trace.txt,test_matrix.json,.gitignore`
**Val:** `git ls-files | grep -E 'audit_failure_log|redirect-trace|test_matrix'`
**CLAUDE.md rule:** §HOUSE — "NEVER commit CI artifacts to root  use .reports/ (gitignored)"

---

  ### HOUSE-MLYRLNAM — Incident (Fixed)

**Date:** 2026-02-23
**What broke:** test-chat-errors.ps1 moved from root to scripts/
**Root cause:** PowerShell test script was in root. Moved to scripts/.
**Files:** `test-chat-errors.ps1,scripts/test-chat-errors.ps1`
**Val:** `git ls-files | grep -E '^[^/]+\.ps1$'`
**CLAUDE.md rule:** §HOUSE — "NEVER place scripts in root  use scripts/ or tools/"

---

## §AUTO-UPDATE LOG

<!-- ✍️ Auto-appended by tools/update-agent-memory.mjs — DO NOT edit manually -->
<!-- FORMAT: YYYY-MM-DD | §SECTION | ID | TITLE | STATUS -->

| Date | Section | ID | Title | Status |
|---|---|---|---|---|
| 2026-02-11 | §ROUTING | ROUTING-001 | ERR_TOO_MANY_REDIRECTS | ✅ Fixed |
| 2026-02-22 | ALL | INIT | Two-tier memory initialized | ✅ Active |
| 2026-02-23 | §HOUSE | HOUSE-MLYQE0V1 | Untracked TODO Comments | Active |
| 2026-02-23 | §HOUSE | HOUSE-MLYRLE9F | HOUSE-001  Debug HTML in Root  | Fixed |
| 2026-02-23 | §HOUSE | HOUSE-MLYRLHTJ | HOUSE-002  CI Artifacts in Roo | Fixed |
| 2026-02-23 | §HOUSE | HOUSE-MLYRLNAM | HOUSE-003  Script in Root Reso | Fixed |

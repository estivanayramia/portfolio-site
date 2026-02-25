<!-- CLAUDE.md · estivanyramia.com -->
<!-- TIER 1: Prevention. Read every session. Hard limit: 6 KB. -->
<!-- TIER 2: Forensics → docs/MEMORY.md (load by §SECTION) -->
<!-- UPDATE: node tools/update-agent-memory.mjs (see Boris Protocol) -->

# CLAUDE.md — Agent Prevention Rules

> **Boris Protocol — end every correction with:**
> `node tools/update-agent-memory.mjs --section X --rule "NEVER..." --trigger "..." --after "..."`
> (Add `--title` `--detail` `--files` `--validate` for full forensics)

## Session Start Checklist
- [ ] Read this file (always < 6 KB)
- [ ] `npm run audit` (secrets, CF, inline-css, sync, sw, encoding)
- [ ] `npm run test:redirects` (if routing/workers)
- [ ] `npm run memory:health` (if doubts)

---

## §ROUTING
- **NEVER** bind Worker routes to `www.estivanayramia.com/*` or `estivanayramia.com/*` (Pages owns apex/www)
- **NEVER** set `_redirects` catch-all to status `404` — always `/* /EN/404.html 200`
- **NEVER** use duplicate `name` field in wrangler configs
- **ALWAYS** keep Worker routes narrow: `/chat*`, `/api/*`, `/health` — never `/*`
- **WHEN** editing `_redirects`: run `npm run test:redirects` immediately after
- **WHEN** adding Worker config: grep all `.toml` for `name =` to ensure uniqueness
- **WHEN** redirect loop: check Worker routes for `www.*` or apex `/*` first

---

## §SEC
- **NEVER** write secret keys as literals in source/docs/tests — use `env.KEY_NAME`
- **NEVER** commit if `npm run audit:secrets` fails
- **NEVER** use `serve` (vuln) — use `wrangler pages dev`
- **ALWAYS** store secrets via `wrangler secret put` — never in files
- **WHEN** writing docs: use `<REDACTED>` or `env.VAR_NAME`
- **WHEN** adding Worker feature: pass `audit:secrets` before commit

---

## §CSS
- **NEVER** edit `theme.css` manually — use `input.css` + `npm run build:css`
- **NEVER** use inline `style=""` without `<!-- inline-css: reason -->`
- **NEVER** rename CSS without grep-searching HTML refs
- **WHEN** touching CSS: run `audit:css-sync` + `audit:inline-css`
- **WHEN** visual drift: regenerate `theme.css`

---

## §BUILD
- **NEVER** push without full `npm run build`
- **NEVER** skip `build:version` (breaks SW cache key)
- **NEVER** use `git commit --amend` after `npm run apply:versioning` (HEAD changes can re-stale `?v=` refs)
- **NEVER** manually push artifacts — use `npm run ship`
- **ALWAYS** use `npm run ship` for atomic deploys
- **WHEN** push is blocked by versioning hooks: run `npm run apply:versioning` → `git add -A` → fresh `git commit` (no amend) → `git push`

---

## §WORKER
- **NEVER** hardcode secrets in `worker.js` or `wrangler.toml`
- **NEVER** use duplicate `name` in wrangler configs
- **NEVER** run bare `wrangler deploy` — use `npm run deploy:worker-name`
- **ALWAYS** test locally `npm run dev:worker-name`
- **WHEN** deploying: verify target name

---

## §SW
- **NEVER** push `sw.js` without `npm run build:sw`
- **NEVER** let SW version diverge from build stamp
- **WHEN** changing assets: bump SW version via `build:version`

---

## §ENCODING
- **NEVER** save with UTF-8 BOM
- **NEVER** double-encode files (causes garbled chars)
- **WHEN** garbled text appears: run `audit:encoding`
- **ALWAYS** save as UTF-8 no BOM

---

## §HOUSE
- **NEVER** commit debug HTML to root — use `tools/debug/`
- **NEVER** commit CI artifacts to root — use `.reports/`
- **NEVER** place scripts in root — use `scripts/` or `tools/`
- **WHEN** creating file: check `.gitignore` or versioned dir

---

## §AUTO-UPDATE LOG

<!-- ✍️ Auto-appended by tools/update-agent-memory.mjs — DO NOT edit manually -->
<!-- FORMAT: YYYY-MM-DD | §SECTION | RULE | AFTER -->

| Date | Section | Rule | After |
|---|---|---|---|
| 2026-02-11 | §ROUTING | Never bind Worker to www.* | ERR_TOO_MANY_REDIRECTS |
| 2026-02-11 | §ROUTING | _redirects catch-all → 200 | Custom 404 broke Pages |
| 2026-02-11 | §ROUTING | Unique wrangler name per config | Worker overwrite |
| 2026-02-21 | §SEC | No key literals in source | audit:secrets flagged 7 |
| 2026-02-21 | §SEC | No serve@14.x | High-severity vuln |
| 2026-02-21 | §ENCODING | No BOM or double-encode | Garbled unicode |
| 2026-02-22 | §HOUSE | Debug HTML never in root | coverflow-diagnostic.html |
| 2026-02-22 | §HOUSE | CI artifacts → .reports/ | audit_failure_log.txt |
| 2026-02-22 | ALL | CLAUDE.md compressed | < 4KB target met |
| 2026-02-23 | §HOUSE | NEVER commit node_modules to the repo | accidental node_modules commit |
| 2026-02-23 | §HOUSE | NEVER leave TODO comments without a trac | found 12 untracked TODOs in co |
| 2026-02-23 | §HOUSE | NEVER commit debug HTML to root  use too | coverflow-diagnostic.html, lux |
| 2026-02-23 | §HOUSE | NEVER commit CI artifacts to root  use . | audit_failure_log.txt, redirec |
| 2026-02-23 | §SEC | NEVER write GEMINI_API_KEY or x-goog-api | audit:secrets blocked build  7 |
| 2026-02-23 | §WORKER | NEVER put secrets in wrangler.toml [vars | GEMINI_API_KEY was in wrangler |

- **NEVER commit node_modules to the repo** (WHEN running npm install for the first time)
- **NEVER leave TODO comments without a tracking issue**
- **NEVER commit debug HTML to root  use tools/debug/ (gitignored)**
- **NEVER commit CI artifacts to root  use .reports/ (gitignored)**
- **NEVER write GEMINI_API_KEY or x-goog-api-key as a literal in source, tests, or docs**
- **NEVER put secrets in wrangler.toml [vars]  use wrangler secret put only**
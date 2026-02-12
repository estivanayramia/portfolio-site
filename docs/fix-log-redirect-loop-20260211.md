# Redirect Loop Fix - 2026-02-11

## Problem
`ERR_TOO_MANY_REDIRECTS` when loading `www.estivanayramia.com`.

## Root Cause (Repo Findings)
- Worker route configs included `www.estivanayramia.com/*` patterns. This can conflict with Pages custom-domain canonicalization and/or Cloudflare Redirect Rules, and is explicitly forbidden by the site routing policy.
- The `_redirects` catch-all (`/* ...`) swallowed real files (including `/`, `/404.html`, and assets) and forced requests into `/EN/404`, which then self-redirected (`308 -> /EN/404`) on Pages preview URLs.
- Cloudflare Pages project config was set to `pages_build_output_dir = "."` instead of `dist`, causing unstable deploy behavior relative to the repo build pipeline.

## Fix Applied (Repo)
- Removed all `www.estivanayramia.com/*` Worker routes from:
  - `worker/wrangler.toml`
  - `worker/wrangler.chat.toml`
  - `worker/wrangler.debugger.toml`
- Ensured each Worker config has a unique `name` to prevent accidental overwrites during deploy.
- Removed `_redirects` catch-all handling from generator output to stop Pages from rewriting all requests into `/EN/404`.
- Updated redirect validation scripts to reject catch-all rules for this non-SPA site.
- Updated Pages build verification to validate `dist/` output and key files.
- Performed direct Pages deploys from `dist/` (preview + production) using Wrangler to restore service immediately.
- Restored main worker apex routes (`/api/*`, `/health`) after Pages recovery.

## Files Changed
- `_redirects`
- `tools/fix-seo.mjs`
- `worker/wrangler.toml`
- `worker/wrangler.chat.toml`
- `worker/wrangler.debugger.toml`
- `wrangler.jsonc`
- `tools/debug-redirects.mjs`
- `scripts/health-check.mjs`
- `package.json`
- `.gitignore`
- `test_matrix.json`

## Cloudflare Changes (Manual, Not Done By Repo Agent)
Record what you changed in the Cloudflare dashboard here:
- Pages project → Custom domains:
  - Primary domain:
  - Secondary domain(s):
- Workers routes removed/updated:
- Redirect Rules disabled/removed:
- Page Rules (legacy) removed:
- SSL/TLS mode:

## Validation Results
- Local static checks:
  - `npm run test:redirects`
- Live redirect trace (run from a network that can reach the domain):
  - `node tools/debug-redirects.mjs > $env:TEMP\redirect-analysis.txt`
  - `REDIRECT_CHECK_LIVE=1 npm run test:redirects`
- Verified after direct deploy:
  - `https://6ba726d6.portfolio-site-t6q.pages.dev` -> `200`
  - `https://estivanayramia.com` -> `200`
  - `https://estivanayramia.com/about` -> `200`
  - `https://estivanayramia.com/projects` -> `301 -> /projects/ -> 200`
  - `GET https://estivanayramia.com/api/health` -> `200` (JSON)
  - `https://www.estivanayramia.com` currently unresolved (custom domain needs re-add as secondary)

## Rollback Procedure (if needed)
- Code rollback:
  - `git log --oneline -10`
  - `git revert <commit>` (or `git reset --hard <sha>` if safe)
- Cloudflare rollback: see `docs/rollback-procedures.md`.

## Prevention
- Never bind Workers to `www.*` hostnames when Pages custom domains are used.
- Keep Worker routes narrow (`/api/*`, `/health`) and avoid `/*`.
- Do not use `_redirects` catch-all (`/* ...`) for this multi-page static site; allow Pages to serve real files and native 404 handling.
- Keep Cloudflare Pages build output directory set to `dist`.

# Redirect Loop Fix - 2026-02-11

## Problem
`ERR_TOO_MANY_REDIRECTS` when loading `www.estivanayramia.com`.

## Root Cause (Repo Findings)
- Worker route configs included `www.estivanayramia.com/*` patterns. This can conflict with Pages custom-domain canonicalization and/or Cloudflare Redirect Rules, and is explicitly forbidden by the site routing policy.
- `_redirects` catch-all served `/EN/404.html` with status `404` instead of `200`, which contradicts the documented requirement for Pages/Workers static-asset compatibility.

## Fix Applied (Repo)
- Removed all `www.estivanayramia.com/*` Worker routes from:
  - `worker/wrangler.toml`
  - `worker/wrangler.chat.toml`
  - `worker/wrangler.debugger.toml`
- Ensured each Worker config has a unique `name` to prevent accidental overwrites during deploy.
- Changed `_redirects` catch-all to serve `/EN/404.html` with `200`.
- Updated the `_redirects` generator (`tools/fix-seo.mjs`) so future regen keeps catch-all at `200`.

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

## Rollback Procedure (if needed)
- Code rollback:
  - `git log --oneline -10`
  - `git revert <commit>` (or `git reset --hard <sha>` if safe)
- Cloudflare rollback: see `docs/rollback-procedures.md`.

## Prevention
- Never bind Workers to `www.*` hostnames when Pages custom domains are used.
- Keep Worker routes narrow (`/api/*`, `/health`) and avoid `/*`.
- Keep `_redirects` catch-all serving a 404 page with `200`.

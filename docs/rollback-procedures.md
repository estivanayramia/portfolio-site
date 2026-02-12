# Rollback Procedures

## Rollback Code Changes
Option A — Revert commit(s) (safe for shared branches):

```bash
git revert <COMMIT_SHA>
git push
```

Option B — Reset hard (only if you control the branch and understand the impact):

```bash
git reset --hard <COMMIT_SHA>
git push -f
```

## Rollback Worker Deployments
If a Worker deploy introduced an issue, roll back via Cloudflare dashboard or redeploy a known-good version from git:

```bash
cd worker
npx wrangler deploy --config wrangler.toml
npx wrangler deploy --config wrangler.chat.toml
npx wrangler deploy --config wrangler.debugger.toml
```

## Rollback Pages Deployment
Cloudflare Dashboard → Pages → `portfolio-site` → Deployments → select a previous deployment → “Rollback to this deployment”.

## Rollback Cloudflare Settings (Manual)
- Custom domains:
  - Ensure apex is primary.
  - Remove any conflicting custom domain bindings from Workers.
- Redirect Rules:
  - Remove any apex → www redirects.
  - Prefer a single www → apex redirect (or let Pages handle it).
- SSL/TLS:
  - Avoid “Flexible”; use “Full” or “Full (strict)”.

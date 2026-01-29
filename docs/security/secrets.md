# secrets

Do not commit real secrets.

## Cloudflare Worker secret

Set a dashboard password via Cloudflare secrets / environment variables (not in git).

Supported options:

- Recommended: `DASHBOARD_PASSWORD_HASH` (64-char sha256 hex)
- Allowed fallback: `DASHBOARD_PASSWORD` (plain text)

Notes:

- `DASHBOARD_PASSWORD_HASH` also accepts plain text for transitional setups, but prefer sha256 hex.
- The placeholder `__SET_VIA_CLOUDFLARE_SECRETS__` is expected in repo config and must be replaced
  by a real secret in Cloudflare for both Preview and Production deployments.

Wrangler CLI (recommended):

- `wrangler secret put DASHBOARD_PASSWORD`
- or `wrangler secret put DASHBOARD_PASSWORD_HASH`

Cloudflare Dashboard:

- Workers & Pages → your Worker → Settings → Variables → add secret text

## Deployment Checklist

Use this checklist whenever dashboard login shows “server_not_configured” or when a Pages Preview build can’t log in.

1. Set secrets for BOTH environments

- In Cloudflare Dashboard, use the environment switcher/tabs to set the secret for **Production** and **Preview**.
- Add either:
  - `DASHBOARD_PASSWORD_HASH` (recommended; sha256 hex)
  - or `DASHBOARD_PASSWORD` (plain text)

1. Redeploy the Worker

- After changing secrets, redeploy the Worker so the new environment variables apply.

1. Verify auth configuration without revealing secrets

- Call `GET /api/health` (or `GET /health`) on the Worker.
  - Expect `authConfigured: true` and `authSource` set.
- In the dashboard, open the **System** tab and confirm:
  - **Backend Health** = OK
  - **Auth Configured** = Yes

Keep `worker/wrangler.toml` set to the placeholder value:

- `__SET_VIA_CLOUDFLARE_SECRETS__`

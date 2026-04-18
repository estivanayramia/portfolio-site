# secrets

Do not commit real secrets.

## Dashboard auth secret

Set the dashboard password in the Cloudflare Pages project that serves `functions/`.

Supported options:

- Recommended: `DASHBOARD_PASSWORD_HASH` (64-char sha256 hex)
- Allowed fallback: `DASHBOARD_PASSWORD` (plain text)

Notes:

- `DASHBOARD_PASSWORD_HASH` also accepts plain text for transitional setups, but prefer sha256 hex.
- Secrets must be configured in Cloudflare (they are not stored in git).

Cloudflare Dashboard:

- Workers & Pages → select the Pages project for `estivanayramia.com`
- Settings → Variables and Secrets
- Add the secret in both Preview and Production

Legacy worker sandbox note:

- `worker/wrangler.debugger.toml` is no longer the selected production owner for `/api/auth`, `/api/health`, `/api/error-report`, or `/api/errors*`.

## Deployment Checklist

Use this checklist whenever dashboard login shows “server_not_configured” or when a Pages Preview build can’t log in.

1. Set secrets for BOTH environments

- In Cloudflare Dashboard, use the environment switcher/tabs to set the secret for **Production** and **Preview**.
- Add either:
  - `DASHBOARD_PASSWORD_HASH` (recommended; sha256 hex)
  - or `DASHBOARD_PASSWORD` (plain text)

1. Redeploy the Pages project

- After changing secrets or bindings, redeploy the Pages project so the new environment variables apply.

1. Verify auth configuration without revealing secrets

- Call `GET /api/health` (or `GET /health`) on the Pages project.
  - Expect `authConfigured: true` and `authSource` set.
- In the dashboard, open the **System** tab and confirm:
  - **Backend Health** = OK
  - **Auth Configured** = Yes

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

Keep `worker/wrangler.toml` set to the placeholder value:

- `__SET_VIA_CLOUDFLARE_SECRETS__`

# secrets

Do not commit real secrets.

## Cloudflare Worker secret

Set `DASHBOARD_PASSWORD_HASH` via Cloudflare secrets (not in git):

- `wrangler secret put DASHBOARD_PASSWORD_HASH`

Keep `worker/wrangler.toml` set to the placeholder value:

- `__SET_VIA_CLOUDFLARE_SECRETS__`

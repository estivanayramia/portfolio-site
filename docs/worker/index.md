# Savonie chatbot backend Worker

Cloudflare Worker that powers the Savonie chat widget used on the portfolio site.

## Configuration

This repo deploys two Workers:

- `portfolio-chat` (chat only)
  - Required secret: `GEMINI_API_KEY`
  - Optional KV (site facts): `SAVONIE_KV`
- `portfolio-worker` (debugger/error ingestion + dashboard auth + health)
  - Required secret: `DASHBOARD_PASSWORD` (plain) OR `DASHBOARD_PASSWORD_HASH` (sha256 hex)
  - Required bindings: `DB` (D1) and `SAVONIE_KV` (sessions/rate limit)

Set secrets via Cloudflare dashboard, or via Wrangler (recommended):

- `cd worker && npx wrangler secret put GEMINI_API_KEY --config wrangler.chat.toml`
- `cd worker && npx wrangler secret put DASHBOARD_PASSWORD --config wrangler.debugger.toml`

## Local development

- Chat worker: `cd worker && npx wrangler dev --config wrangler.chat.toml`
- Debugger worker: `cd worker && npx wrangler dev --config wrangler.debugger.toml`

## Deployment

- Chat worker: `cd worker && npx wrangler deploy --config wrangler.chat.toml`
- Debugger worker: `cd worker && npx wrangler deploy --config wrangler.debugger.toml`


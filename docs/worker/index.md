# Savonie and Dashboard Runtime Overview

This repo currently uses two runtime layers:

- `portfolio-chat`
  - Production owner for `/chat` and `/api/chat`
  - Config: `worker/wrangler.chat.toml`
  - Required secret: `GEMINI_API_KEY`
  - Optional KV: `SAVONIE_KV`
- Cloudflare Pages Functions
  - Production owner for `/health`, `/api/health`, `/api/auth`, `/api/error-report`, and `/api/errors*`
  - Entrypoints live under `functions/`
  - Required production bindings/secrets: `DB`, `SAVONIE_KV`, and `DASHBOARD_PASSWORD` or `DASHBOARD_PASSWORD_HASH`

Legacy worker configs still exist for debugger/error-api sandboxing:

- `worker/wrangler.toml`
- `worker/wrangler.debugger.toml`

Keep those detached from apex/www routes unless the dashboard API is intentionally migrated back behind a Worker.

## Local development

- Production-like Pages Functions runtime: `wrangler pages dev . --port 5500`
- Chat worker only: `cd worker && npx wrangler dev --config wrangler.chat.toml`
- Legacy debugger worker sandbox only: `cd worker && npx wrangler dev --config wrangler.debugger.toml`

## Deployment

- Chat worker: `cd worker && npx wrangler deploy --config wrangler.chat.toml`
- Pages project: deploy the site that serves `functions/`
- Legacy debugger worker sandbox only: `cd worker && npx wrangler deploy --config wrangler.debugger.toml`

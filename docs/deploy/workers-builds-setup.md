# Cloudflare Workers Builds Setup

This repo deploys two different runtime layers:

- Cloudflare Pages for the site and Pages Functions under `functions/`
- Cloudflare Worker Builds for the dedicated Savonie chat worker

The legacy debugger worker configs remain in the repo for sandboxing, but they should not own production dashboard routes while Pages Functions is the selected source of truth.

## Runtime ownership

| Surface | Owner | Repo entrypoints |
|---|---|---|
| `/chat`, `/api/chat` | `portfolio-chat` Worker | `worker/chat-worker.js`, `worker/wrangler.chat.toml` |
| `/health` | Pages Functions | `functions/health.js` |
| `/api/health` | Pages Functions | `functions/api/health.js` |
| `/api/auth` | Pages Functions | `functions/api/auth.js` |
| `/api/error-report` | Pages Functions | `functions/api/error-report.js` |
| `/api/errors*` | Pages Functions | `functions/api/errors.js`, `functions/api/errors/[id].js` |

## Workers in this repository

| Dashboard name | Wrangler config | Entry file | Production route ownership |
|---|---|---|---|
| `portfolio-chat` | `worker/wrangler.chat.toml` | `worker/chat-worker.js` | Yes |
| `portfolio-worker` | `worker/wrangler.toml` | `worker/debugger-worker.js` | No, workers.dev only |
| `portfolio-api-debugger` | `worker/wrangler.debugger.toml` | `worker/debugger-worker.js` | No, legacy sandbox only |

## Cloudflare dashboard setup

### Pages project

The Pages project that serves this repo must have:

- Functions enabled for the `functions/` directory
- `DB` bound to the production D1 database
- `SAVONIE_KV` bound for sessions, rate limiting, and shared dashboard/chat data
- `DASHBOARD_PASSWORD` or `DASHBOARD_PASSWORD_HASH` configured for both Preview and Production
- optional vars mirrored with the current code contract:
  - `SERVICE_NAME`
  - `RATE_LIMIT_MAX`
  - `RATE_LIMIT_WINDOW`

### Chat worker

Configure the `portfolio-chat` worker build with:

- Root directory: `worker`
- Deploy command: `npx wrangler deploy --config wrangler.chat.toml`
- Secret: `GEMINI_API_KEY`
- Optional binding: `SAVONIE_KV`

### Legacy debugger workers

`portfolio-worker` and `portfolio-api-debugger` can remain connected for workers.dev validation, but should stay detached from apex/www routes unless the dashboard API is intentionally migrated away from Pages Functions.

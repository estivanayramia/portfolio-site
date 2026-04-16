# Error Reporting Endpoint Setup

The site sends diagnostics payloads to `/api/error-report`.

Current production owner:

- Cloudflare Pages Functions
- Entrypoint: `functions/api/error-report.js`
- Shared handler logic: `functions/_lib/dashboard-api.js` and `worker/error-api.js`

## Required production setup

The Cloudflare Pages project serving this repo must have:

- `DB` bound to the production D1 database
- `SAVONIE_KV` bound for sessions and rate limiting

If either binding is missing, `/api/error-report` will return `server_not_configured`.

## Local verification

Use a production-like Pages runtime locally:

```bash
wrangler pages dev . --port 5500
```

Then verify:

```bash
curl http://127.0.0.1:5500/api/health
curl -X POST http://127.0.0.1:5500/api/error-report -H "Content-Type: application/json" -d "{}"
```

## If the endpoint is not configured yet

The diagnostics system fails closed. The public site still works, but reports are not retained until the Pages bindings are configured.

## What data gets sent

```json
{
  "type": "javascript_error",
  "message": "Cannot read property 'foo' of undefined",
  "filename": "https://example.com/script.js",
  "line": 42,
  "col": 15,
  "stack": "Error: ...",
  "timestamp": 1706234567890,
  "url": "https://www.estivanayramia.com/",
  "viewport": "1920x1080",
  "version": "20251125-001"
}
```

- No form values, passwords, tokens, or personal data
- Anonymous by design
- User-consented diagnostics only

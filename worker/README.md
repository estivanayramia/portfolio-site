# Savonie chatbot backend Worker

Cloudflare Worker that powers the Savonie chat widget used on the portfolio site.

## Configuration

- Required secret: `GEMINI_API_KEY`
- Optional binding: `RATE_LIMITER`

Set secrets via Cloudflare dashboard, or via Wrangler:

- `cd worker && npx wrangler secret put GEMINI_API_KEY`

## Development

- `cd worker && npx wrangler dev`

## Deploy

- `cd worker && npx wrangler deploy`

# Chatbot facts refresh

This repo grounds the chatbot on generated site facts stored in Cloudflare Workers
KV (Key-Value).

## Regenerate facts (local)

1. Install dependencies (if needed):
   - npm ci
2. Regenerate facts:
   - npm run build:facts
3. Inspect output:
   - assets/data/site-facts.json
   - Verify titles, summaries, and urls match the current site.
   - Verify urls are canonical (no .html).

## Run tests

- npm run test:facts

This validates:

- site-facts.json structure
- banned terms
- canonical urls
- worker grounding assumptions
- file existence checks

## Upload facts to KV (remote)

Do NOT run upload unless credentials are present.

Pre-check:

- Ensure CLOUDFLARE_API_TOKEN or CF_API_TOKEN is set.
- KV binding: SAVONIE_KV
- KV key: site-facts:v1

Upload command (equivalent to npm run upload:facts):

cd worker
npx wrangler kv key put --remote --binding SAVONIE_KV site-facts:v1 --path ../assets/data/site-facts.json

## Verify the worker is reading KV (not fallback)

1. Deploy the worker (if needed):
   - npm run deploy:worker

2. Hit the health endpoint:
   - <https://www.estivanayramia.com/health>

Expected:

- factsKey: site-facts:v1
- factsSource: kv

If factsSource reports fallback:

- KV upload is missing, the binding is misconfigured, or the key contains invalid
   JSON.

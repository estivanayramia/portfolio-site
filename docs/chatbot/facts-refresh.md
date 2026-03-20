# Savonie Grounding Refresh

Savonie now uses a two-layer grounding system plus runtime freshness checks.

## Grounding layers

1. `data/chat/estivan-profile.public.json`
   - Approved public profile, voice rules, boundaries, surface facts, and answer strategy.
   - This is the source of truth for personality, allowed personal facts, and protected-topic handling.

2. `assets/data/chat-page-manifest.json`
   - Generated from the current public site pages.
   - Includes routes, titles, headings, summaries, sections, links, checksums, language, and build version.
   - This is the source of truth for page-specific answers.

3. `assets/data/site-facts.json`
   - Verified project and hobby inventory used for compact routing and list-style answers.

## Runtime freshness

The worker does not blindly trust cached grounding.

- The browser sends the current page build version with each chat request.
- If the build version in the request does not match the cached page manifest, the worker crawls the live site again and refreshes `page-grounding:v1`.
- If live refresh fails, the worker narrows its answer instead of guessing.

## Files to edit when Estivan wants updates

- Public facts / preferences / voice / boundaries:
  - `data/chat/estivan-profile.public.json`

- Generated page grounding:
  - Do not edit `assets/data/chat-page-manifest.json` by hand.
  - Update the public page HTML instead, then regenerate the manifest.

- Project and hobby inventory:
  - Update the relevant site pages or card/index pages, then regenerate `assets/data/site-facts.json`.

## Generate grounding locally

Run:

```bash
npm run build:facts
npm run build:chat-grounding
```

Outputs:

- `assets/data/site-facts.json`
- `assets/data/chat-page-manifest.json`

## Validate locally

Run:

```bash
npm run test:facts
```

This test covers:

- surface facts
- recruiter questions
- boundary handling
- unknown handling
- page-specific grounding
- freshness refresh behavior
- banned-language guardrails

## Upload to KV

The existing upload script now pushes all three grounding artifacts:

- `site-facts:v1`
- `page-grounding:v1`
- `profile:public:v1`

Run:

```bash
npm run upload:facts
```

Requirements:

- `CLOUDFLARE_API_TOKEN` or `CF_API_TOKEN`
- KV binding `SAVONIE_KV`

## Health and debugging

The worker health payload now reports:

- worker version
- whether Gemini is configured
- whether KV is configured
- active grounding keys
- configured site base URL

Debug chat requests with:

- query: `?debug=1`
- header: `X-Savonie-Debug: 1`

## Freshness notes

- Build-time generation keeps the worker fast on normal traffic.
- Runtime live refresh protects against stale page memory after deploys.
- If runtime refresh cannot confirm a fact, Savonie should admit uncertainty and push the user toward direct outreach instead of filling the gap.

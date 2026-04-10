# portfolio-site Agent Contract

This file is the cross-agent bridge for `portfolio-site`. Use it to align VS Code, Copilot, and other coding agents with the repo's real safety rules and validation paths. It is not a second memory system.

## Source Of Truth

- [`.github/copilot-instructions.md`](./.github/copilot-instructions.md): repo-wide Copilot behavior and git/reporting expectations
- [`CLAUDE.md`](./CLAUDE.md): production safety rules for routing, secrets, CSS, build, service worker, worker, encoding, and housekeeping
- [`docs/MEMORY.md`](./docs/MEMORY.md): incident forensics for repeated or unclear failures
- [`package.json`](./package.json): canonical commands
- [`_redirects`](./_redirects), [`_headers`](./_headers), [`sw.js`](./sw.js), [`wrangler.toml`](./wrangler.toml), [`worker/`](./worker): deployment and runtime boundaries
- [`tests/carousel-mobile.spec.js`](./tests/carousel-mobile.spec.js): authoritative carousel, swipe, and responsive regression coverage

## Non-Negotiables

- Do not create or depend on `agent-output/`, Flowbaby, `docs/PRD.yaml`, or alternate memory files.
- Do not broaden worker routes or bind workers to apex or `www` wildcards.
- Do not use bare `wrangler deploy`; use the repo's named scripts.
- Do not hardcode secrets or create `.env` files unless the user explicitly asks.
- Do not hand-edit generated assets such as `theme.css` or minified build outputs when a source file and build step already exist.
- Do not skip build/version/service-worker checks when touching deployable assets.
- Keep findings and plans concise. Prefer local repo evidence over generic templates.

## Validation Map

- General site changes: `npm run build`, `npm run audit`
- Routing or worker changes: `npm run route:smoke`
- Carousel, swipe, or touch regressions: `npm run test:carousel`, `npm run test:about-swipe:quick`
- Visual or layout changes: `npm run visual:check`
- Motion-sensitive changes: `npm run anim:sanity`
- Asset size or performance sensitivity: `npm run perf:budget`
- Memory and governance health: `npm run memory:health`
- Worker local verification: `npm run dev:chat-worker`, `npm run dev:debugger-worker`

## Working Style

- Start with the smallest relevant local surface: the actual files, scripts, and tests tied to the request.
- Use official external docs only when behavior is freshness-sensitive or not discoverable from the repo.
- If a root cause cannot be proven, say so and recommend the smallest next diagnostic step.
- If you create docs on purpose, keep them under `docs/`.

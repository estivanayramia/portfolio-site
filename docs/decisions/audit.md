# Audit Result (Production Readiness)

Date: 2026-01-06  
Scope: static multi-page site (HTML/CSS/JS), PWA (`sw.js`), and Cloudflare
Pages headers (`_headers`).

This file is the required deliverable (Phase 1 report). It is intentionally
action-oriented and designed to drive a sequence of small, reviewable commits.

---

## Scorecard (A+ to F)

- **Architecture**: B-
- **Code Quality**: C+
- **Performance and PWA**: B-
- **Docs and DX**: C
- **Security and SEO**: C+

---

## Repo inventory summary (Phase 1)

### Build + local smoke

- `git status --porcelain`: only uncommitted file is this report.
- `npm ci`: succeeds; `npm audit` reports 0 vulnerabilities.
- `npm run build`: succeeds (Tailwind + esbuild). This is the current “syntax
   gate” for `assets/js/site.js`.
- `npm run start`: serves locally at `http://localhost:5500/`.

### Entrypoints: which pages load which bundle

- Home page: `index.html` loads `/assets/js/site.min.js`.
- Most other pages: load `/assets/js/site.js` (defer).

Risk/impact: the esbuild output (`site.min.js`) exists but is not used on the
majority of pages, increasing JS bytes and parse/compile cost for most sessions.

### Inline `<script>` blocks (categorized)

This codebase contains multiple inline `<script>` blocks; they fall into:

1) **Required executable JS**
   - Many game pages include large inline scripts powering gameplay.

2) **Inert data scripts**
    - JSON-LD (`<script type="application/ld+json">`) is present on the homepage
       and multiple project pages.

3) **Analytics loaders**
    - No obvious GA/Clarity inline loader was found in HTML. Analytics is loaded
   via `assets/js/lazy-loader.js`. Clarity is loaded via an external script
   URL (no inline injection required).

### Inline event handlers (CSP-relevant)

- Many pages use inline event handlers (e.g., `onload=` on CSS/font links;
   `onclick=` in arcade/game UIs).
- Inline event handlers require `script-src 'unsafe-inline'` unless migrated.

### PWA / Service Worker baseline

- `sw.js` strategy:
  - HTML navigations: network-first (fallback cache)
  - Same-origin assets: stale-while-revalidate
- SW lifecycle:
  - No `skipWaiting()` and no `clients.claim()` (avoids mid-session takeovers).
- Precache list includes `/assets/js/site.js`, `/assets/js/site.min.js`, and `/assets/js/cache-refresh.js`.

---

## Top 5 risks (ordered)

1) **XSS: any `innerHTML` sink is a long-term footgun**
      - Chat rendering was converted to DOM-based rendering (no `innerHTML`) to
         remove the highest-risk sink; other dynamic HTML sinks should still be
         treated carefully.

2) **CSP depends on `script-src 'unsafe-inline'`**
   - Driven by inline scripts (notably JSON-LD and games) + inline event handlers.

3) **Most pages ship unminified JS**
   - Core pages now use `site.min.js`; game/arcade pages still use `site.js`.

4) **SW install can be fragile if precache diverges**
    - Today the precache list appears to match key assets; any missing URL would
       fail `cache.addAll()` and can brick offline until a hard reload.

5) **SEO/maintainability: many “backup/variant” pages**
    - Increases duplication risk and multiplies the surface area for
       security/perf fixes.

---

## Red flags

- Chat assistant rendering should remain DOM-based (no `innerHTML`).
- Large amount of inline JS and inline handlers across arcade/game pages makes
   CSP tightening non-trivial.
- `document.write` should remain removed (legacy sink).

---

## Quick wins (3–5)

1) Remove chat `innerHTML` rendering; switch to DOM-based safe rendering. (done)
2) Remove `document.write` from the bundle (keep download path). (done)
3) Switch non-game pages to `/assets/js/site.min.js` (keep `/assets/js/site.js`
   for dev only). (done for core pages)
4) Reduce CSP reliance on `'unsafe-inline'` for core pages by migrating the
   small inline blocks first. (BUILD_VERSION moved to a meta tag; hobby-page
   carousel/lightbox scripts migrated to `assets/js/site.js`)
5) Split CSP by path (strict for core pages; temporarily relaxed for games) to
   make hardening tractable.

---

## Refactoring roadmap

### P0: correctness + security (minimal UX risk)

- Remove chat assistant `innerHTML` and provide a console self-test harness for
   XSS payloads. (done)
- Replace `document.write` with DOM-safe output. (done)

### P1: CSP hardening (staged)

- Keep `script-src 'unsafe-eval'` removed.
- Migrate small inline scripts to external files or data attributes.
- Use path-based CSP:
  - Strict CSP for core pages
  - Relaxed CSP for game/minigame pages until their inline JS/handlers are migrated

### P2: performance + maintainability

- Standardize on `site.min.js` for production pages.
- Consider splitting `assets/js/site.js` into cohesive modules only if it
   improves change safety (avoid churn).

---

## Proposed commit plan (ordered)

1) `docs: audit report + verification steps`
2) `security(chat): avoid innerHTML`
3) `fix(security): remove document.write from debug path` (done)
4) `perf: switch core pages to site.min.js`
5) `fix(security): staged CSP tightening (core pages first)`
6) `fix(pwa): align precache list with actual critical assets after perf changes`

---

## Verification checklist (commands + expected outcomes)

### Build

- `npm run build`
  - Expected: Tailwind + esbuild succeed; `assets/js/site.min.js` regenerated.

### Local server

- `npm run start`
  - Expected: site available at `http://localhost:5500/`.

### Browser smoke (manual)

- Home page loads clean with no console errors.
- Chat opens, sends/receives messages, renders links, and XSS payloads remain inert.
   Optional: run `window.__savonieXssSelfTest()` in DevTools console.
- Arcade pages still run (no broken controls).
- Service Worker registers without update loops; offline reload serves at least
   the shell.

### CSP (manual)

- No console CSP violations on key pages.
- Confirm `script-src` does not include `'unsafe-eval'`.

---

## Notes / assumptions

- This audit is based on repo scanning plus local build/server checks.
   Browser-console validation steps are listed explicitly because automated
   CSP/XSS verification requires a real browser devtools environment.


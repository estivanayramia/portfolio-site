# Final Integration Accessibility Remediation

Date: 2026-04-18

## Current Branch / Worktree

- Worktree: `C:\Users\estiv\portfolio-site-final-integration`
- Branch: `integrate/final-site-unification`

## Deterministic Lighthouse Failures

- Home:
  - `color-contrast`
- About:
  - `aria-allowed-role`
  - `aria-hidden-focus`
  - `heading-order`
  - `label-content-name-mismatch`
- Projects:
  - `aria-allowed-role`
  - `label-content-name-mismatch`
  - `target-size`

## Concrete Causes Confirmed

- Shared header logo accessible name mismatch came from the generated header markup in `assets/js/site.js`, where an explicit `aria-label` overrode the visible brand text.
- About-specific accessible name mismatches came from the resume CTA `aria-label` and the roulette button `aria-label`.
- Projects accessible name mismatch came from the roulette button `aria-label`.
- Invalid carousel semantics came from `role="listitem"` on `article.coverflow-card` and `role="list"` on the track in About and Projects.
- Hidden-focus regression came from inactive carousel cards keeping focusable descendants active while card roots were moved out of the active state.
- About heading-order risk came from using card-title `h3` elements as repeated carousel labels rather than document-outline headings.
- Home contrast risk came from both the consent banner palette and the cinematic intro timer text.

## Exact Fixes Applied

- Hardened diagnostics consent banner contrast in `assets/js/diagnostics-consent.js`.
- Increased homepage cinematic intro timer contrast in `assets/css/cinematic-intro.css`.
- Updated shared header/footer logo semantics in `assets/js/site.js` so the brand link accessible name matches visible text and decorative logo images are hidden from assistive tech.
- Removed the About resume CTA `aria-label` and hid its decorative SVG from assistive tech.
- Removed roulette button `aria-label`s from About and Projects and hid their decorative icons from assistive tech.
- Removed invalid list/listitem ARIA roles from the luxury coverflow markup on About and Projects.
- Demoted About carousel card titles from heading tags to styled non-heading text.
- Added descendant interactivity management in `assets/js/carousel/luxury-coverflow.js` so only the active center card exposes interactive descendants.

## Validation Results

- `npm run build`: PASS
- `npm run audit`: PASS
- `npm run route:smoke`: PASS
- `npm run anim:sanity`: PASS
- `npm run perf:budget`: PASS
- `npm run test:facts`: PASS
- Direct Playwright quick carousel checks on `http://127.0.0.1:5514`: PASS
- Full `tests/carousel-mobile.spec.js` on `http://127.0.0.1:5514`: PASS (`117/117`)
- `node scripts/animation-sanity.mjs --jank` with `BASE_URL=http://127.0.0.1:5514`: PASS
- Mocked Formspree submission against `http://127.0.0.1:5514/contact`: PASS
- `node scripts/lighthouse-runner.mjs http://127.0.0.1:5514`: PASS
- `npm run audit:lighthouse:gate`: PASS
- `npm run visual:check`: BLOCKED / non-usable because `visual-baseline/` is not present in this worktree

### Lighthouse Outcome

- Home accessibility: `100`
- About accessibility: `100`
- Projects accessibility: `100`
- Remaining Lighthouse warnings are performance-only and are not merge blockers under the current gate configuration.

## Final Merge Decision

- Integration branch is release-safe and can be merged into `main`.

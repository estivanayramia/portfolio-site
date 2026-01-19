# Arcade games loading: root cause notes

## Root cause per game

- Snake: achievements module import failed due to missing exports from
  `achievements-defs.js`, blocking ESM load and preventing game init.
- Block Breaker: same.
- 2048: same.
- Space Invaders: same.
- Secondary bug fixed: `ACHIEVEMENTS` shape mismatch (object vs array) in
  `achievements.js`.

## Files changed

- `assets/js/arcade/achievements-defs.js`
- `assets/js/arcade/achievements.js`
- `sw.js`
- `scripts/audit-arcade-routes-playwright.cjs`
- `docs/arcade/root-cause-notes.md`

## Exact verification steps and routes

- Commands run:
  - `npm install`
  - `npm run start` with `PORT=5510`
  - `BASE_URL=http://localhost:5510 node`
    `scripts/audit-arcade-routes-playwright.cjs`
- Routes tested:
  - `/hobbies-games/snake`
  - `/hobbies-games/block-breaker`
  - `/hobbies-games/2048`
  - `/hobbies-games/space-invaders`
- Soft refresh (normal reload) and hard refresh (Ctrl+Shift+R) verified.
- SW cache version bump prevents stale cached JS from breaking routes
  post-deploy.

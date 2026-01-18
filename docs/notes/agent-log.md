# Agent Log

Date: 2026-01-07
Repo: `estivanayramia/portfolio-site`
Branch: `main`

## Phase 0: Baseline capture

### git status --porcelain
Command:

- `git status --porcelain`

Output:

```text
(no output; working tree clean)
```

### git log -10 --oneline
Command:

- `git log -10 --oneline`

Output:

```text
811251c docs: update perf status
14ce02a perf: use site.min.js on core pages
c8cc819 docs: mark document.write removal
fb27dfd fix(security): remove document.write
6f2aaad docs: update audit after chat fix
12524ca security(chat): avoid innerHTML
f851b39 docs: audit baseline + plan
bc1f014 Security: harden chat rendering, CSP, and SW updates
7494c6c Update hobby page intros and fix grammar
86e2be3 Make all carousels loop by wrapping indices in goToPage functions
```

### npm ci
Command:

- `npm ci`

Output:

```text
added 173 packages, and audited 174 packages in 12s

50 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### npm run build
Command:

- `npm run build`

Output:

```text
> portfolio-site@2.0.0 build
> npm run build:css && npm run build:js

> portfolio-site@2.0.0 build:css
> npx tailwindcss -i ./assets/css/input.css -o ./assets/css/style.css --minify

Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme

Rebuilding...

Done in 1649ms.

> portfolio-site@2.0.0 build:js
> esbuild assets/js/site.js --minify --outfile=assets/js/site.min.js

assets/js/site.min.js  97.3kb
Done in 23ms
```

### npm run start (confirm site boots locally)
Command:

- `npm run start`

Output:

```text
> portfolio-site@2.0.0 start
> serve . -p 5500

Serving!
- Local:   http://localhost:5500
- Network: http://192.168.68.76:5500
```

Notes:

- While running locally, `serve` responded to requests (e.g. GET `/sw.js` returned 304).

---

## Phase 0: Quick grep inventory

### Site entrypoint map

```text
=== site.min.js (39) ===
404.html
about.html
ar/index.html
case-studies.html
contact.html
deep-dive.html
es/index.html
hobbies.html
hobbies/car.html
hobbies/cooking.html
hobbies/gym.html
hobbies/index.html
hobbies/photography.html
hobbies/reading.html
hobbies/whispers.html
hobby-car.html
hobby-cooking.html
hobby-gym.html
hobby-photography.html
hobby-reading.html
hobby-whispers.html
index.html
overview.html
privacy.html
project-competitive-strategy.html
project-conflict.html
project-discipline.html
project-documentation.html
project-logistics.html
project-multilingual.html
project-portfolio.html
projects.html
projects/competitive-strategy.html
projects/discipline.html
projects/documentation.html
projects/index.html
projects/logistics.html
projects/multilingual.html
projects/portfolio.html

=== site.js (20) ===
2048.html
breaker.html
hobbies-games.html
hobbies-games/1024-moves.html
hobbies-games/2048.html
hobbies-games/back-attacker.html
hobbies-games/block-breaker.html
hobbies-games/nano-wirebot.html
hobbies-games/off-the-line.html
hobbies-games/oh-flip.html
hobbies-games/onoff.html
hobbies-games/pizza-undelivery.html
hobbies-games/racer.html
hobbies-games/snake.html
hobbies-games/space-invaders.html
hobbies-games/the-matr13k.html
hobbies-games/triangle-back-to-home.html
hobbies-games/xx142-b2exe.html
invaders.html
snake.html

=== lazy-loader.js (39) ===
(same set as site.min.js pages)
```

### Inline scripts (`<script>` blocks without `src`)

```text
Count: 53 files
Examples include:
- index.html
- about.html
- multiple project pages
- multiple games + MiniGames
```

### Inline event handlers (`onload=`, `onclick=`, etc)

```text
Count: 62 files
Includes core pages (e.g. about.html, contact.html, projects pages) and game pages.
```

### Dangerous sinks inventory

```text
=== innerHTML ===
matches: 105
files: 22

=== insertAdjacentHTML ===
matches: 0
files: 0

=== outerHTML ===
matches: 0
files: 0

=== eval( ===
matches: 0
files: 0

=== new Function ===
matches: 3
files: 3
(appears in MiniGames code paths)

=== document.write ===
matches: 1
files: 1
assets/js/site-refactored.js
```


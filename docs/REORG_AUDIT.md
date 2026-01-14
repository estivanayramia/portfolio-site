# Site Reorganization Audit
**Date:** January 13, 2026  
**Mission:** Move all English content to /en/ folder while preserving existing URLs via redirects

## Phase 0: Full Inventory

### Current Structure - English Pages (Root Level)
**Primary Pages:**
- `index.html` → move to `/en/index.html`
- `about.html` → move to `/en/about.html`
- `contact.html` → move to `/en/contact.html`
- `overview.html` → move to `/en/overview.html`
- `deep-dive.html` → move to `/en/deep-dive.html`
- `privacy.html` → move to `/en/privacy.html`
- `404.html` → move to `/en/404.html`
- `hobbies-games.html` → move to `/en/hobbies-games.html`

**Legacy Pages (to be deleted after redirects confirmed working):**
- `projects.html` (old projects page - already redirects to /projects/)
- `hobbies.html` (old hobbies page - already redirects to /hobbies/)
- `project-*.html` (6 files: competitive-strategy, conflict, discipline, documentation, logistics, multilingual, portfolio) - already redirect to /projects/*
- `hobby-*.html` (6 files: car, cooking, gym, photography, reading, whispers) - already redirect to /hobbies/*
- `case-studies.html` (seems unused/legacy)
- `index-critical.html` (dev artifact)

**Backup/Dev Files (to be deleted or kept as-is):**
- `hobbies-games-*.html` (backup, enhanced, new, v2, backup-enhanced, backup-stacker) - 6 files
- `2048.html`, `breaker.html`, `invaders.html`, `snake.html` (standalone game pages)

### Current Structure - English Sections
**Projects Section:**
- `/projects/index.html` → move to `/en/projects/index.html`
- `/projects/competitive-strategy.html` → move to `/en/projects/competitive-strategy.html`
- `/projects/discipline.html` → move to `/en/projects/discipline.html`
- `/projects/documentation.html` → move to `/en/projects/documentation.html`
- `/projects/logistics.html` → move to `/en/projects/logistics.html`
- `/projects/multilingual.html` → move to `/en/projects/multilingual.html`
- `/projects/portfolio.html` → move to `/en/projects/portfolio.html`

**Hobbies Section:**
- `/hobbies/index.html` → move to `/en/hobbies/index.html`
- `/hobbies/car.html` → move to `/en/hobbies/car.html`
- `/hobbies/cooking.html` → move to `/en/hobbies/cooking.html`
- `/hobbies/gym.html` → move to `/en/hobbies/gym.html`
- `/hobbies/photography.html` → move to `/en/hobbies/photography.html`
- `/hobbies/reading.html` → move to `/en/hobbies/reading.html`
- `/hobbies/whispers.html` → move to `/en/hobbies/whispers.html`

**Hobbies-Games Section:**
- `/hobbies-games/*.html` (13 mini-game pages) → move to `/en/hobbies-games/*.html`
  - 1024-moves.html
  - 2048.html
  - back-attacker.html
  - block-breaker.html
  - nano-wirebot.html
  - off-the-line.html
  - oh-flip.html
  - onoff.html
  - pizza-undelivery.html
  - racer.html
  - snake.html
  - space-invaders.html
  - the-matr13k.html
  - triangle-back-to-home.html
  - xx142-b2exe.html

### Current Structure - Spanish Pages
**Existing:**
- `/es/index.html` (exists, keep)
- `/es/overview.html`, `/es/deep-dive.html`, `/es/about.html`, `/es/projects.html` (mentioned in nav, check if exist)

**Status:** Need to verify which Spanish pages exist and which need placeholders

### Current Structure - Arabic Pages
**Existing:**
- `/ar/index.html` (exists, keep)
- `/ar/overview.html`, `/ar/deep-dive.html`, `/ar/about.html`, `/ar/projects.html` (mentioned in nav, check if exist)

**Status:** Need to verify which Arabic pages exist and which need placeholders

### Assets (NO CHANGES - stays at root)
- `/assets/` (entire folder stays at root)
- `/assets/MiniGames/` (embedded game files, no changes needed)

### Configuration Files (stays at root)
- `_headers`, `_redirects`, `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml`, `humans.txt`, `serve.json`, etc.

---

## Proposed New File Tree

```
/
├── _headers                    # Stay at root
├── _redirects                  # Stay at root (UPDATE with new redirects)
├── manifest.json               # Stay at root (UPDATE start_url)
├── sw.js                       # Stay at root (UPDATE precache paths)
├── robots.txt                  # Stay at root (no changes)
├── sitemap.xml                 # Stay at root (UPDATE URLs)
├── humans.txt                  # Stay at root
├── package.json                # Stay at root
├── tailwind.config.js          # Stay at root
├── /assets/                    # NO CHANGES - stays at root
│   ├── css/
│   ├── js/
│   ├── img/
│   ├── data/
│   │   └── site-facts.json     # UPDATE with /en/ URLs
│   └── MiniGames/
├── /worker/                    # NO CHANGES
│   └── worker.js               # UPDATE linkify logic for /en/ paths
├── /scripts/                   # Stay at root
│   ├── generate-site-facts.js  # UPDATE to parse /en/projects and /en/hobbies
│   └── test-chat-grounding.js  # UPDATE tests for /en/ structure
├── /docs/                      # Stay at root
├── /tools/                     # Stay at root
├── /en/                        # NEW - All English content
│   ├── index.html
│   ├── about.html
│   ├── contact.html
│   ├── overview.html
│   ├── deep-dive.html
│   ├── privacy.html
│   ├── 404.html
│   ├── hobbies-games.html
│   ├── /projects/
│   │   ├── index.html
│   │   ├── competitive-strategy.html
│   │   ├── discipline.html
│   │   ├── documentation.html
│   │   ├── logistics.html
│   │   ├── multilingual.html
│   │   └── portfolio.html
│   ├── /hobbies/
│   │   ├── index.html
│   │   ├── car.html
│   │   ├── cooking.html
│   │   ├── gym.html
│   │   ├── photography.html
│   │   ├── reading.html
│   │   └── whispers.html
│   └── /hobbies-games/
│       ├── 1024-moves.html
│       ├── 2048.html
│       ├── back-attacker.html
│       ├── block-breaker.html
│       ├── nano-wirebot.html
│       ├── off-the-line.html
│       ├── oh-flip.html
│       ├── onoff.html
│       ├── pizza-undelivery.html
│       ├── racer.html
│       ├── snake.html
│       ├── space-invaders.html
│       ├── the-matr13k.html
│       ├── triangle-back-to-home.html
│       └── xx142-b2exe.html
├── /es/                        # EXISTING - verify and fill gaps
│   ├── index.html              # EXISTS
│   ├── overview.html           # VERIFY
│   ├── deep-dive.html          # VERIFY
│   ├── about.html              # VERIFY
│   └── projects.html           # VERIFY
└── /ar/                        # EXISTING - verify and fill gaps
    ├── index.html              # EXISTS
    ├── overview.html           # VERIFY
    ├── deep-dive.html          # VERIFY
    ├── about.html              # VERIFY
    └── projects.html           # VERIFY
```

---

## Redirect Mapping Table

### Root Page Redirects (English → /en/)
| Old URL | New URL | Status | Notes |
|---------|---------|--------|-------|
| `/` | `/en/` | 302 | Temporary - language redirect |
| `/index.html` | `/en/` | 301 | Permanent |
| `/about` | `/en/about` | 301 | |
| `/about.html` | `/en/about` | 301 | |
| `/contact` | `/en/contact` | 301 | |
| `/contact.html` | `/en/contact` | 301 | |
| `/overview` | `/en/overview` | 301 | |
| `/overview.html` | `/en/overview` | 301 | |
| `/deep-dive` | `/en/deep-dive` | 301 | |
| `/deep-dive.html` | `/en/deep-dive` | 301 | |
| `/privacy` | `/en/privacy` | 301 | |
| `/privacy.html` | `/en/privacy` | 301 | |
| `/hobbies-games` | `/en/hobbies-games` | 301 | |
| `/hobbies-games.html` | `/en/hobbies-games` | 301 | |
| `/404.html` | `/en/404.html` | N/A | Special case - might keep at root |

### Projects Redirects
| Old URL | New URL | Status | Notes |
|---------|---------|--------|-------|
| `/projects/` | `/en/projects/` | 301 | |
| `/projects/*` | `/en/projects/:splat` | 301 | Splat rule |
| `/projects/index.html` | `/en/projects/` | 301 | |
| `/projects/competitive-strategy.html` | `/en/projects/competitive-strategy` | 301 | |
| `/projects/competitive-strategy` | `/en/projects/competitive-strategy` | 301 | |
| `/projects/discipline.html` | `/en/projects/discipline` | 301 | |
| `/projects/discipline` | `/en/projects/discipline` | 301 | |
| `/projects/documentation.html` | `/en/projects/documentation` | 301 | |
| `/projects/documentation` | `/en/projects/documentation` | 301 | |
| `/projects/logistics.html` | `/en/projects/logistics` | 301 | |
| `/projects/logistics` | `/en/projects/logistics` | 301 | |
| `/projects/multilingual.html` | `/en/projects/multilingual` | 301 | |
| `/projects/multilingual` | `/en/projects/multilingual` | 301 | |
| `/projects/portfolio.html` | `/en/projects/portfolio` | 301 | |
| `/projects/portfolio` | `/en/projects/portfolio` | 301 | |

### Hobbies Redirects
| Old URL | New URL | Status | Notes |
|---------|---------|--------|-------|
| `/hobbies/` | `/en/hobbies/` | 301 | |
| `/hobbies/*` | `/en/hobbies/:splat` | 301 | Splat rule |
| `/hobbies/index.html` | `/en/hobbies/` | 301 | |
| `/hobbies/car.html` | `/en/hobbies/car` | 301 | |
| `/hobbies/car` | `/en/hobbies/car` | 301 | |
| `/hobbies/cooking.html` | `/en/hobbies/cooking` | 301 | |
| `/hobbies/cooking` | `/en/hobbies/cooking` | 301 | |
| `/hobbies/gym.html` | `/en/hobbies/gym` | 301 | |
| `/hobbies/gym` | `/en/hobbies/gym` | 301 | |
| `/hobbies/photography.html` | `/en/hobbies/photography` | 301 | |
| `/hobbies/photography` | `/en/hobbies/photography` | 301 | |
| `/hobbies/reading.html` | `/en/hobbies/reading` | 301 | |
| `/hobbies/reading` | `/en/hobbies/reading` | 301 | |
| `/hobbies/whispers.html` | `/en/hobbies/whispers` | 301 | |
| `/hobbies/whispers` | `/en/hobbies/whispers` | 301 | |

### Hobbies-Games Redirects
| Old URL | New URL | Status | Notes |
|---------|---------|--------|-------|
| `/hobbies-games/*` | `/en/hobbies-games/:splat` | 301 | Splat rule catches all |

### Legacy Pages (already have redirects, now need double-redirect)
These pages currently redirect to /projects/ or /hobbies/, which will then redirect to /en/projects/ or /en/hobbies/
- `/project-*.html` → Currently: `/projects/*` → After: `/en/projects/*`
- `/hobby-*.html` → Currently: `/hobbies/*` → After: `/en/hobbies/*`
- `/projects.html` → Currently: `/projects/` → After: `/en/projects/`
- `/hobbies.html` → Currently: `/hobbies/` → After: `/en/hobbies/`

**Decision:** Keep existing legacy redirects as-is, they'll automatically work with new redirects (double-hop is fine)

### Clean URL Redirects (preserve under /en/)
All .html to clean URL redirects must be updated to work under /en/:
- `/en/projects/*.html` → `/en/projects/*`
- `/en/hobbies/*.html` → `/en/hobbies/*`
- `/en/hobbies-games/*.html` → `/en/hobbies-games/*`

---

## Delete List

**After redirects confirmed working, delete these files:**
1. Root-level English pages (after moved to /en/):
   - `index.html`
   - `about.html`
   - `contact.html`
   - `overview.html`
   - `deep-dive.html`
   - `privacy.html`
   - `hobbies-games.html`

2. Root-level sections (after moved to /en/):
   - `/projects/` folder
   - `/hobbies/` folder
   - `/hobbies-games/` folder

3. Legacy files (already redirecting, safe to delete):
   - `projects.html`
   - `hobbies.html`
   - `project-competitive-strategy.html`
   - `project-conflict.html`
   - `project-discipline.html`
   - `project-documentation.html`
   - `project-logistics.html`
   - `project-multilingual.html`
   - `project-portfolio.html`
   - `hobby-car.html`
   - `hobby-cooking.html`
   - `hobby-gym.html`
   - `hobby-photography.html`
   - `hobby-reading.html`
   - `hobby-whispers.html`
   - `case-studies.html`
   - `index-critical.html`

4. Backup/Dev files (optional cleanup):
   - `hobbies-games-backup.html`
   - `hobbies-games-backup-enhanced.html`
   - `hobbies-games-backup-stacker.html`
   - `hobbies-games-enhanced.html`
   - `hobbies-games-new.html`
   - `hobbies-games-v2.html`
   - Standalone game pages: `2048.html`, `breaker.html`, `invaders.html`, `snake.html`

**DO NOT DELETE:**
- Configuration files: `_headers`, `_redirects`, `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml`, etc.
- `/assets/` folder (entire folder stays)
- `/worker/` folder
- `/scripts/` folder
- `/docs/` folder
- `/tools/` folder
- `/es/` folder
- `/ar/` folder

---

## Link Graph Audit

### Files That Need Link Updates

**Critical files that contain navigation/links:**
1. All moved HTML pages under /en/ (need internal link updates)
2. `/ar/index.html` - Language switcher points to `/index.html`, should be `/en/`
3. `/ar/index.html` - Contact link points to `/contact.html#main-content`, should be `/en/contact`
4. `/es/index.html` - Language switcher points to `/index.html`, should be `/en/`
5. `/es/index.html` - Contact link points to `/contact.html#main-content`, should be `/en/contact`
6. `/assets/js/site.min.js` or source files - May contain hardcoded paths
7. `/worker/worker.js` - Linkify logic uses `/projects/` and `/hobbies/`, needs `/en/` prefix
8. `scripts/generate-site-facts.js` - Parses `projects/index.html` and `hobbies/index.html`, needs `/en/` prefix
9. `scripts/test-chat-grounding.js` - Tests reference `/projects/` and `/hobbies/`, need `/en/` prefix
10. `sitemap.xml` - All English URLs need `/en/` prefix
11. `manifest.json` - start_url likely points to `/`, should point to `/en/`
12. `sw.js` - Service worker may precache old paths

**Search patterns to run:**
- `href="/projects/` → Should become `href="/en/projects/`
- `href="/hobbies/` → Should become `href="/en/hobbies/`
- `href="/index` → Should become `href="/en/` or `href="/en/index`
- `href="/about` → Should become `href="/en/about`
- `href="/contact` → Should become `href="/en/contact`
- `href="/overview` → Should become `href="/en/overview`
- `href="/deep-dive` → Should become `href="/en/deep-dive`
- `href="/privacy` → Should become `href="/en/privacy`
- `src="/assets/` → Should remain unchanged

---

## Execution Phases Checklist

### Phase 0: Safety ✅
- [x] Create REORG_AUDIT.md with full inventory
- [ ] Build link graph audit (search for href/src references)

### Phase 1: Create /en/ structure
- [ ] Create /en/ directory
- [ ] Move root English pages to /en/
- [ ] Move /projects/ to /en/projects/
- [ ] Move /hobbies/ to /en/hobbies/
- [ ] Move /hobbies-games/ to /en/hobbies-games/
- [ ] Update internal links in all moved pages

### Phase 2: Redirects
- [ ] Update _redirects with comprehensive redirect rules
- [ ] Test redirects locally
- [ ] Commit and deploy

### Phase 3: Multilingual nav
- [ ] Update /ar/index.html language switcher and contact link
- [ ] Update /es/index.html language switcher and contact link
- [ ] Verify cross-language links work

### Phase 4: Chatbot grounding
- [ ] Update scripts/generate-site-facts.js to parse /en/ paths
- [ ] Regenerate assets/data/site-facts.json
- [ ] Update worker/worker.js linkify logic for /en/ paths
- [ ] Update assets/js/site.js language detection

### Phase 5: SEO/AEO
- [ ] Update sitemap.xml with /en/ URLs
- [ ] Update llms.txt with canonical /en/ URLs
- [ ] Add hreflang tags to all pages

### Phase 6: PWA
- [ ] Update manifest.json start_url to /en/
- [ ] Update sw.js precache paths to /en/

### Phase 7: Testing
- [ ] Update scripts/test-chat-grounding.js for /en/ structure
- [ ] Run full test suite
- [ ] Manual smoke testing
- [ ] Document results in this file

---

## Test Results

*Will be populated after Phase 7*

---

## Manual Smoke Test Checklist

- [ ] `/` redirects to `/en/`
- [ ] `/en/` loads correctly
- [ ] `/en/` navigation works (all nav links functional)
- [ ] `/en/` chatbot works and is grounded
- [ ] `/en/projects/` loads and all 6 project pages load
- [ ] `/en/hobbies/` loads and all 6 hobby pages load
- [ ] `/en/hobbies-games/` loads correctly
- [ ] `/es/` still loads
- [ ] `/ar/` still loads
- [ ] Language switcher works (en ↔ es ↔ ar)
- [ ] No broken /assets paths (check CSS/JS/images)
- [ ] Chatbot does not hallucinate projects
- [ ] Old URLs redirect correctly (test 5-10 old URLs)
- [ ] Clean URLs work under /en/ (e.g., /en/projects/logistics not /en/projects/logistics.html)

---

## Notes

**Language Default Strategy:**
- Root `/` redirects to `/en/` with 302 (temporary) to allow future language detection
- All other redirects are 301 (permanent)

**Cloudflare Pages Behavior:**
- Cloudflare Pages automatically serves `about.html` for `/about` requests
- This means `/en/about` will automatically serve `/en/about.html`
- Clean URL redirects (.html → no extension) must exist under /en/ to enforce canonical URLs

**404 Page Special Case:**
- 404.html might need to stay at root for Cloudflare Pages to use it
- Or it might need to exist in all language folders: /en/404.html, /es/404.html, /ar/404.html
- Decision: Move to /en/404.html and test if Cloudflare respects it

**Chatbot Language Awareness:**
- Worker must detect language from URL path (/en/, /es/, /ar/)
- Default linkify to /en/ for English
- If language=es or language=ar detected, linkify to /es/ or /ar/ if pages exist, else fallback to /en/

**Site-Facts Grounding:**
- All URLs in site-facts.json must be updated from `/projects/logistics` to `/en/projects/logistics`
- All filePath values must be updated from `/projects/logistics.html` to `/en/projects/logistics.html`
- Worker validation must check that URLs start with `/en/` for English facts

**Progressive Enhancement:**
- ES and AR folders can be filled with placeholders over time
- Placeholders should link back to /en/ equivalents with a note "English version available"
- Or language switcher can explicitly route missing pages to /en/

---

## Risks & Mitigation

**Risk 1: Breaking existing URLs**
- Mitigation: Comprehensive _redirects file covering all old URLs

**Risk 2: Chatbot hallucinating due to outdated site-facts**
- Mitigation: Regenerate site-facts.json immediately after move, test thoroughly

**Risk 3: /assets paths breaking**
- Mitigation: Use absolute paths starting with `/assets/` (no change needed)

**Risk 4: Service worker caching old paths**
- Mitigation: Update sw.js and bump version to force cache invalidation

**Risk 5: Double-redirects slowing site**
- Mitigation: Acceptable for legacy URLs (project-*.html → /projects/* → /en/projects/*)

**Risk 6: Language switcher confusion**
- Mitigation: Clear EN/ES/AR links, explicit fallback messaging if page doesn't exist

---

## Success Criteria

1. ✅ All English content under /en/
2. ✅ All old URLs redirect correctly
3. ✅ Chatbot grounding works with /en/ paths
4. ✅ No broken assets references
5. ✅ Tests pass
6. ✅ Manual smoke tests pass
7. ✅ SEO/AEO artifacts updated (sitemap, llms.txt, hreflang)
8. ✅ PWA still functional
9. ✅ Language switcher works across all languages

---

*This document will be updated throughout the reorganization process.*

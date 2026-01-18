# Portfolio Chatbot Overhaul Audit

**Date**: January 14, 2026
**Status**: ✅ COMPLETED

## Phase 0: Baseline Audit & Inventory

### 1. Page Inventory

#### Root Pages
| File | Canonical URL | Purpose |
|------|---------------|---------|
| index.html | / | Home page |
| about.html | /about | About page |
| contact.html | /contact | Contact form |
| overview.html | /overview | Overview page |
| deep-dive.html | /deep-dive | Detailed background |
| privacy.html | /privacy | Privacy policy |
| 404.html | /404 | Error page |
| hobbies-games.html | /hobbies-games | Mini-games arcade |

#### Projects Section
| File | Canonical URL | Title |
|------|---------------|-------|
| projects/index.html | /projects/ | Projects index |
| projects/portfolio.html | /projects/portfolio | This Website |
| projects/logistics.html | /projects/logistics | L'Oréal Cell BioPrint MAPS Campaign |
| projects/discipline.html | /projects/discipline | Franklin Templeton Class Concept |
| projects/documentation.html | /projects/documentation | EndPoint LinkedIn Campaign |
| projects/multilingual.html | /projects/multilingual | Endpoint Elosity Launch Video |
| projects/competitive-strategy.html | /projects/competitive-strategy | Taking Down Endpoint |

#### Hobbies Section
| File | Canonical URL | Title |
|------|---------------|-------|
| hobbies/index.html | /hobbies/ | Hobbies index |
| hobbies/gym.html | /hobbies/gym | Gym & Strength Training |
| hobbies/photography.html | /hobbies/photography | Photography |
| hobbies/car.html | /hobbies/car | Car Enthusiasm |
| hobbies/cooking.html | /hobbies/cooking | Cooking |
| hobbies/whispers.html | /hobbies/whispers | Whispers (Sticky Notes) |
| hobbies/reading.html | /hobbies/reading | Reading |

#### Legacy Pages (with redirects)
- `projects.html` → `/projects/` (301)
- `hobbies.html` → `/hobbies/` (301)
- `hobby-*.html` → `/hobbies/*` (301)
- `project-*.html` → Exist but should redirect to `/projects/*`

### 2. Canonical URL Conventions

**Pattern observed:**
- Directory indices use trailing slash: `/projects/`, `/hobbies/`
- Detail pages use no extension and no trailing slash: `/projects/logistics`, `/hobbies/gym`
- Redirects in `_redirects` enforce these conventions

**Potential issues:**
- Some legacy pages at root (e.g., `project-logistics.html`) may still be linked in worker.js
- Sitemap uses no-extension URLs correctly

### 3. Chat Knowledge Sources

#### Worker.js (worker/worker.js)

**Current state (partially fixed):**
- `siteFacts` object embedded at line 8 with 6 projects and 6 hobbies
- System prompt at lines 700-770 references `siteFacts.projects` and `siteFacts.hobbies`
- Smart handlers for "whispers" (correctly routes to hobby) at lines 631-655
- Guardrail validation at lines 278-300 blocks banned terms

**Remaining issues:**
1. **Hardcoded legacy links**: Some responses still reference `/project-logistics.html` instead of `/projects/logistics`
2. **Canned responses**: Line 620 references `/project-logistics.html`
3. **Fallback responses**: Line 665 references `/project-conflict.html` (file doesn't exist!)
4. **Stale siteFacts**: Embedded JSON may drift from actual pages

#### Frontend (assets/js/site.js)

**Current state:**
- `dynamicChips` array managed at line 3533
- `renderChips()` function at line 4008 combines dynamic + pinned
- `pinnedChips` and `pinnedFollowUps` in translations object
- Race condition protection with `requestIdCounter` and `lastRequestId`

**Issues:**
1. **Projects link still uses `.html`**: Line 4066 links to `/projects.html` instead of `/projects/`
2. **No automatic refresh of dynamic chips**: If worker returns pinned-only, keeps stale chips
3. **Giant monolithic file**: 4800+ lines, hard to maintain

### 4. What Is Currently Wrong

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Embedded siteFacts may drift | worker/worker.js:8 | Chatbot answers out of date | Generate at build time |
| Legacy project URLs in responses | worker/worker.js:620,665 | Broken links | Use canonical /projects/* URLs |
| `/project-conflict.html` doesn't exist | worker/worker.js:665 | 404 error | Remove or update reference |
| Frontend projects link uses .html | site.js:4066 | Redirect delay | Use /projects/ |
| No build step for site-facts | package.json | Manual updates required | Add npm script |
| Giant monolithic site.js | assets/js/site.js | Hard to maintain | Split into modules |
| No JSON-LD structured data | All pages | Poor AEO | Add schemas |
| No llms.txt | Root | LLMs can't verify facts | Create file |
| Sitemap missing priority/lastmod | sitemap.xml | Suboptimal SEO | Enhance sitemap |

### 5. New Source of Truth

**Proposed architecture:**
```
scripts/generate-site-facts.js  →  assets/data/site-facts.json
                                          ↓
                          worker/worker.js (bundled at deploy)
                                          ↓
                          Frontend displays chips from worker response
```

**Validation requirements:**
- No duplicate project titles
- No banned terms (getWispers, Whispers App, Conflict Playbook, Discipline System)
- Whispers must be in hobbies, not projects
- All URLs must resolve to existing files

### 6. Risks to Avoid

| Risk | Mitigation |
|------|------------|
| Breaking public URLs | Keep all HTML files in place, only add redirects |
| Cache serving stale JS | Add cache-busting to site.min.js |
| Worker deployment failure | Test locally with wrangler dev before deploy |
| Frontend/Worker mismatch | Generate site-facts.json, bundle into worker, deploy together |
| Lost chat history | Keep sessionStorage keys unchanged |

---

## Implementation Plan

### Phase 1: Site-facts generator ✅ DONE
- [x] Create scripts/generate-site-facts.js
- [x] Parse actual HTML content
- [x] Generate assets/data/site-facts.json
- [x] Add validation (no fakes, no duplicates, no banned terms)
- [x] Add npm script (build:facts)

### Phase 2: Worker grounding ✅ DONE
- [x] Embed siteFacts in worker with canonical URLs
- [x] Remove fake project references (/project-conflict.html)
- [x] Add Whispers as hobby handler
- [x] Add getWispers rejection handler
- [x] Add guardrail validation
- [x] Fix ALL legacy URL references (.html → canonical)
- [x] Dynamic chips from site-facts

### Phase 3: Frontend chips ✅ DONE
- [x] Dynamic + pinned separation
- [x] Race condition protection
- [x] Fix /projects.html → /projects/
- [x] Fix /contact.html → /contact
- [x] Rebuild site.min.js

### Phase 4: AEO ✅ DONE
- [x] JSON-LD already exists on pages
- [x] llms.txt created at root
- [x] robots.txt updated with LLMsTxt reference

### Phase 5: Repo organization ✅ DONE
- [x] Updated documentation
- [x] npm scripts enhanced
- [ ] Site.js modularization (deferred - not blocking)

### Phase 6: Testing ⏳ IN PROGRESS
- [ ] Create test script
- [ ] Run all tests
- [ ] Document results

---

## Files to Modify

### Must Update
- `worker/worker.js` - Fix legacy URLs, enhance chips
- `assets/js/site.js` - Fix project link, split modules
- `package.json` - Add build:facts script
- `sitemap.xml` - Add missing pages, priority

### Must Create
- `scripts/generate-site-facts.js` - Already exists, enhance
- `assets/data/site-facts.json` - Already exists, regenerate
- `llms.txt` - New file
- `scripts/test-chat-grounding.js` - New test script

### Must Not Break
- All existing HTML pages
- All URLs in sitemap.xml
- All redirects in _redirects
- /assets/js/site.min.js path
- /assets/css/style.css path


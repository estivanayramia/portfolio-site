# Root Cleanup Audit
**Date**: 2026-01-17
**Scope**: Repository structure, file usage, and cleanup.

## 1. Inventory & Classification

### 1.1 Web Root (/)
| File | Status | Usage Source | Recommendation |
|------|--------|--------------|----------------|
| `index.html` | **KEEP** | Active Site Root | Core Entry Point. |
| `about.html`, `contact.html`, `privacy.html`, `overview.html` | **KEEP** | Active Pages | Core Content. |
| `project-*.html` | **KEEP (Legacy)** | Active Pages | Currently the canonical source for projects. Future: Move to `/projects`. |
| `hobby-*.html` | **KEEP (Legacy)** | Active Pages | Currently the canonical source for hobbies. Future: Move to `/hobbies`. |
| `hobbies-games.html` | **KEEP** | Active Page | Game Hub. |
| `audit.js` | **DELETE** | None (Duplicate) | `scripts/audit-head.js` is the active node script. |
| `audit_script.py` | **DELETE** | None | Redundant Python script. |
| `checker_syntax_test.js` | **DELETE** | None | Experiment file. |
| `clean_ui.ps1` | **DELETE** | None | Legacy migration script. |
| `custom_server.py` | **DELETE** | None | Legacy dev server experiment. |
| `compress_pdf*.py` | **ARCHIVE** | Manual Utility | Occasional use utility. Move to `tools/archive`. |
| `fix_*.ps1/py` | **DELETE** | None | Completed migration scripts (links, encoding, arrow). |
| `inject_*.ps1` | **DELETE** | None | Completed migration scripts (UI injection). |
| `standardize_games.ps1` | **DELETE** | None | Completed migration script. |
| `test_fix.py` | **DELETE** | None | Experiment. |
| `tmp-*` | **DELETE** | None | Temporary debug logs. |
| `update_*.ps1` | **DELETE** | None | Completed migration scripts. |

### 1.2 Tools Directory (`/tools`)
| File | Status | Usage Source | Recommendation |
|------|--------|--------------|----------------|
| `link-check.ps1` | **KEEP** | `package.json` | Active CI script (`npm run audit:links`). |
| `seo-check.mjs` | **KEEP** | `package.json` | Active CI script (`npm run audit:seo`). |
| `clean_ui.ps1`, `fix_*.ps1` | **DELETE** | None | Duplicate/Moved from root? (Inventory shows duplicates in list_dir output implies some might be in both or moved). |
| `archive/` | **KEEP** | Storage | Existing archive. |

### 1.3 Scripts Directory (`/scripts`)
| File | Status | Usage Source | Recommendation |
|------|--------|--------------|----------------|
| `generate-site-facts.js` | **KEEP** | `package.json` | Active Build Script. |
| `test-chat-grounding.js` | **KEEP** | `package.json` | Active Test Script. |
| `audit-head.js` | **KEEP** | `package.json` | Active Audit Script. |
| `lighthouse-audit.mjs` | **KEEP** | `package.json` | Active Audit Script. |
| `psi-audit.mjs` | **KEEP** | `package.json` | Active Audit Script. |
| `fix-*.js` | **ARCHIVE** | None | One-off fixers. |
| `verify-css.mjs` | **ARCHIVE** | None | Manual check. |

### 1.4 Content Directories
| Directory | Status | Notes |
|-----------|--------|-------|
| `assets/` | **KEEP** | Core Static Assets. |
| `docs/` | **KEEP** | Project Documentation. |
| `hobbies-games/` | **KEEP** | Canonical location for game files. |
| `projects/` | **Keep (Draft)** | Contains cleaner folder structure. Currently shadows `project-*.html`. |
| `hobbies/` | **Keep (Draft)** | Contains cleaner folder structure. Currently shadows `hobby-*.html`. |
| `ar/`, `es/` | **ARCHIVE** | Empty placeholders for future localization. |

---

## 2. Canonical Structure Strategy

### Current State (Hybrid)
- **Projects**: `project-logistics.html` (URL: `/projects/logistics` via redirects).
- **Hobbies**: `hobby-gym.html` (URL: `/hobbies/gym` via redirects).
- **Games**: `/hobbies-games/snake.html` -> `/hobbies-games/snake`.

### Target State (Clean)
- **Projects**: `/projects/logistics.html` -> `/projects/logistics`.
- **Hobbies**: `/hobbies/gym.html` -> `/hobbies/gym`.
- **Games**: `/hobbies-games/snake.html` -> `/hobbies-games/snake`.

**Note**: Phase 2 should handle the move of `project-*.html` to `projects/*.html` to eliminate the root file clutter.

---

## 3. Risks & Dependencies
- **Redirects**: `_redirects` is critical. Deleting a source file without ensuring the target exists or the redirect is updated will 404.
- **Build**: `generate-site-facts.js` scrapes HTML files. Moving/Deleting files requires updating this script (Fixed in previous step).
- **SEO**: Deleting files that search engines have indexed requires 301 redirects. (Handled by `_redirects`).

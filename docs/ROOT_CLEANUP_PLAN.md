# Root Cleanup Plan
**Status**: DRAFT
**Phase**: 1 (Immediate Cleanup)

## Phase 1: Immediate & Safe Cleanup
**Goal**: Remove confirmed unused migration scripts, temporary hacks, and experiments.

### 1.1 Root Directory Deletions
*Files to be deleted (No active references found)*
- `audit.js` (Redundant)
- `audit_script.py` (Redundant)
- `checker_syntax_test.js` (Experiment)
- `clean_ui.ps1` (Migration)
- `custom_server.py` (Experiment)
- `standardize_games.ps1` (Migration)
- `test_fix.py` (Experiment)
- `update_arcade_pages.ps1` (Migration)
- `update_site_html.ps1` (Migration)
- `update_site_html_v2.ps1` (Migration)
- `verify-css.mjs` (If unused in scripts)
- `tmp-*` (Logs/Temp)

### 1.2 Tools Directory Cleanup
*Files to be deleted from `/tools/`*
- `clean_ui.ps1`
- `fix_arrow.ps1`
- `fix_encoding_global.py`
- `fix_game_pages.ps1`
- `fix_links.ps1`
- `fix_links.py`
- `fix_scroll_button.ps1`
- `fix-broken-hobby-pages.ps1`
- `inject_listener.ps1`
- `inject_recursive.ps1`
- `inject_scroll_button.ps1`
- `inject_ui.ps1`
- `standardize_scroll_to_top.py`

### 1.3 Archival (To `/tools/archive/`)
*Files to be moved for potential future reference*
- `compress_pdf.py`
- `compress_pdf_v2.py`
- `playwright-debug.js` (If unused)
- `README-playwright.md`

### 1.4 Verification
Run after deletion:
1. `npm run build` (Ensures build pipeline is intact)
2. `npm run audit:links` (Ensures no internal link relied on a deleted file)
3. `npm run audit:seo` (Standard check)

---

## Phase 2: Consolidation (Future)
**Goal**: Move root HTMLs to subfolders.
- Move `project-*.html` -> `/projects/*.html`
- Move `hobby-*.html` -> `/hobbies/*.html`
- Update `_redirects`
- Update `generate-site-facts.js` path parsing.

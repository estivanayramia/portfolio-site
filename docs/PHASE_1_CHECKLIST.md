# Phase 1 Execution Checklist

## Overview
This checklist ensures Phase 1 (Achievement System Unification) is executed with zero defects.

**Total Time:** ~30 minutes  
**Rollback Time:** ~2 minutes  
**Risk Level:** Low (full backup + validation at each step)  

---

## Pre-Execution Setup

### ✅ Environment Check
```bash
# 1. Ensure clean working tree
git status
# Expected: "nothing to commit, working tree clean"

# 2. Verify on main branch
git branch
# Expected: "* main"

# 3. Pull latest changes
git pull origin main
# Expected: "Already up to date."

# 4. Install dependencies (if needed)
npm install
```

**Pass Criteria:** All commands succeed, no uncommitted changes  
**Fail Action:** Commit or stash changes, then retry

---

## Step 1: Pre-Flight Validation

### Run Validation Script
```bash
node scripts/validate-phase1.mjs
```

**Expected Output:**
```
═══════════════════════════════════════
  Phase 1 Validation (Achievement Unification)
═══════════════════════════════════════

[1/10] arcade-core.js has strict validation... ✓
[2/10] achievements-defs.js has all first-party IDs... ✓
[3/10] hobbies-games.html exists... ✓
[4/10] Extract unlock calls from hobbies-games.html... ✓
[5/10] All unlock calls use valid achievement IDs... ✓
[6/10] No orphaned achievements... ✓
[7/10] arcade-core.js has M key mute toggle... ✓
[8/10] arcade-core.js broadcasts mute to iframes... ✓
[9/10] No placeholder sentinel strings in toasts... ✓
[10/10] localStorage migration is backward compatible... ✓

═══════════════════════════════════════
  Results
═══════════════════════════════════════

✓ All 10/10 checks passed!

✓ SAFE TO PROCEED with hobbies-games.html cleanup
```

**Pass Criteria:** All 10 checks pass (✓)  
**Fail Action:** Review errors, fix issues, re-run validation

---

## Step 2: Dry Run Migration

### Test Migration Without Saving
```bash
node scripts/migrate-phase1.mjs --dry-run
```

**Expected Output:**
```
═══════════════════════════════════════
  Phase 1 Migration Tool
  [DRY RUN MODE - No changes will be saved]
═══════════════════════════════════════

Reading: /path/to/EN/hobbies-games.html

[1/5] Removing duplicate window.ACHIEVEMENTS object...
  ✓ Removed 120 lines
[2/5] Removing unlockHubAchievement() wrapper...
  ✓ Removed 85 lines
[3/5] Removing legacy helper functions...
  ✓ Removed 8 helper functions
[4/5] Removing GAME_OBJECTIVES object...
  ✓ Removed 30 lines
[5/5] Updating achievement unlock calls...
  ✓ Updated 23 unlock calls

Validating output...
  Original: 2450 lines
  Final: 1800 lines
  Net change: -650 lines

✓ Validation passed

⚠ DRY RUN: No changes saved

═══════════════════════════════════════
  Migration Summary
═══════════════════════════════════════
  Lines removed: 650
  Functions removed: 9
  Unlock calls updated: 23
```

**Pass Criteria:**
- All 5 steps succeed (✓)
- Validation passes
- ~600-700 lines removed
- ~20-25 unlock calls updated

**Fail Action:** Review migration script, check for file path issues

---

## Step 3: Execute Migration

### Apply Changes (Creates Backup Automatically)
```bash
node scripts/migrate-phase1.mjs
```

**Expected Output:**
```
✓ Backup created: /path/to/EN/hobbies-games.html.backup

[Similar output to dry run...]

✓ Changes saved to /path/to/EN/hobbies-games.html

✓ Migration complete!

Next steps:
  1. Test locally: Open /hobbies-games in browser
  2. Check console for errors
  3. Trigger achievements, verify toasts
  4. If issues, rollback: cp /path/to/EN/hobbies-games.html.backup /path/to/EN/hobbies-games.html
```

**Pass Criteria:**
- Backup created ✓
- Changes saved ✓
- No validation errors

**Fail Action:**
```bash
# Rollback
cp EN/hobbies-games.html.backup EN/hobbies-games.html

# Re-run validation
node scripts/validate-phase1.mjs
```

---

## Step 4: Post-Deployment Testing

### Run Automated Tests
```bash
node scripts/test-phase1-deployment.mjs
```

**Expected Output:**
```
═══════════════════════════════════════
  Phase 1 Post-Deployment Tests
═══════════════════════════════════════

[TEST] arcade-core.js rejects invalid achievement IDs... ✓
[TEST] arcade-core.js has M key mute toggle... ✓
[TEST] arcade-core.js broadcasts mute to iframes... ✓
[TEST] No placeholder sentinel strings in toasts... ✓
[TEST] achievements-defs.js has all first-party game IDs... ✓
[TEST] hobbies-games.html has no unlockHubAchievement calls... ✓
[TEST] hobbies-games.html uses ArcadeAchievements.unlock... ✓
  Found 23 ArcadeAchievements.unlock calls
[TEST] hobbies-games.html has no window.ACHIEVEMENTS... ✓
[TEST] achievements-defs.js exports ACHIEVEMENTS... ✓
[TEST] arcade-core.js imports from achievements-defs.js... ✓
[TEST] Unlock flow validates ID and shows toast... ✓
[TEST] Toast generation includes icon, title, and description... ✓

═══════════════════════════════════════
  Results
═══════════════════════════════════════
  Passed: 12

✓ All tests passed! Phase 1 deployment verified.
```

**Pass Criteria:** All 12 tests pass  
**Fail Action:** Review failures, fix issues, rollback if needed

---

## Step 5: Manual Browser Testing

### Local Server Test
```bash
# Start local server
npm start
# OR
python3 -m http.server 8000

# Open browser
open http://localhost:8000/EN/hobbies-games
```

### Test Checklist

#### Snake Game
- [ ] Open Snake game
- [ ] Eat first food
- [ ] **VERIFY:** Toast appears with 🍎 "First Bite" "Eat your first food"
- [ ] **VERIFY:** No generic "Achievement" title
- [ ] **VERIFY:** Toast auto-closes after 4 seconds
- [ ] Open achievements panel (🏆 button)
- [ ] **VERIFY:** Snake shows "1/8" or similar count
- [ ] **VERIFY:** "First Bite" achievement is highlighted/unlocked

#### Block Breaker Game
- [ ] Open Block Breaker
- [ ] Destroy first brick
- [ ] **VERIFY:** Toast shows 🧱 "First Break" "Destroy your first brick"
- [ ] Check achievements panel
- [ ] **VERIFY:** Breaker count updates

#### 2048 Game
- [ ] Open 2048
- [ ] Create 128 tile
- [ ] **VERIFY:** Toast shows 🌡️ "Getting Warm" "Create a 128 tile"

#### Space Invaders Game
- [ ] Open Space Invaders
- [ ] Destroy first alien
- [ ] **VERIFY:** Toast shows 👾 "First Blood" "Destroy an alien"

#### Mute Functionality
- [ ] Press **'M'** key
- [ ] **VERIFY:** Sound icon changes 🔊 → 🔇
- [ ] Press **'M'** again
- [ ] **VERIFY:** Icon changes back 🔇 → 🔊
- [ ] Click sound button
- [ ] **VERIFY:** Icon toggles correctly

#### Console Check
- [ ] Open DevTools Console (F12)
- [ ] **VERIFY:** No red errors
- [ ] **VERIFY:** No "Achievement not found" messages
- [ ] **VERIFY:** No "[Circular]" or "[Object]" placeholders

#### localStorage Check
```javascript
// Run in browser console
JSON.parse(localStorage.getItem('arcade_achievements'))
// Expected: Array of full IDs like ["snake_first_food", "breaker_first_brick"]

// Check for legacy keys (should NOT exist)
localStorage.getItem('snake_data')
// Expected: null (no legacy per-game storage)
```

**Pass Criteria:** All manual tests pass  
**Fail Action:** Document failures, rollback, file issue

---

## Step 6: Commit Changes

### Git Workflow
```bash
# Check modified files
git status
# Expected: EN/hobbies-games.html (modified)

# Review diff (verify changes are correct)
git diff EN/hobbies-games.html | head -100

# Stage changes
git add EN/hobbies-games.html

# Commit with descriptive message
git commit -m "feat(arcade): phase 1 - unify achievement system

REMOVED DUPLICATE CODE
- Delete window.ACHIEVEMENTS object (120 lines)
- Delete unlockHubAchievement wrapper (85 lines)
- Delete legacy helper functions (8 functions, 235 lines)
- Delete GAME_OBJECTIVES object (30 lines)

MIGRATED TO UNIFIED SYSTEM
- Update 23 unlock calls to use full IDs
- All games now call ArcadeAchievements.unlock() directly
- Single source of truth: arcade_achievements localStorage key

VALIDATED
- Pre-flight: 10/10 checks passed
- Post-deployment: 12/12 tests passed
- Manual testing: Snake, Breaker, 2048, Invaders all functional
- Achievement toasts show correct icon/title/description
- M key mute toggle works
- No console errors

METRICS
- Lines removed: 650
- Functions removed: 9
- Unlock calls updated: 23
- Net bundle size: -3KB
- localStorage keys: 4 → 1 (unified)

Semver: 3.0.0-phase1"

# Push to remote
git push origin main
```

**Pass Criteria:** Commit succeeds, push succeeds  
**Fail Action:** Review errors, resolve conflicts

---

## Step 7: Production Verification

### After Deploy (GitHub Pages)
```bash
# Wait 2-3 minutes for deployment

# Open production site
open https://estivanayramia.com/EN/hobbies-games
```

### Smoke Test
- [ ] Load page (no errors in console)
- [ ] Play Snake, trigger achievement
- [ ] Verify toast displays correctly
- [ ] Press 'M' key, verify mute toggles
- [ ] Check achievements panel, verify count

**Pass Criteria:** All smoke tests pass  
**Fail Action:** Immediate rollback via git revert

---

## Rollback Procedures

### Option 1: Local Backup (Fastest)
```bash
cp EN/hobbies-games.html.backup EN/hobbies-games.html
git add EN/hobbies-games.html
git commit -m "revert: rollback phase 1 migration"
git push origin main
```

### Option 2: Git Revert
```bash
# Find commit SHA
git log --oneline -5

# Revert specific commit
git revert <commit-sha>
git push origin main
```

### Option 3: Hard Reset (Nuclear)
```bash
# Reset to previous commit
git reset --hard HEAD~1

# Force push (CAUTION)
git push --force origin main
```

---

## Success Criteria Summary

✅ **Phase 1 Complete When:**
1. All validation scripts pass (10/10 + 12/12)
2. All manual browser tests pass
3. No console errors in production
4. Achievement toasts show full details (icon/title/description)
5. M key mute toggle works site-wide
6. localStorage uses single unified key
7. Changes committed and pushed
8. Production smoke test passes

---

## Troubleshooting

### Issue: "Achievement not found" errors
**Solution:** Check achievement ID spelling in hobbies-games.html  
**Validation:** `node scripts/validate-phase1.mjs`

### Issue: Generic "Achievement" toasts (no icon/title)
**Solution:** Verify arcade-core.js imports ACHIEVEMENTS correctly  
**Validation:** Check browser console for import errors

### Issue: M key doesn't toggle mute
**Solution:** Verify arcade-core.js keydown listener  
**Validation:** Check for JavaScript errors in console

### Issue: Achievements don't persist
**Solution:** Check localStorage permissions  
**Validation:** `localStorage.getItem('arcade_achievements')` in console

---

**Phase 1 Status:** ✅ Ready for Execution  
**Next Phase:** Phase 2 - Site-Wide Achievement Wiring  
**Estimated Total Time:** 30 minutes  
**Confidence Level:** High (full automation + validation)  

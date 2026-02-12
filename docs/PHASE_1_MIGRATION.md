# Phase 1: Achievement System Unification Migration Guide

## Overview
This document tracks the migration from the duplicate inline achievement system to the centralized `ArcadeAchievements` API.

## Changes Required in `/EN/hobbies-games.html`

### 1. Remove Duplicate Definitions

**DELETE:** The inline `window.ACHIEVEMENTS` object (~100 lines)
```javascript
// OLD (DELETE THIS)
window.ACHIEVEMENTS = {
    snake: [
        {id: 'first_food', name: 'First Bite', desc: 'Eat your first food', icon: '🍎', difficulty: 'Easy'},
        // ...
    ],
    breaker: [ /* ... */ ],
    merge: [ /* ... */ ],
    invaders: [ /* ... */ ]
};
```

**REASON:** All definitions now live in `/assets/js/arcade/achievements-defs.js` with full IDs.

---

### 2. Remove unlockHubAchievement Function

**DELETE:** The entire `unlockHubAchievement()` function and related helper code (~150 lines)
```javascript
// OLD (DELETE THIS)
function unlockHubAchievement(game, achievementId) {
    // ID conversion logic
    // Legacy storage updates
    // Toast display
    // ...
}
```

**REASON:** Replaced by direct calls to `window.ArcadeAchievements.unlock(fullId)`.

---

### 3. Remove Legacy UI Functions

**DELETE:** These panel/UI functions (~200 lines total):
- `achievementPanelState`
- `renderAchievementPanel(game)`
- `renderAllAchievementPanels()`
- `showAchievementUnlock(achievement)` (inline version)

**REASON:** All UI rendering now handled by `/assets/js/arcade/arcade-core.js` + `achievements-ui.js`.

---

### 4. Remove Legacy Storage Code

**DELETE:** Functions that sync/migrate old per-game storage:
- `loadGameData(game)`
- `saveGameData(game, data)`
- `getUnifiedUnlockedSet()`
- `resolveAchievementDef(game, achievementId, fullId)`

**REASON:** Single source of truth is now `localStorage['arcade_achievements']` (array of full IDs).

---

### 5. Update All Achievement Unlock Calls

**FIND & REPLACE PATTERN:**

```javascript
// OLD
unlockHubAchievement('snake', 'first_food');

// NEW
window.ArcadeAchievements.unlock('snake_first_food');
```

**Full Mapping Table:**

#### Snake Achievements
| Old Call | New Call |
|----------|----------|
| `unlockHubAchievement('snake', 'first_food')` | `window.ArcadeAchievements.unlock('snake_first_food')` |
| `unlockHubAchievement('snake', 'combo_5')` | `window.ArcadeAchievements.unlock('snake_combo_5')` |
| `unlockHubAchievement('snake', 'score_100')` | `window.ArcadeAchievements.unlock('snake_score_100')` |
| `unlockHubAchievement('snake', 'level_5')` | `window.ArcadeAchievements.unlock('snake_level_5')` |
| `unlockHubAchievement('snake', 'length_20')` | `window.ArcadeAchievements.unlock('snake_length_20')` |

#### Block Breaker Achievements
| Old Call | New Call |
|----------|----------|
| `unlockHubAchievement('breaker', 'first_brick')` | `window.ArcadeAchievements.unlock('breaker_first_brick')` |
| `unlockHubAchievement('breaker', 'score_500')` | `window.ArcadeAchievements.unlock('breaker_score_500')` |
| `unlockHubAchievement('breaker', 'perfect_level')` | `window.ArcadeAchievements.unlock('breaker_perfect_level')` |
| `unlockHubAchievement('breaker', 'level_3')` | `window.ArcadeAchievements.unlock('breaker_level_3')` |
| `unlockHubAchievement('breaker', 'powerup_5')` | `window.ArcadeAchievements.unlock('breaker_powerup_5')` |

#### 2048 Achievements
| Old Call | New Call |
|----------|----------|
| `unlockHubAchievement('merge', 'tile_128')` | `window.ArcadeAchievements.unlock('merge_tile_128')` |
| `unlockHubAchievement('merge', 'tile_512')` | `window.ArcadeAchievements.unlock('merge_tile_512')` |
| `unlockHubAchievement('merge', 'tile_1024')` | `window.ArcadeAchievements.unlock('merge_tile_1024')` |
| `unlockHubAchievement('merge', 'tile_2048')` | `window.ArcadeAchievements.unlock('merge_tile_2048')` |
| `unlockHubAchievement('merge', 'score_5000')` | `window.ArcadeAchievements.unlock('merge_score_5000')` |

#### Space Invaders Achievements
| Old Call | New Call |
|----------|----------|
| `unlockHubAchievement('invaders', 'first_kill')` | `window.ArcadeAchievements.unlock('invaders_first_kill')` |
| `unlockHubAchievement('invaders', 'wave_3')` | `window.ArcadeAchievements.unlock('invaders_wave_3')` |
| `unlockHubAchievement('invaders', 'aliens_50')` | `window.ArcadeAchievements.unlock('invaders_aliens_50')` |
| `unlockHubAchievement('invaders', 'score_500')` | `window.ArcadeAchievements.unlock('invaders_score_500')` |
| `unlockHubAchievement('invaders', 'perfect_wave')` | `window.ArcadeAchievements.unlock('invaders_perfect_wave')` |

---

### 6. Remove GAME_OBJECTIVES Object

**DELETE:**
```javascript
const GAME_OBJECTIVES = {
    snake: ['Eat food to grow', 'Build combos for multipliers', /* ... */],
    breaker: [ /* ... */ ],
    merge: [ /* ... */ ],
    invaders: [ /* ... */ ]
};
```

**REASON:** Objectives can be moved to achievement panel descriptions or removed if no longer needed.

---

### 7. Clean Up showStats() Function

**UPDATE:** The `showStats(game)` function currently reads from both old and new stores.

**CHANGE TO:**
```javascript
function showStats(game) {
    // Read ONLY from ArcadeAchievements
    const unlocked = window.ArcadeAchievements.getUnlocked();
    const defs = Object.values(window.ArcadeAchievements.getDefinitions())
        .filter(a => a.game === game);
    
    const unlockedCount = defs.filter(a => unlocked.includes(a.id)).length;
    
    // Display stats modal with unified data...
}
```

---

## Testing Checklist

After applying all changes:

- [ ] Visit `/hobbies-games` - no console errors
- [ ] Play Snake, eat food → "First Bite" achievement shows correct icon/title/description
- [ ] Check browser console: no "[ArcadeAchievements] Achievement not found" errors
- [ ] Open achievement panel (🏆 button) → all games show correct counts
- [ ] Play all 4 games, trigger 1 achievement each → verify toasts display properly
- [ ] Check `localStorage['arcade_achievements']` → contains full IDs like `["snake_first_food", "breaker_first_brick"]`
- [ ] **Verify NO legacy keys exist:** `snake_data`, `breaker_data`, `merge_data`, `invaders_data` should not be created

---

## Expected Impact

**Lines Removed:** ~650 (duplicate code, wrappers, legacy storage)
**Lines Changed:** ~20 (achievement unlock calls)
**Bundle Size:** -3KB (removed duplicate definitions)
**localStorage Keys:** 4 → 1 (unified store)

---

## Rollback Plan

If issues arise:
1. Revert commit: `git revert <commit-sha>`
2. The old system will restore automatically (it's preserved in git history)
3. File issue with reproduction steps

---

*Migration Author:* EA-AC v5.0  
*Date:* 2026-02-11  
*Phase:* 1 of 6  
*Status:* In Progress  

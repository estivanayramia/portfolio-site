# Comprehensive Audit - Chat System & Site Issues

**Date**: 2026-01-14  
**Status**: Analysis Complete - Fixes Required

---

## Executive Summary

This audit identifies 6 critical issues preventing the chatbot from being reliable, accurate, and contextually aware. Each issue has a specific root cause and actionable fix.

---

## Issue 1: "AI Service is Busy" Appears Too Often ❌

### Root Cause
**Location**: `worker/worker.js` lines 960-980

When Gemini API returns 429 (RESOURCE_EXHAUSTED), the worker returns:
```javascript
errorType: "UpstreamBusy",
reply: "The AI service is experiencing high demand. Please try again in a moment.",
chips: ["Retry", "Projects", "Resume", "Contact"]
```

### Problems
1. No exponential backoff retry mechanism
2. No local fallback answer when upstream busy
3. Frontend shows "Retrying automatically in 30 seconds..." but uses fixed 30s delay
4. No observability logs to measure frequency

### Fix Required
- Add exponential backoff (1s, 2s, 4s retries)
- Implement local fallback mode using siteFacts for simple queries
- Add metrics logging for upstream busy events
- Make retry chip trigger manual retry with backoff

---

## Issue 2: Chips Revert to Pinned-Only After Errors ❌

### Root Cause
**Location**: `assets/js/site.js` lines 4398-4418

When error responses occur:
```javascript
if (data.errorType !== 'OfflineMode') {
    if (data.chips && Array.isArray(data.chips) && els.chipsContainer) {
        renderChips(data.chips);  // ← Uses error chips: ["Retry", "Projects", "Resume", "Contact"]
    } else {
        renderChips();  // ← Re-renders with existing dynamic chips
    }
    return;  // ← Stops processing, chips locked to error state
}
```

**The problem**: When UpstreamBusy returns chips `["Retry", "Projects", "Resume", "Contact"]`, these become the new `dynamicChips`. The pinned chip detection (lines 4464-4470) sees "Projects", "Resume", "Contact" and thinks they're all pinned, so it doesn't update dynamic chips.

### Actual Behavior
1. User asks "What are your projects?"
2. Worker returns UpstreamBusy with chips: ["Retry", "Projects", "Resume", "Contact"]
3. Frontend calls `renderChips(["Retry", "Projects", "Resume", "Contact"])`
4. Dynamic chips become: ["Retry"] (since Projects/Resume/Contact are filtered as pinned)
5. UI shows: "Retry" + pinned chips ("Projects", "Resume", "Contact")
6. User clicks Retry
7. Request succeeds, worker returns chips: ["L'Oréal Campaign", "Franklin Templeton", "Endpoint LinkedIn", "This Website"]
8. Frontend checks: are all these pinned? No → Updates dynamic chips ✅
9. BUT: If error happens again, back to step 2

### Fix Required
- For error responses (UpstreamBusy, Timeout, etc.): **preserve previous dynamic chips**
- Only add "Retry" chip temporarily without wiping dynamic chips
- Update logic at lines 4398-4418 to check if error response and preserve state

---

## Issue 3: Chips Don't Update After Clicking Pinned Chips ✅ WORKING

### Status: Already Implemented Correctly

**Location**: `assets/js/site.js` lines 4046-4080

The follow-up logic exists and works:
```javascript
if (projectLabels.includes(chipText)) {
    window.location.href = "/projects/";
    const followUps = translations.chat.pinnedFollowUps[currentLanguage]?.projects || 
                     translations.chat.pinnedFollowUps.en.projects;
    dynamicChips = followUps;
    renderChips();
    return;
}
```

**Verification Needed**: Check if `translations.chat.pinnedFollowUps` is populated correctly.

---

## Issue 4: Worker Guardrails - Whispers Validation ⚠️ PARTIAL

### Status: Mostly Correct, Needs Validation Pass

**Location**: `worker/worker.js` lines 615-643

Current handling:
- Whispers hobby handler exists and correctly links to `/hobbies/whispers` ✅
- getWispers rejection exists ✅
- siteFacts loaded from KV with fallback ✅

**Missing**: Final validation pass before returning any reply to check for hallucinated projects.

### Fix Required
Add validation function before returning replies:
```javascript
function validateProjects(reply, siteFacts) {
    // Extract mentioned project titles from reply
    // Check if any are NOT in siteFacts.projects
    // If invalid found, rewrite reply to "Not listed on portfolio"
}
```

Apply before every `return jsonReply(...)` call.

---

## Issue 5: Visual Bug - Circular Progress Ring Not Centered ❌

### Investigation Needed
**Files to Check**:
- `assets/css/style.css` - circular progress classes
- `assets/js/site.js` - chat loading animation
- All pages with chat widget

### Current Implementation
**Location**: `assets/js/site.js` line 4522

Loading message creates a div but doesn't specify circular progress styling. Need to find where `.circular-progress` or similar class is defined.

### Fix Required
- Locate circular progress CSS
- Fix centering using `display: flex; align-items: center; justify-content: center;`
- Apply globally to all pages

---

## Issue 6: Back-to-Top Hover Text Missing ❌

### Investigation Needed
**Files to Check**:
- Back-to-top button HTML across all pages
- CSS for back-to-top component
- JavaScript event handlers

### Expected Behavior
Button should have `title="Back to top"` or `aria-label="Back to top"`

### Fix Required
- Find back-to-top button implementation
- Add hover text via `title` attribute
- Ensure consistent across all pages

---

## Issue 7: Site-Facts Pipeline Validation ⚠️ PARTIAL

### Status: Pipeline Exists, Validation Incomplete

**Location**: `scripts/generate-site-facts.js`

Current validation (lines 15-28):
```javascript
const BANNED_TERMS = [
  'getwispers',
  'get wispers',
  'whispers app',
  'whispers application',
  'conflict playbook',
  'discipline system',
  'messaging app',
  'chat app',
  'sticky note app'
];
```

**Missing**:
1. URL resolution check (verify all URLs resolve to real pages)
2. Duplicate detection
3. Build failure mechanism (currently generates but doesn't block deploy)

### Fix Required
- Add file existence checks for all URLs
- Add duplicate title detection
- Return non-zero exit code if validation fails
- Update `package.json` build script to fail on validation error

---

## Issue 8: Chips State Management - Root Cause Analysis 🔍

### Current Architecture
**Location**: `assets/js/site.js` lines 3532-3535

```javascript
let dynamicChips = []; // Dynamic chips from worker responses or context
```

**renderChips() Logic** (lines 4008-4120):
1. Update `dynamicChips` if new ones provided
2. Get pinned chips for current language
3. Deduplicate: remove any dynamic chips matching pinned
4. Combine: dynamic first, then pinned
5. Render all chips with event handlers

### Problem Scenarios

#### Scenario A: Error Response Overwrites Dynamic Chips
```
User: "What are your projects?"
Worker: UpstreamBusy → chips: ["Retry", "Projects", "Resume", "Contact"]
Frontend: renderChips(["Retry", "Projects", "Resume", "Contact"])
Result: dynamicChips = ["Retry"] (others filtered as pinned)
UI: Shows "Retry" + "Projects" + "Resume" + "Contact"
```

**Fix**: Don't update dynamicChips on error responses, only add "Retry" temporarily.

#### Scenario B: Pinned-Only Response Detection
**Location**: Lines 4464-4470
```javascript
const allPinned = data.chips.every(chip => pinnedLower.includes(chip.toLowerCase()));

if (allPinned && data.chips.length > 0) {
    console.log('[Chat Debug] Response contains only pinned chips, keeping existing dynamic chips');
    renderChips(); // Re-render with existing dynamic chips + pinned
}
```

This works correctly! If worker returns only pinned chips, it preserves existing dynamic chips.

**Problem**: Error responses return `["Retry", "Projects", "Resume", "Contact"]` which triggers the update because "Retry" is not pinned.

---

## Issue 9: AEO (Answer Engine Optimization) Verification ✅ MOSTLY DONE

### Status: llms.txt Exists, JSON-LD Needs Verification

**Files**:
- `llms.txt` at root ✅
- `robots.txt` references llms.txt ✅
- JSON-LD in HTML pages ⚠️ needs verification

### Verification Required
- Check JSON-LD on all pages matches actual content
- Verify canonical URLs are correct
- Confirm structured data validity

---

## Issue 10: Test Commands Documentation ❌ OUTDATED

### Problem
Test commands doc likely contains fake project chips like "Whispers App" that don't exist.

### Fix Required
- Find test commands documentation
- Update to match real site-facts.json
- Remove any references to fake projects
- Ensure all chips match actual projects/hobbies

---

## Summary of Required Fixes

### Priority 1 (Critical - Breaks User Experience)
1. ✅ Fix chips reverting to pinned-only on errors (preserve dynamic chips)
2. ⚠️ Add worker validation pass to prevent hallucinated projects
3. ❌ Improve "AI service busy" handling with fallback mode

### Priority 2 (Important - UX Polish)
4. ❌ Fix circular progress ring centering
5. ❌ Restore back-to-top hover text
6. ⚠️ Complete site-facts validation (URL checks, build failure)

### Priority 3 (Maintenance - Prevent Regressions)
7. ❌ Update test commands documentation
8. ⚠️ Add comprehensive test suite (test-chat-grounding.js)
9. ⚠️ Verify AEO implementation across all pages

---

## Next Steps

1. Fix chips state management for error responses
2. Add worker validation pass for project hallucination prevention
3. Implement local fallback mode for upstream busy
4. Fix visual bugs (progress ring, back-to-top)
5. Complete validation pipeline
6. Run comprehensive tests
7. Update documentation

---

**End of Audit**

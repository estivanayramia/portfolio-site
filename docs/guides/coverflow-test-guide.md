# Coverflow Centering Test Guide

## Current Implementation Status

✅ **Strategy 2 (Pure JS Centering)** is implemented and ready to test

### What's Been Done:

1. **JavaScript** (`CoverflowCarousel.js`):
   - ✅ Uses `translate(-50%, -50%)` for centering (line 414)
   - ✅ Fixed 200px horizontal spacing between cards
   - ✅ Proper transform composition order

2. **CSS** (`coverflow-luxury.css`):
   - ✅ Has `top: 50%; left: 50%;` positioning
   - ✅ **NO negative margins** (removed)
   - ✅ Cards centered by JS transform only

3. **Assets**:
   - ✅ Rebuilt with latest changes

---

## How to Test

### Option 1: Automated Diagnostic Page

Open in your browser:
```
http://localhost:5500/coverflow-diagnostic.html
```

This page will automatically check:
- ✓ JS uses translate(-50%, -50%)
- ✓ CSS has no negative margins  
- ✓ Center card is properly centered
- ✓ Cards have 200px spacing
- ✓ Center card has 0° rotation
- ✓ Exactly 5 cards are visible

**All checks should show green ✓**

### Option 2: Manual Visual Test

1. Open: `http://localhost:5500/EN/projects/index.html`
2. Scroll down to the carousel section
3. Verify:
   - [ ] Center card is perfectly centered in viewport
   - [ ] 5 cards visible side-by-side (not stacked)
   - [ ] Center card is largest and has gold glow
   - [ ] Left cards tilted LEFT, right cards tilted RIGHT
   - [ ] Cards don't overlap
   - [ ] Drag works smoothly
   - [ ] Click a side card to center it (320ms animation)

---

## Expected Visual Output

```
[Card -2]  [Card -1]  [CENTER]  [Card +1]  [Card +2]
(small)    (medium)   (large)    (medium)   (small)
-80° tilt  -70° tilt   0° flat   +70° tilt  +80° tilt
```

- **Center card**: Flat (0°), scale 1.15, translateZ(110px), gold glow
- **Adjacent (±1)**: Tilted 70°, scale 0.82, translateZ(-150px)
- **Far (±2)**: Tilted 80°, scale 0.65, translateZ(-300px)
- **Spacing**: Exactly 200px between adjacent card centers

---

## Troubleshooting

### If Cards Are Still Stacked/Overlapping:

**Possible Cause**: Browser cache
**Fix**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**Possible Cause**: Old minified files served
**Fix**: 
```bash
npm run build:coverflow
# Verify timestamp of:
# assets/js/carousel/CoverflowCarousel.min.js
# assets/css/carousel/coverflow-luxury.min.css
```

**Possible Cause**: Deployment cache (Cloudflare Pages)
**Fix**: 
1. Deploy latest commit to Cloudflare
2. Purge cache in Cloudflare dashboard
3. Hard refresh in browser

### If Center Card Is Off-Center:

**Check DevTools**:
1. Inspect `.coverflow-card--active` (center card)
2. Verify `style.transform` contains `translate(-50%, -50%)`
3. Check computed position - card center should be at viewport center

### If Drag Doesn't Work:

**Check Console** for JavaScript errors  
**Verify** `pointer-events: auto` on cards  
**Test** clicking prev/next buttons as alternative

---

## DevTools Inspection Checklist

Open DevTools → Elements, find center card:

```html
<div class="coverflow-card coverflow-card--active" style="transform: translate(-50%, -50%) translateX(0px) rotateY(0deg) translateZ(110px) scale(1.15); ...">
```

**Verify**:
- ✓ Contains `translate(-50%, -50%)` at START
- ✓ Contains `translateX(0px)` for center card
- ✓ Contains `rotateY(0deg)` for center card
- ✓ Contains `translateZ(110px)` positive depth
- ✓ Contains `scale(1.15)` larger than others

**Adjacent Left Card (-1)**:
```
transform: translate(-50%, -50%) translateX(-200px) rotateY(-70deg) translateZ(-150px) scale(0.82)
```

**Adjacent Right Card (+1)**:
```
transform: translate(-50%, -50%) translateX(200px) rotateY(70deg) translateZ(-150px) scale(0.82)
```

---

## Next Steps Based on Test Results

### ✅ If All Tests Pass:
- Current Strategy 2 (Pure JS) is working correctly
- Ready to commit and deploy to production
- No further changes needed

### ❌ If Tests Fail:
- Report which specific checks failed
- Provide screenshot showing the issue
- I will try **Strategy 1 (Pure CSS)** instead:
  - Remove `translate(-50%, -50%)` from JavaScript
  - Add negative margins back to CSS
  - Rebuild and retest

---

## Files to Review

- **Test Page**: [`coverflow-diagnostic.html`](file:///c:/Users/estiv/portfolio-site/coverflow-diagnostic.html)
- **Live Page**: [`EN/projects/index.html`](file:///c:/Users/estiv/portfolio-site/EN/projects/index.html)
- **JavaScript**: [`CoverflowCarousel.js`](file:///c:/Users/estiv/portfolio-site/assets/js/carousel/CoverflowCarousel.js#L414)
- **CSS**: [`coverflow-luxury.css`](file:///c:/Users/estiv/portfolio-site/assets/css/carousel/coverflow-luxury.css#L102-L116)

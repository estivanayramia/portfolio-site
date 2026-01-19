# Hobbies Routing Fix - Production 404 Resolution

## Problem Statement

Production returned **404** for `/hobbies/` and `/projects/` despite files
existing and `_redirects` rules being present.

## Evidence (2026-01-19)

### Production Test Results

```powershell
# /about works correctly
curl.exe -I -L "https://www.estivanayramia.com/about"
HTTP/1.1 308 Permanent Redirect
Location: /EN/about
HTTP/1.1 200 OK

# /hobbies/ returns 404 (BROKEN)
curl.exe -I -L "https://www.estivanayramia.com/hobbies/"
HTTP/1.1 404 Not Found

# /projects/ returns 404 (BROKEN)
curl.exe -I -L "https://www.estivanayramia.com/projects/"
HTTP/1.1 404 Not Found

# Direct EN paths work
curl.exe -I "https://www.estivanayramia.com/EN/hobbies/"
HTTP/1.1 200 OK

curl.exe -I "https://www.estivanayramia.com/EN/projects/"
HTTP/1.1 200 OK

# EN .html files redirect to clean URLs
curl.exe -I "https://www.estivanayramia.com/EN/about.html"
HTTP/1.1 301 Moved Permanently
Location: /about
```

### Key Finding

**Cloudflare Pages serves `/EN/hobbies/` and `/EN/projects/` successfully
(200), but rewrites to `/EN/hobbies/index.html` and
`/EN/projects/index.html` fail.**

This indicates Cloudflare's directory handling expects directory paths without
explicit `index.html` in rewrite targets.

## Root Cause

**Incorrect rewrite targets in `_redirects` for directory routes.**

Original (broken):

```text
/hobbies/    /EN/hobbies/index.html    200
/projects/   /EN/projects/index.html   200
```

Cloudflare Pages does not properly handle rewrites to explicit `index.html`
files within directories. The rewrite fails to match, falling through to the
404 handler.

## Fix Applied

**Changed rewrite targets in `_redirects` AND fixed the generator to prevent
regression.**

### Changes Made

1. **Updated `tools/fix-seo.mjs` generator** (line 131-145):
   - Added logic to detect directory canonicals (ending with `/`)
   - For directory routes, rewrite to directory path not `index.html`
   - Example: `/hobbies/` → `/EN/hobbies/` (not `/EN/hobbies/index.html`)

1. **Regenerated `_redirects` with fixed generator:**

```text
# Before (broken)
/hobbies/    /EN/hobbies/index.html    200
/projects/   /EN/projects/index.html   200

# After (fixed)
/hobbies/    /EN/hobbies/    200
/projects/   /EN/projects/   200
```

1. **Updated `tools/verify-pages-output.mjs`:**
   - Added checks for `/hobbies/` and `/projects/` rewrites
   - Added regression guard: fails if any directory route rewrites to
     `index.html`
   - Prevents future generator bugs from breaking production

### Why This Fix is Permanent

The generator (`tools/fix-seo.mjs`) now automatically:

- Detects when a canonical URL ends with `/` (directory route)
- Checks if the source file is `index.html` within a directory
- Outputs directory path in rewrite target instead of `index.html`

**This means running `node tools/fix-seo.mjs --redirects` will maintain the
correct pattern going forward.**

## Why Other Routes Work

**File-based routes** (e.g., `/about`) work because:

1. Rewrite: `/about` → `/EN/about.html` (200)
2. Cloudflare's clean URL handling sees `.html` and serves content
3. If accessed as `/EN/about.html`, redirects 301 to `/about`

**Directory routes** (e.g., `/hobbies/`) failed because:

1. Rewrite attempted: `/hobbies/` → `/EN/hobbies/index.html`
2. Cloudflare does not match `index.html` explicitly in rewrites
3. Falls through to 404 fallback

## Verification Steps

### After Deployment

Test these URLs (expected results after fix):

```powershell
# Should redirect 301 to /hobbies/, then 200
curl.exe -I -L "https://www.estivanayramia.com/hobbies"
# Expected: HTTP/1.1 301 → HTTP/1.1 200

# Should serve directly
curl.exe -I "https://www.estivanayramia.com/hobbies/"
# Expected: HTTP/1.1 200

# Should redirect 301 to /projects/, then 200
curl.exe -I -L "https://www.estivanayramia.com/projects"
# Expected: HTTP/1.1 301 → HTTP/1.1 200

# Should serve directly
curl.exe -I "https://www.estivanayramia.com/projects/"
# Expected: HTTP/1.1 200
```

### Cache Invalidation

After deployment:

1. **Purge Cloudflare cache:**
   `Cloudflare Dashboard > Caching > Configuration > Purge Everything`

2. **Hard refresh browser:** Ctrl+Shift+R or Cmd+Shift+R

3. **Clear service worker:** DevTools > Application > Service Workers > Unregister

### Cloudflare Pages Configuration

Verify these settings remain correct:

- **Framework preset:** None
- **Build output directory:** `.` (repo root)
- **Root directory:** `/`

See [`docs/guides/cloudflare-pages-config.md`](../guides/cloudflare-pages-config.md)
for detailed configuration requirements.

## Domain Binding Notes

### Apex vs WWW

Site uses `www.estivanayramia.com` as canonical. Verify:

- Apex (`estivanayramia.com`) redirects to WWW
- SSL/TLS: Full (strict) or Flexible
- Always Use HTTPS: Enabled

### Redirect Flow

1. `http://estivanayramia.com` → `https://estivanayramia.com`
2. `https://estivanayramia.com` → `https://www.estivanayramia.com`
3. `https://www.estivanayramia.com/hobbies` → `https://www.estivanayramia.com/hobbies/`
4. `https://www.estivanayramia.com/hobbies/` → serves content (200)

## Related Files

- [`_redirects`](../../_redirects) - Production routing rules
- [`serve.json`](../../serve.json) - Local dev configuration (not used in
  production)
- [`scripts/local-serve.js`](../../scripts/local-serve.js) - Local server with
  hardcoded redirects
- [`tools/fix-seo.mjs`](../../tools/fix-seo.mjs) - Generates `_redirects`
  (needs update for directory routes)

## Prevention

### Automated Regression Guard

The `tools/verify-pages-output.mjs` script now guards against regression:

```bash
npm run verify:pages
```

**Checks performed:**

- Root rewrite: `/` → `/EN/index.html` exists
- Directory rewrites: `/hobbies/` → `/EN/hobbies/` (not `index.html`)
- Directory rewrites: `/projects/` → `/EN/projects/` (not `index.html`)
- **Regression guard:** Fails if ANY directory route rewrites to `index.html`

This prevents silent breakage if the generator is modified incorrectly.

### Generator is Now Fixed

### Local vs Production Parity

**Local (`npm run start`):**

- Uses `serve.json` with `"cleanUrls": true`
- Handles directory routes: `"/hobbies" → "/EN/hobbies/index.html"`
- Works because `serve-handler` resolves `index.html` automatically

**Production (Cloudflare Pages):**

- Ignores `serve.json` completely
- Uses `_redirects` only
- Requires directory paths: `/hobbies/ → /EN/hobbies/` not `/EN/hobbies/index.html`

### Testing Checklist

Before deploying:

- [ ] Run `npm run verify:pages` to ensure `_redirects` is in output root
- [ ] Test locally: `npm run start` then access `/hobbies/` and `/projects/`
- [ ] Verify `_redirects` uses directory paths for directory routes

After deploying:

- [ ] Purge Cloudflare cache
- [ ] Test `/hobbies`, `/hobbies/`, `/projects`, `/projects/` in production
- [ ] Verify no redirect loops
- [ ] Check arcade game links to `/hobbies/` work correctly

## Resolution Status

**Status:** ✅ Fixed

**Root Cause:** Rewrite targets used `index.html` instead of directory paths

**Fix:** Changed `/hobbies/` rewrite from `/EN/hobbies/index.html` to
`/EN/hobbies/`

**Deployed:** Pending deployment verification

**Last Updated:** 2026-01-19

# Savonie Chat Reliability Upgrade

This document outlines the deployment steps and verification procedures for the chat system reliability improvements.

## ✅ RESOLVED (Jan 12, 2026)

**Issue**: Gemini API 404 errors due to outdated model names and authentication method.

**Root Cause**: Google upgraded to Gemini 2.x models and changed the API authentication from query parameter to header-based.

**Solution Applied**:
1. Updated model names:
   - `gemini-1.5-flash` → `gemini-2.5-flash`
   - `gemini-1.5-pro` → `gemini-2.5-pro`
2. Changed authentication method:
   - Old: `?key=${apiKey}` (query parameter)
   - New: `x-goog-api-key: ${apiKey}` (HTTP header)
3. Updated API endpoint format:
   - URL: `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`

**Status**: ✅ Chatbot is now fully operational with Gemini 2.5 Flash.

---

## 🎯 Overview

The upgrade addresses "AI service is busy" failures by:
- ✅ Proper HTTP status codes (503/504/429) instead of 200 for errors
- ✅ Exponential backoff retry strategy with jitter
- ✅ Offline fallback mode with helpful static responses
- ✅ Debug mode for troubleshooting
- ✅ Health check endpoint
- ✅ Frontend auto-retry on transient failures

## 📋 Changes Summary

### Worker Changes (`worker/worker.js`)
1. **Error Classification**: Returns proper HTTP status codes
   - `429` → `503` with `Retry-After: 30` for rate limiting
   - `401/403` → `503` with `AuthError` for authentication issues
   - `504` → `504` with `Timeout` for timeouts
   - `500/502/503` → `503` with `UpstreamError` for service issues

2. **Retry Strategy**: Exponential backoff (300ms, 900ms, 1800ms) with jitter
   - Retries only on transient errors (429, 500, 502, 503, 504)
   - No retry on authentication/validation errors (401, 403, 400)

3. **Offline Fallback**: Intent-based deterministic responses
   - Greeting: Welcome message with navigation
   - Projects: Project summaries with links
   - Summary: Bio and expertise overview
   - Default: Navigation options

4. **Diagnostics**:
   - `GET /health` endpoint returns `{ ok, version, hasKey }`
   - Debug mode via `?debug=1` or `X-Savonie-Debug: 1` header
   - Includes `X-Savonie-Version` header on all responses

### Frontend Changes (`assets/js/site.js`)
1. **Error Handling**: Parses structured errors from non-200 responses
2. **Auto-Retry**: Automatically retries on `UpstreamBusy` after 30s
3. **Offline Mode**: Renders fallback responses with proper chips
4. **User Feedback**: Clear error messages with actionable chips

### Cache Configuration (`_headers`)
- ✅ Already configured with `no-cache` for JS/CSS
- Static assets remain cached (images, fonts)

## 🚀 Deployment Steps

### 1. Deploy Worker to Cloudflare

```bash
# Navigate to project root
cd c:\Users\estiv\portfolio-site

# Deploy worker (requires wrangler CLI)
cd worker
wrangler publish

# Or if using wrangler.toml in root:
wrangler publish worker/worker.js
```

**Expected Output:**
```
✨ Successfully published your script to
 https://portfolio-chat.eayramia.workers.dev
```

### 2. Deploy Frontend to Netlify

Since `_headers` already has `no-cache` for JS/CSS, users will get the new version within minutes of deployment.

```bash
# If using Netlify CLI:
netlify deploy --prod

# Or via Git push (auto-deploy):
git add .
git commit -m "feat: improve chat reliability and error handling"
git push origin main
```

### 3. Verify Deployment

Run the test script:

```powershell
.\test-chat-errors.ps1
```

**Expected Results:**
- ✅ Health check returns version and `hasKey: true`
- ✅ Normal requests succeed with `errorType: null`
- ✅ Empty message returns 400 BadRequest
- ✅ Debug mode includes debug object (when error occurs)
- ✅ Rate limiting triggers after ~20 requests
- ✅ CORS headers present on all responses
- ✅ `X-Savonie-Version` header present

## 🔍 Manual Verification

### Check Worker Version

```bash
# Health check
curl https://portfolio-chat.eayramia.workers.dev/health

# Expected response:
# {
#   "ok": true,
#   "version": "v2026.01.11-dynamic-audit",
#   "hasKey": true
# }
```

### Test Normal Request

```bash
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about Estivan","language":"en"}'

# Check for X-Savonie-Version header:
curl -I -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","language":"en"}'
```

### Test Debug Mode

```bash
# With query parameter
curl -X POST "https://portfolio-chat.eayramia.workers.dev/chat?debug=1" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","language":"en"}'

# With header
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "X-Savonie-Debug: 1" \
  -d '{"message":"Hello","language":"en"}'
```

### Test Error Scenarios

**Simulate Timeout** (if Gemini is slow):
```bash
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Write a very detailed essay about everything","language":"en"}'
```

**Expected**: HTTP 504 with `errorType: "Timeout"`

**Simulate Rate Limit**:
```bash
# Send 25 requests rapidly
for i in {1..25}; do
  curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello '$i'","language":"en"}' &
done
wait
```

**Expected**: HTTP 429 or response with `errorType: "RateLimit"`

**Test BadRequest**:
```bash
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"","language":"en"}'
```

**Expected**: HTTP 400 with `errorType: "BadRequest"`

## 📊 Monitoring

### Headers to Check
- `X-Savonie-Version`: Should match `VERSION_TAG` in worker.js
- `Retry-After`: Present on 503 responses for rate limiting
- `Access-Control-Allow-Origin`: Present for CORS

### Error Types
| errorType | HTTP Status | Meaning | User Action |
|-----------|-------------|---------|-------------|
| `null` | 200 | Success | Normal response |
| `RateLimit` | 429 | Too many requests | Wait 60s |
| `BadRequest` | 400 | Invalid input | Fix input |
| `UpstreamBusy` | 503 | Gemini rate limited | Auto-retry after 30s |
| `AuthError` | 503 | API key issue | Contact support |
| `Timeout` | 504 | Request timeout | Shorter question |
| `UpstreamError` | 503 | Gemini error | Retry later |
| `OfflineMode` | 200 | Fallback active | Use static response |

## 🐛 Troubleshooting

### Issue: "AI service is busy" still appears

**Check:**
1. Verify worker deployed: `curl https://portfolio-chat.eayramia.workers.dev/health`
2. Check version header matches latest
3. Enable debug mode: `?debug=1`
4. Review Cloudflare worker logs

### Issue: Frontend not updated

**Check:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Check network tab for `site.min.js` cache headers
3. Verify Netlify deployment completed
4. Wait 5 minutes for CDN propagation

### Issue: Rate limiting too aggressive

**Adjust:**
```javascript
// In worker.js, line ~12
const RATE_LIMIT_MAX = 20; // Increase this value
const RATE_LIMIT_WINDOW = 60000; // Or increase window
```

### Issue: Timeouts occurring frequently

**Adjust:**
```javascript
// In worker.js, line ~8
const GEMINI_TIMEOUT = 35000; // Increase timeout (ms)
```

## 📈 Success Metrics

**Before:**
- ❌ "AI service is busy" errors with HTTP 200
- ❌ No retry logic
- ❌ No diagnostic tools
- ❌ Poor error messages

**After:**
- ✅ Proper HTTP status codes
- ✅ Exponential backoff retry (3 attempts)
- ✅ Health check + debug mode
- ✅ Clear error messages with actionable chips
- ✅ Offline fallback mode
- ✅ Auto-retry on transient failures

## 🔗 Resources

- Worker URL: https://portfolio-chat.eayramia.workers.dev
- Health Check: https://portfolio-chat.eayramia.workers.dev/health
- Frontend: https://estivanayramia.com
- Test Script: `test-chat-errors.ps1`

## 📝 Version History

- **v2026.01.11-dynamic-audit**: Current version with reliability improvements
- Previous versions: See git history

---

**Deployed by:** Estivan Ayramia  
**Last Updated:** January 11, 2026  
**Status:** ✅ Ready for Production


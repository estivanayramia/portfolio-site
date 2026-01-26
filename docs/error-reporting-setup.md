# Error Reporting Endpoint Setup

The error reporting system sends data to `/api/error-report`. You'll need to create a Cloudflare Worker to receive these reports.

## Quick Setup (Cloudflare Workers)

1. **Create file**: `workers/error-report.js`

```javascript
export default {
  async fetch(request) {
    // Only accept POST requests  
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Parse error report
    const report = await request.json();
    
    // Log to console (view in Cloudflare dashboard)
    console.log('[Error Report]', JSON.stringify(report, null, 2));
    
    // Option 1: Send to email via EmailJS/SendGrid
    // Option 2: Store in KV storage
    // Option 3: Send to Discord webhook
    // Option 4: Log to external service like Sentry
    
    // Example: Send to Discord webhook
    if (DISCORD_WEBHOOK_URL) {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**Error Report**\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``
        })
      });
    }
    
    return new Response('OK', { status: 200 });
  }
};
```

2. **Deploy**: Add route to `wrangler.toml` or Cloudflare dashboard:
   - Route pattern: `www.estivanayramia.com/api/error-report`
   - Points to worker: `error-report`

3. **Test**: Visit site with `?debug=1`, cause an error, check logs

## Alternative: Skip server endpoint

If you don't want to set up a worker right now, the error reporting will fail silently and won't break the site. Users can still opt in, but reports won't be sent anywhere until you add the endpoint.

## What Data Gets Sent

```json
{
  "type": "javascript_error",
  "message": "Cannot read property 'foo' of undefined",
  "filename": "https://example.com/script.js",
  "line": 42,
  "col": 15,
  "stack": "Error: ...",
  "timestamp": 1706234567890,
  "url": "https://www.estivanayramia.com/",
  "userAgent": "Mozilla/5.0...",
  "viewport": "1920x1080",
  "version": "20251125-001"
}
```

✅ **No PII**: No form values, passwords, tokens, or personal data
✅ **Anonymous**: No cookies, fingerprinting, or user IDs 
✅ **Opt-in only**: Only runs if user clicks "Sure, help out"

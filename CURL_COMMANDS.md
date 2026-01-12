# Quick Test Commands for Savonie Chat

## Health Check
```bash
curl https://portfolio-chat.eayramia.workers.dev/health
```

## Normal Chat Request
```bash
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about Estivan","language":"en"}'
```

## Debug Mode (Query Parameter)
```bash
curl -X POST "https://portfolio-chat.eayramia.workers.dev/chat?debug=1" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","language":"en"}'
```

## Debug Mode (Header)
```bash
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "X-Savonie-Debug: 1" \
  -d '{"message":"Hello","language":"en"}'
```

## Check Response Headers (including X-Savonie-Version)
```bash
curl -I -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","language":"en"}'
```

## Test Empty Message (Should return 400)
```bash
curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"","language":"en"}'
```

## Test CORS Preflight
```bash
curl -X OPTIONS https://portfolio-chat.eayramia.workers.dev/chat \
  -H "Origin: https://estivanayramia.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

## Rapid Fire Test (Rate Limiting)
```bash
# Bash/Linux
for i in {1..25}; do
  curl -X POST https://portfolio-chat.eayramia.workers.dev/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Hello $i\",\"language\":\"en\"}" &
done
wait

# PowerShell
1..25 | ForEach-Object -Parallel {
  Invoke-RestMethod -Uri "https://portfolio-chat.eayramia.workers.dev/chat" `
    -Method Post `
    -Body "{`"message`":`"Hello $_`",`"language`":`"en`"}" `
    -ContentType "application/json"
}
```

## Expected Responses

### Successful Response
```json
{
  "errorType": null,
  "reply": "Estivan is a Software Engineer...",
  "chips": ["Projects", "Resume", "Contact"],
  "version": "v2026.01.11-dynamic-audit"
}
```

### Rate Limited
```json
{
  "errorType": "RateLimit",
  "reply": "Whoa, too fast! Give me a minute to catch up. ⏱️",
  "version": "v2026.01.11-dynamic-audit"
}
```

### Upstream Busy (503)
```json
{
  "errorType": "UpstreamBusy",
  "reply": "The AI service is experiencing high demand. Please try again in a moment.",
  "chips": ["Retry", "Projects", "Resume", "Contact"],
  "version": "v2026.01.11-dynamic-audit"
}
```

### Timeout (504)
```json
{
  "errorType": "Timeout",
  "reply": "The AI service timed out. Please try again with a shorter question or explore...",
  "chips": ["Retry", "Projects", "Resume", "Contact"],
  "version": "v2026.01.11-dynamic-audit"
}
```

### Offline Fallback (200)
```json
{
  "errorType": "OfflineMode",
  "reply": "Hello! I'm currently offline, but I can still help you navigate...",
  "chips": ["Projects", "Resume", "Contact", "Retry"],
  "version": "v2026.01.11-dynamic-audit"
}
```

### Health Check Response
```json
{
  "ok": true,
  "version": "v2026.01.11-dynamic-audit",
  "hasKey": true
}
```

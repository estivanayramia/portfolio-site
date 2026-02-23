# ============================================================================
# Savonie Chat Error Testing Script
# Tests various error scenarios to verify proper handling
# ============================================================================

$WORKER_URL = "https://portfolio-chat.eayramia.workers.dev"
$LOCAL_URL = "http://localhost:8787" # For local testing with wrangler dev

# Use worker URL by default
$BASE_URL = $WORKER_URL

Write-Host "=== Savonie Chat Error Testing ===" -ForegroundColor Cyan
Write-Host "Testing endpoint: $BASE_URL" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check
Write-Host "[TEST 1] Health Check (GET /health)" -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "✓ Health check passed" -ForegroundColor Green
    Write-Host "  Version: $($response.version)" -ForegroundColor Gray
    Write-Host "  Has API Key: $($response.hasKey)" -ForegroundColor Gray
    Write-Host "  Status: OK" -ForegroundColor Gray
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Normal Chat Request
Write-Host "[TEST 2] Normal Chat Request" -ForegroundColor Green
$chatBody = @{
    message = "Tell me about Estivan's projects"
    pageContent = "path: /index.html"
    language = "en"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat" -Method Post -Body $chatBody -ContentType "application/json"
    Write-Host "✓ Normal request succeeded" -ForegroundColor Green
    Write-Host "  Error Type: $($response.errorType)" -ForegroundColor Gray
    Write-Host "  Reply Length: $($response.reply.Length) chars" -ForegroundColor Gray
    Write-Host "  Version: $($response.version)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Normal request failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Empty Message (BadRequest)
Write-Host "[TEST 3] Empty Message (Should return 400 BadRequest)" -ForegroundColor Green
$emptyBody = @{
    message = ""
    language = "en"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat" -Method Post -Body $emptyBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "✗ Should have returned error, got: $($response.errorType)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✓ Correctly returned 400 BadRequest" -ForegroundColor Green
    } else {
        Write-Host "✗ Wrong status code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: Debug Mode
Write-Host "[TEST 4] Debug Mode (X-Savonie-Debug header)" -ForegroundColor Green
$debugHeaders = @{
    "Content-Type" = "application/json"
    "X-Savonie-Debug" = "1"
}

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/chat" -Method Post -Body $chatBody -Headers $debugHeaders
    Write-Host "✓ Debug request succeeded" -ForegroundColor Green
    if ($response.debug) {
        Write-Host "  Debug Info Present: Yes" -ForegroundColor Gray
        Write-Host "  Debug Keys: $($response.debug.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
    } else {
        Write-Host "  Debug Info Present: No (may not be an error scenario)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Debug request failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Rate Limiting (Multiple Rapid Requests)
Write-Host "[TEST 5] Rate Limiting Test (20 rapid requests)" -ForegroundColor Green
$rateLimitHit = $false
for ($i = 1; $i -le 20; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/chat" -Method Post -Body $chatBody -ContentType "application/json" -ErrorAction Stop
        Write-Host "  Request $i : OK" -ForegroundColor Gray -NoNewline
        if ($response.errorType -eq "RateLimit") {
            Write-Host " (Rate Limited)" -ForegroundColor Yellow
            $rateLimitHit = $true
            break
        }
        Write-Host ""
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) {
            Write-Host "  Request $i : ✓ Rate limited (429)" -ForegroundColor Green
            $rateLimitHit = $true
            break
        } else {
            Write-Host "  Request $i : Error $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 100
}

if ($rateLimitHit) {
    Write-Host "✓ Rate limiting is working" -ForegroundColor Green
} else {
    Write-Host "⚠ Rate limiting not triggered (may need more requests)" -ForegroundColor Yellow
}
Write-Host ""

# Test 6: CORS Preflight
Write-Host "[TEST 6] CORS Preflight (OPTIONS request)" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/chat" -Method Options -Headers @{
        "Origin" = "https://estivanayramia.com"
        "Access-Control-Request-Method" = "POST"
    } -ErrorAction Stop
    
    if ($response.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "✓ CORS preflight succeeded" -ForegroundColor Green
        Write-Host "  Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Gray
        Write-Host "  Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Gray
    } else {
        Write-Host "✗ CORS headers missing" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ CORS preflight failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Version Header Check
Write-Host "[TEST 7] Version Header (X-Savonie-Version)" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/chat" -Method Post -Body $chatBody -ContentType "application/json" -ErrorAction Stop
    if ($response.Headers["X-Savonie-Version"]) {
        Write-Host "✓ Version header present: $($response.Headers['X-Savonie-Version'])" -ForegroundColor Green
    } else {
        Write-Host "✗ Version header missing" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠ Could not check version header: $_" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "All basic tests completed. Review results above." -ForegroundColor Yellow
Write-Host ""
Write-Host "Manual Curl Commands for Additional Testing:" -ForegroundColor Cyan
Write-Host ""
Write-Host "# Normal chat request:" -ForegroundColor Gray
Write-Host 'curl -X POST $BASE_URL/chat -H "Content-Type: application/json" -d ''{"message":"Tell me about Estivan","language":"en"}''' -ForegroundColor White
Write-Host ""
Write-Host "# With debug mode:" -ForegroundColor Gray
Write-Host 'curl -X POST $BASE_URL/chat?debug=1 -H "Content-Type: application/json" -d ''{"message":"Hello","language":"en"}''' -ForegroundColor White
Write-Host ""
Write-Host "# Health check:" -ForegroundColor Gray
Write-Host 'curl $BASE_URL/health' -ForegroundColor White
Write-Host ""

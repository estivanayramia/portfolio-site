
$baseUrl = "https://www.estivanayramia.com"
$password = "savonie21"

function Test-Endpoint {
    param($Name, $Method, $Path, $Body, $Headers)
    Write-Host "Testing $Name ($Method $Path)..." -NoNewline
    
    try {
        $params = @{
            Uri = "$baseUrl$Path"
            Method = $Method
            ErrorAction = "Stop"
        }
        if ($Body) { 
            $params.Body = $Body 
            $params.ContentType = "application/json"
        }
        if ($Headers) { $params.Headers = $Headers }
        
        $response = Invoke-RestMethod @params
        Write-Host " OK" -ForegroundColor Green
        return $response
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host $_.Exception.Message
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host $reader.ReadToEnd()
        }
        return $null
    }
}

# 1. Health Check
$health = Test-Endpoint "Health" "GET" "/api/health"
if ($health) { $health | ConvertTo-Json -Depth 2 | Write-Host }

# 2. Auth
$authBody = @{ password = $password } | ConvertTo-Json
$auth = Test-Endpoint "Auth" "POST" "/api/auth" $authBody
if ($auth -and $auth.success) {
    Write-Host "Auth Successful. Token: $($auth.token)" -ForegroundColor Cyan
    $token = $auth.token
} else {
    Write-Host "Auth Failed" -ForegroundColor Red
    exit
}

# 3. Submit Error
$errorBody = @{
    type = "test_error"
    message = "Automated test error from PowerShell"
    url = "https://test.local"
    version = "test-v1"
} | ConvertTo-Json
Test-Endpoint "Submit Error" "POST" "/api/error-report" $errorBody

# 4. Get Errors
$headers = @{ Authorization = "Bearer $token" }
$errors = Test-Endpoint "Get Errors" "GET" "/api/errors?limit=5" $null $headers
if ($errors) {
    Write-Host "Retrieved $($errors.errors.Count) errors. Total: $($errors.total)" -ForegroundColor Cyan
    $errors.errors | Select-Object id, type, message, timestamp | Format-Table
}

# 5. Chatbot Check
$chatBody = @{ message = "hello" } | ConvertTo-Json
Test-Endpoint "Chatbot" "POST" "/api/chat" $chatBody

param(
    [string]$BaseUrl = "http://127.0.0.1:8788/api/auth"
)

$dashboardPassword = $env:DASHBOARD_PASSWORD
if ([string]::IsNullOrWhiteSpace($env:DASHBOARD_PASSWORD)) {
    Write-Error "DASHBOARD_PASSWORD environment variable is required."
    exit 2
}
$requestBody = @{ password = $dashboardPassword } | ConvertTo-Json -Compress
try {
    $response = Invoke-WebRequest -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $requestBody -Headers @{ Origin = "https://www.estivanayramia.com" }
    Write-Output ("status={0}" -f [int]$response.StatusCode)
} catch {
    Write-Error "Dashboard API request failed."
    exit 1
} finally {
    $requestBody = $null
    $dashboardPassword = $null
}

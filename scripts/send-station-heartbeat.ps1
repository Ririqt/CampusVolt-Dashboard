param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,

  [string]$BaseUrl = "https://campusvolt-v3.vercel.app",

  [ValidateSet("outlet-1", "outlet-2", "dc-type-c", "dc-micro-usb", "dc-lightning", "wireless-pad")]
  [string]$ActiveChannel = "outlet-1"
)

$channelIds = @(
  "outlet-1",
  "outlet-2",
  "dc-type-c",
  "dc-micro-usb",
  "dc-lightning",
  "wireless-pad"
)

$channels = @{}
foreach ($channelId in $channelIds) {
  $isActive = $channelId -eq $ActiveChannel
  $isAc = $channelId.StartsWith("outlet-")
  $voltage = if ($isAc) { 220.0 } else { 5.1 }
  $watts = if ($isActive) { if ($isAc) { 42.0 } else { 9.0 } } else { 0.0 }
  $channels[$channelId] = @{
    inUse = $isActive
    watts = $watts
    voltageV = $voltage
    currentA = if ($isActive) { $watts / $voltage } else { 0.0 }
    relayOn = $true
    fault = $null
  }
}

$payload = @{
  stationId = "station-01"
  firmwareVersion = "pre-hardware-test"
  rssi = -55
  channels = $channels
} | ConvertTo-Json -Depth 5

$headers = @{ Authorization = "Bearer $ApiKey" }
$response = Invoke-RestMethod `
  -Uri "$($BaseUrl.TrimEnd('/'))/api/station-status" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $payload

$response | ConvertTo-Json -Depth 6

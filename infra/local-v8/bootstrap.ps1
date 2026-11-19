#requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$folder = $PSScriptRoot
$composeEnv = Join-Path $folder '.env.local'
$backendEnv = Join-Path $folder '.env.backend.local'
if ((Test-Path -LiteralPath $composeEnv) -or (Test-Path -LiteralPath $backendEnv)) {
  throw 'Local v8 configuration already exists (or is incomplete). No secrets were overwritten. Review the existing files privately.'
}
function New-SecretHex([int]$Count) {
  $bytes = New-Object byte[] $Count
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}
function Save-PrivateText([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}
$dbPassword = New-SecretHex 32
$redisPassword = New-SecretHex 32
$jwtSecret = New-SecretHex 48
$jwtRefresh = New-SecretHex 48
$pgPort = 55488
$redisPort = 56388
$composeText = @"
NEXUS_V8_POSTGRES_PORT=$pgPort
NEXUS_V8_REDIS_PORT=$redisPort
NEXUS_V8_POSTGRES_PASSWORD=$dbPassword
NEXUS_V8_REDIS_PASSWORD=$redisPassword
"@
$backendText = @"
# Local-only sandbox. Do not copy into Render, production or shared .env.
NODE_ENV=development
IS_PULL_REQUEST=false
PORT=33188
DATABASE_URL=postgresql://nexus_v8:$dbPassword@127.0.0.1:$pgPort/nexus_v8
REDIS_URL=redis://:$redisPassword@127.0.0.1:$redisPort/0
REDIS_HOST=127.0.0.1
REDIS_PORT=$redisPort
SOCKET_IO_REDIS_ADAPTER=enabled
SOCKET_IO_REDIS_CHANNEL_PREFIX=nexus:v8:local:socket.io
JWT_SECRET=$jwtSecret
JWT_REFRESH_SECRET=$jwtRefresh
ANALYTICS_HMAC_KEY=
POSTHOG_ENABLED=false
POSTHOG_PRIVACY_ENABLED=false
SENTRY_DSN=
"@
try {
  Save-PrivateText $composeEnv $composeText
  Save-PrivateText $backendEnv $backendText
} catch {
  Remove-Item -LiteralPath $composeEnv, $backendEnv -Force -ErrorAction SilentlyContinue
  throw 'Could not save local-only environment files.'
}
Write-Host 'Local v8 sandbox configuration generated. Secrets were not printed.'
Write-Host 'PostGIS: 127.0.0.1:55488; Redis: 127.0.0.1:56388; optional API: 127.0.0.1:33188.'
Write-Host 'Only run docker compose with -f infra/local-v8/compose.yaml and --env-file infra/local-v8/.env.local.'

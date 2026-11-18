#requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$composeFile = Join-Path $dir 'compose.yaml'
$envFile = Join-Path $dir '.env.local'
if (!(Test-Path -LiteralPath $envFile)) { throw 'Missing local .env.local. Run bootstrap.ps1 first.' }
if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI is unavailable.' }
$compose = @('compose','--env-file',$envFile,'-f',$composeFile)
& docker @compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Local Compose configuration invalid.' }
$pgBinding = (& docker @compose port postgres 5432) | Out-String
if ($LASTEXITCODE -ne 0 -or $pgBinding.Trim() -ne '127.0.0.1:55488') {
  throw 'Postgres is not bound exclusively to expected local loopback port 55488.'
}
$redisBinding = (& docker @compose port redis 6379) | Out-String
if ($LASTEXITCODE -ne 0 -or $redisBinding.Trim() -ne '127.0.0.1:56388') {
  throw 'Redis is not bound exclusively to expected local loopback port 56388.'
}
$pgIdentity = (& docker @compose exec -T postgres psql -X -U nexus_v8 -d nexus_v8 -tA -v ON_ERROR_STOP=1 -c 'SELECT current_database() || ''/'' || current_user;') | Out-String
if ($LASTEXITCODE -ne 0 -or $pgIdentity.Trim() -ne 'nexus_v8/nexus_v8') {
  throw 'Postgres identity mismatch or container is unhealthy.'
}
$extensions = (& docker @compose exec -T postgres psql -X -U nexus_v8 -d nexus_v8 -tA -v ON_ERROR_STOP=1 -c "SELECT name FROM pg_available_extensions WHERE name = 'postgis';") | Out-String
if ($LASTEXITCODE -ne 0 -or !($extensions -match '(?m)^postgis\s*$')) {
  throw 'Expected PostGIS extension is not available in isolated Postgres.'
}
$redisPing = (& docker @compose exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping') | Out-String
if ($LASTEXITCODE -ne 0 -or $redisPing.Trim() -ne 'PONG') {
  throw 'Isolated Redis authentication/PING failed.'
}
Write-Host 'PASS — isolated nexus_v8 Postgres, PostGIS available and Redis PONG.'
Write-Host 'PASS — published ports restricted to 127.0.0.1:55488 and 127.0.0.1:56388.'
Write-Host 'No migrations, demo data, production systems or external services were touched.'

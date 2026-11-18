#requires -Version 5.1
[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$repo = (Resolve-Path (Join-Path $dir '../..')).Path
$privateFile = Join-Path $dir '.env.backend.local'
$composeEnv = Join-Path $dir '.env.local'
$composeFile = Join-Path $dir 'compose.yaml'
if (!(Test-Path -LiteralPath $privateFile) -or !(Test-Path -LiteralPath $composeEnv)) {
  throw 'Bootstrap secrets are missing. Run bootstrap.ps1 first.'
}
$line = Get-Content -LiteralPath $privateFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (!$line) { throw 'Missing local DATABASE_URL.' }
$url = $line.Substring('DATABASE_URL='.Length)
try { $uri = New-Object System.Uri($url) } catch { throw 'Invalid staging connection URL.' }
$userName = $uri.UserInfo.Split(':')[0]
if (
  $uri.Scheme -ne 'postgresql' -or
  $uri.Host -ne '127.0.0.1' -or
  $uri.Port -ne 55488 -or
  $uri.AbsolutePath -ne '/nexus_v8' -or
  $userName -ne 'nexus_v8'
) { throw 'Refusing migrations: DB is not the pinned loopback-only nexus_v8 target.' }
$compose = @('compose','--env-file',$composeEnv,'-f',$composeFile)
$binding = (& docker @compose port postgres 5432) | Out-String
if ($LASTEXITCODE -ne 0 -or $binding.Trim() -ne '127.0.0.1:55488') {
  throw 'Refusing migrations: pinned local Docker Postgres container not available.'
}
if (!$Apply) {
  Write-Host 'DRY RUN ONLY: the pinned local DB target and Docker binding were verified.'
  Write-Host 'No SQL executed. To apply reviewed repository migrations explicitly, rerun with -Apply.'
  exit 0
}
$oldDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL','Process')
$oldPreview = [Environment]::GetEnvironmentVariable('IS_PULL_REQUEST','Process')
try {
  [Environment]::SetEnvironmentVariable('DATABASE_URL',$url,'Process')
  [Environment]::SetEnvironmentVariable('IS_PULL_REQUEST','false','Process')
  Push-Location (Join-Path $repo 'apps/backend')
  try {
    & node scripts/migrate.js
    if ($LASTEXITCODE -ne 0) { throw 'Local migration runner failed; review the error without sharing connection strings.' }
  } finally { Pop-Location }
} finally {
  [Environment]::SetEnvironmentVariable('DATABASE_URL',$oldDatabaseUrl,'Process')
  [Environment]::SetEnvironmentVariable('IS_PULL_REQUEST',$oldPreview,'Process')
}
Write-Host 'Local-only migration runner completed; inspect schema_migrations before starting the backend.'

#requires -Version 5.1
[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$folder = $PSScriptRoot
$composeFile = Join-Path $folder 'compose.yaml'
$composeEnv = Join-Path $folder '.env.local'
if (!(Test-Path -LiteralPath $composeEnv)) { throw 'Missing local Docker configuration.' }
$compose = @('compose','--env-file',$composeEnv,'-f',$composeFile)
foreach ($item in @(@('postgres','5432','127.0.0.1:55488'),@('redis','6379','127.0.0.1:56388'))) {
  $binding = (& docker @compose port $item[0] $item[1]) | Out-String
  if ($LASTEXITCODE -ne 0 -or $binding.Trim() -ne $item[2]) {
    throw 'Refusing backend start: local Docker service/port mismatch.'
  }
}
$launcher = Join-Path $folder 'start-backend.cjs'
if ($CheckOnly) { & node $launcher --check }
else { & node $launcher }
if ($LASTEXITCODE -ne 0) { throw 'Local backend startup/check failed.' }

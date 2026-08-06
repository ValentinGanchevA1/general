$ErrorActionPreference = "Stop"
Set-Location C:\Users\vganc\g88
git fetch origin
git checkout feat/sprint-core-loop-v2
git reset --hard origin/feat/sprint-core-loop-v2

$base = "https://raw.githubusercontent.com/ValentinGanchevA1/general/feat/sprint-core-loop-v2"
Invoke-WebRequest -Uri "$base/sprint-remaining.a.b64" -OutFile ".\a.b64"
Invoke-WebRequest -Uri "$base/sprint-remaining.b.b64" -OutFile ".\b.b64"
$b64 = ((Get-Content -Raw .\a.b64) + (Get-Content -Raw .\b.b64)).Trim()
[IO.File]::WriteAllBytes("$PWD\sprint-remaining.diff", [Convert]::FromBase64String($b64))
git apply --ignore-whitespace .\sprint-remaining.diff
if ($LASTEXITCODE -ne 0) { throw "git apply failed" }

$p = "packages\shared\src\api.ts"
$c = [IO.File]::ReadAllText((Resolve-Path $p))
if (([regex]::Matches($c, 'export type ReceivedInteractionType')).Count -gt 1) {
  Write-Host "Deduping ReceivedInteractionType..."
  $i1 = $c.IndexOf("Received interactions (waves")
  $i2 = $c.IndexOf("Received interactions (waves", $i1 + 10)
  $ie = $c.IndexOf("Error envelope")
  if ($i2 -gt 0 -and $ie -gt $i2) {
    $sec = $c.LastIndexOf("`n", $i2)
    $err = $c.LastIndexOf("`n", $ie)
    $c = $c.Substring(0, $sec + 1) + $c.Substring($err + 1)
    [IO.File]::WriteAllText((Resolve-Path $p), $c)
  }
}

git add -A
git status
git commit -m "feat(core-loop): received interactions surface + status/block on sheet"
git push origin feat/sprint-core-loop-v2
Write-Host "Done. git log -1 --stat"

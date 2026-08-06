$ErrorActionPreference = "Stop"
cd C:\Users\vganc\g88
git checkout feat/sprint-core-loop-v2
git pull origin feat/sprint-core-loop-v2
# Download remaining diff from this branch
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ValentinGanchevA1/general/feat/sprint-core-loop-v2/sprint-remaining.diff" -OutFile ".\sprint-remaining.diff"
git apply --ignore-whitespace .\sprint-remaining.diff
# Fix api.ts if duplicate still present from earlier local edits
$api = Get-Content "packages\shared\src\api.ts" -Raw
$matches = [regex]::Matches($api, 'export type ReceivedInteractionType')
if ($matches.Count -gt 1) {
  Write-Host "Fixing duplicate ReceivedInteractionType..."
  $first = $api.IndexOf("// ─── Received interactions")
  $second = $api.IndexOf("// ─── Received interactions", $first + 1)
  $error = $api.IndexOf("// ─── Error envelope")
  if ($second -ge 0 -and $error -gt $second) {
    $api = $api.Substring(0, $second) + $api.Substring($error)
    Set-Content -Path "packages\shared\src\api.ts" -Value $api -NoNewline
  }
}
git add -A
git status
git commit -m "feat(core-loop): received interactions surface + status/block on sheet"
git push origin feat/sprint-core-loop-v2
Write-Host "Done."

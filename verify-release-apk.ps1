# verify-release-apk.ps1
# Pre-upload verification for G88 release APKs (APKPure, GitHub Releases, etc.)
# Usage: .\verify-release-apk.ps1 -ApkPath "C:\path\to\app-release.apk"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApkPath,

# Set this to the SHA-256 cert fingerprint of your release key once you know it,
# to get a hard PASS/FAIL match instead of just printing it for manual comparison.
    [string]$ExpectedCertSha256 = "",

# Backend URL that should appear in a prod build. Flags a FAIL if a staging/local
# URL is found instead, or if neither is found.
    [string]$ExpectedApiHost = "g88-api.onrender.com"
)

$ErrorActionPreference = "Stop"
$hadFailure = $false

function Write-Section($title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}

function Fail($msg) {
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    $script:hadFailure = $true
}

function Ok($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Warn($msg) {
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

if (-not (Test-Path $ApkPath)) {
    Fail "APK not found at $ApkPath"
    exit 1
}

$apkFile = Get-Item $ApkPath
Write-Section "File info"
Write-Host ("Path: {0}" -f $apkFile.FullName)
Write-Host ("Size: {0} MB" -f [math]::Round($apkFile.Length / 1MB, 2))

# ---------------------------------------------------------------------------
# 1. Locate apksigner (from Android SDK build-tools)
# ---------------------------------------------------------------------------
Write-Section "Locating apksigner"

$apksigner = $null
if ($env:ANDROID_HOME) {
    $btPath = Join-Path $env:ANDROID_HOME "build-tools"
    if (Test-Path $btPath) {
        $candidates = Get-ChildItem -Path $btPath -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending
        foreach ($c in $candidates) {
            $p = Join-Path $c.FullName "apksigner.bat"
            if (Test-Path $p) { $apksigner = $p; break }
        }
    }
}
if (-not $apksigner) {
    $found = Get-Command apksigner.bat -ErrorAction SilentlyContinue
    if ($found) { $apksigner = $found.Source }
}

if (-not $apksigner) {
    Fail "apksigner not found. Set ANDROID_HOME or add build-tools to PATH."
    exit 1
} else {
    Ok ("Using apksigner at: {0}" -f $apksigner)
}

# ---------------------------------------------------------------------------
# 2. Verify signature + extract cert fingerprint
# ---------------------------------------------------------------------------
Write-Section "Signature verification"

$verifyOutput = & $apksigner verify --print-certs --verbose $ApkPath 2>&1
$verifyExitCode = $LASTEXITCODE

if ($verifyExitCode -ne 0) {
    Fail ("apksigner verify failed (exit code {0})" -f $verifyExitCode)
    $verifyOutput | ForEach-Object { Write-Host ("  {0}" -f $_) }
} else {
    Ok "APK signature is valid"
    $verifyOutput | ForEach-Object { Write-Host ("  {0}" -f $_) }
}

$sha256Line = $verifyOutput | Select-String -Pattern "SHA-256 digest:\s*([0-9a-fA-F]+)"
if ($sha256Line) {
    $certSha256 = $sha256Line.Matches[0].Groups[1].Value.ToLower()
    Write-Host ("Cert SHA-256: {0}" -f $certSha256)

    if ($ExpectedCertSha256 -ne "") {
        if ($certSha256 -eq $ExpectedCertSha256.ToLower()) {
            Ok "Certificate matches expected release key"
        } else {
            Fail ("Certificate MISMATCH. Expected {0}, got {1}" -f $ExpectedCertSha256.ToLower(), $certSha256)
        }
    } else {
        Warn "No -ExpectedCertSha256 provided. Compare this value manually against your known release key fingerprint."
    }
} else {
    Warn "Could not parse cert SHA-256 from apksigner output."
}

if ($verifyOutput -match "CN=Android Debug") {
    Fail "APK appears to be signed with the ANDROID DEBUG KEY, not your release key."
}

# ---------------------------------------------------------------------------
# 3. Extract versionCode / versionName from AndroidManifest.xml (via aapt)
# ---------------------------------------------------------------------------
Write-Section "Version info"

$aapt = $null
if ($env:ANDROID_HOME) {
    $btPath = Join-Path $env:ANDROID_HOME "build-tools"
    if (Test-Path $btPath) {
        $btDirs = Get-ChildItem -Path $btPath -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending
        foreach ($c in $btDirs) {
            $p = Join-Path $c.FullName "aapt.exe"
            if (Test-Path $p) { $aapt = $p; break }
            $p2 = Join-Path $c.FullName "aapt2.exe"
            if (Test-Path $p2) { $aapt = $p2; break }
        }
    }
}

if ($aapt) {
    $badging = & $aapt dump badging $ApkPath 2>&1
    $pattern = "package: name=" + [char]39 + "([^" + [char]39 + "]+)" + [char]39 + " versionCode=" + [char]39 + "([^" + [char]39 + "]+)" + [char]39 + " versionName=" + [char]39 + "([^" + [char]39 + "]+)" + [char]39
    $pkgLine = $badging | Select-String -Pattern $pattern
    if ($pkgLine) {
        $m = $pkgLine.Matches[0]
        Write-Host ("Package:     {0}" -f $m.Groups[1].Value)
        Write-Host ("versionCode: {0}" -f $m.Groups[2].Value)
        Write-Host ("versionName: {0}" -f $m.Groups[3].Value)
        Ok "Version info extracted. Confirm versionCode is higher than your last APKPure upload."
    } else {
        Warn "Could not parse versionCode/versionName from aapt output."
    }
} else {
    Warn "aapt/aapt2 not found. Skipping versionCode/versionName extraction. Check build.gradle manually."
}

# ---------------------------------------------------------------------------
# 4. Check embedded strings for prod vs staging API host
# ---------------------------------------------------------------------------
Write-Section "Backend host check"

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $fullApkPath = (Resolve-Path $ApkPath).Path
    $zip = [System.IO.Compression.ZipFile]::OpenRead($fullApkPath)
    $hits = New-Object System.Collections.Generic.List[string]
    $suspiciousHosts = @("localhost", "127.0.0.1", "staging", "ngrok", "10.0.2.2")

    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match "\.(dex|so)$" -or $entry.FullName -eq "resources.arsc") {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
            $content = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()

            if ($content -match [regex]::Escape($ExpectedApiHost)) {
                $hits.Add("prod-host-found:" + $entry.FullName)
            }
            foreach ($sus in $suspiciousHosts) {
                if ($content -match [regex]::Escape($sus)) {
                    $hits.Add("suspicious-host(" + $sus + "):" + $entry.FullName)
                }
            }
        }
    }
    $zip.Dispose()

    $prodHits = $hits | Where-Object { $_ -like "prod-host-found:*" }
    $susHits = $hits | Where-Object { $_ -like "suspicious-host*" }

    if ($prodHits.Count -gt 0) {
        Ok ("Found expected prod API host ({0}) in {1} file(s)" -f $ExpectedApiHost, $prodHits.Count)
    } else {
        Fail ("Expected prod API host '{0}' NOT found anywhere in APK. Check your env config / build variant." -f $ExpectedApiHost)
    }

    if ($susHits.Count -gt 0) {
        Warn "Found references to suspicious/non-prod hosts:"
        $susHits | ForEach-Object { Write-Host ("  {0}" -f $_) }
    } else {
        Ok "No localhost/staging/ngrok references found"
    }
} catch {
    Warn ("Could not scan APK contents for host strings: {0}" -f $_.Exception.Message)
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Section "Summary"
if ($hadFailure) {
    Write-Host "RESULT: FAIL - do not upload until issues above are resolved." -ForegroundColor Red
    exit 1
} else {
    Write-Host "RESULT: PASS - APK looks safe to upload." -ForegroundColor Green
    exit 0
}

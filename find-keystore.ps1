# find-keystore.ps1 - locate any existing G88 release keystore and check build.gradle config

Write-Host "== Searching for keystore files ==" -ForegroundColor Cyan
Get-ChildItem -Path "C:\Users\vganc\g88" -Recurse -Include "*.keystore","*.jks" -ErrorAction SilentlyContinue |
    Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize

Write-Host ""
Write-Host "== Checking app/build.gradle for signingConfigs ==" -ForegroundColor Cyan
$gradlePath = "C:\Users\vganc\g88\apps\mobile\android\app\build.gradle"
if (Test-Path $gradlePath) {
    Select-String -Path $gradlePath -Pattern "signingConfig" -Context 2,2
} else {
    Write-Host "build.gradle not found at expected path" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "== Checking gradle.properties for release key refs ==" -ForegroundColor Cyan
$propsPath = "C:\Users\vganc\g88\apps\mobile\android\gradle.properties"
if (Test-Path $propsPath) {
    Select-String -Path $propsPath -Pattern "STORE|KEY|RELEASE" -SimpleMatch:$false
} else {
    Write-Host "gradle.properties not found" -ForegroundColor Yellow
}

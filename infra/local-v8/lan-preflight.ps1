param(
  [Parameter(Mandatory = $true)][string]$LanIp,
  [string]$CertPath,
  [string]$KeyPath
)
$ErrorActionPreference = 'Stop'
function Fail([string]$message) { Write-Error $message; exit 2 }
try {
  $parsed = [System.Net.IPAddress]::Parse($LanIp)
  $bytes = $parsed.GetAddressBytes()
  if ($parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
      -not ($bytes[0] -eq 10 -or
        ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
        ($bytes[0] -eq 192 -and $bytes[1] -eq 168))) {
    Fail 'LAN IP must be private IPv4'
  }
  $owned = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -eq $LanIp })
  if ($owned.Count -ne 1) { Fail 'LAN IP must be assigned to this PC' }
  if ($owned[0].InterfaceAlias -match 'vEthernet|Docker|WSL|Loopback') {
    Fail 'LAN IP belongs to a virtual/loopback interface, not a Wi-Fi/LAN adapter'
  }
  if ($CertPath -or $KeyPath) {
    if (-not $CertPath -or -not $KeyPath -or
        -not (Test-Path -LiteralPath $CertPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) {
      Fail 'Both certificate and private key paths must exist'
    }
  }
  $listener = @(Get-NetTCPConnection -LocalPort 4176 -State Listen -ErrorAction SilentlyContinue)
  if ($listener.Count -gt 0) { Fail 'HTTPS LAN preview port 4176 is already in use' }
  $backend = Test-NetConnection -ComputerName 127.0.0.1 -Port 33188 -InformationLevel Quiet -WarningAction SilentlyContinue
  if (-not $backend) { Fail 'Local backend is not listening on 127.0.0.1:33188' }
  Write-Output ('PASS: LAN IP belongs to this PC (' + $owned[0].InterfaceAlias + '), HTTPS port 4176 free, local API reachable.')
  Write-Output 'No firewall rules or network settings were changed.'
} catch {
  Fail 'LAN preflight failed. Check IP, network adapter, local backend and TLS files.'
}

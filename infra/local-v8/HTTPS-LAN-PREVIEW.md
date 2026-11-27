# NEXUS v8 — experimental HTTPS static phone preview

This is an **opt-in static web preview**, not an authenticated phone experience. It serves allowlisted web assets on TCP **4176** over TLS. It does **not** proxy API requests, login, writes or Socket.IO. The legacy clear-text diagnostic listener on port 4175 is retired. Nothing is deployed or migrated.

## Before starting
- Use a trusted private Wi-Fi and a dedicated test device/profile.
- Do not use production credentials, real messages, payment credentials or live provider integrations.
- Build the web bundle from the repository root:
  ```powershell
  corepack pnpm exec tsc -p web/tsconfig.json
  node web/build.mjs
  ```
- Obtain a trusted local TLS certificate and key with a Subject Alternative Name matching the PC's **actual private LAN IPv4** (for example, using locally installed mkcert). Keep the private key outside the repository. Remove the test CA from the phone when finished.

## Windows PowerShell — new terminal
```powershell
cd "$HOME\nexus-v8-staging"
$env:NEXUS_LAN_IP = '192.168.1.105'  # REPLACE with PC Wi-Fi IPv4
$env:NEXUS_LAN_CERT = 'C:\secure-test-certs\lan.pem'  # REPLACE
$env:NEXUS_LAN_KEY = 'C:\secure-test-certs\lan-key.pem'  # REPLACE
node infra/local-v8/lan-preview.cjs
```

On phone open https://<PC-IP>:4176. Windows Firewall must allow **inbound TCP 4176 only from the phone's IPv4, on the Private profile**. Never use the Public profile or router port forwarding. Close the rule after testing.

## Security and functional limits
- The listener binds only to the selected RFC1918 IPv4 address, requires TLS 1.2 or later, validates Host/Origin and serves a prebuilt allowlist of static assets.
- API paths are denied. Authentication, account changes, marketplace writes, feed requests and private data are unavailable.
- Socket.IO/WebSocket upgrades are denied. This preview cannot validate chat, notifications or realtime features.
- The web shell may load, but interactive data requires a separately reviewed and secured backend path. Do not add a generic request-forwarding proxy as a shortcut.
- The app's MapLibre policy still requires approved HTTPS map configuration on non-loopback origins. Use a build-time MapTiler key restricted to this test origin; without it, the basemap may not render.
- Press Ctrl+C to stop. No other processes are stopped automatically.

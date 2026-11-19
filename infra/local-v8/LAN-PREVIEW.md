# NEXUS v8 private LAN preview (experimental)

This is a **read-only HTTP diagnostic preview**, not the authenticated phone experience.
It binds only the explicit private IPv4 assigned to the Windows PC, on TCP 4175.
It does not change the production backend or expose PostgreSQL/Redis.

## Windows PowerShell

1. Connect phone and PC to the same trusted Wi-Fi (no guest/client isolation).
2. Pull the staging branch and build the web bundle:

```powershell
cd "$HOME\\nexus-v8-staging"
git pull --ff-only
corepack pnpm exec tsc -p web/tsconfig.json
node web/build.mjs
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object InterfaceAlias,IPAddress
```

3. Set your PC's actual private IPv4 (replace example) and start:

```powershell
$env:NEXUS_V8_LAN_HOST = '192.168.1.105'
node infra/local-v8/lan-preview.mjs
```

4. Windows Firewall: allow inbound TCP 4175 **only from the phone's IP**, **Private** profile, only for the duration of testing. Do not use a broad public rule. Close the rule afterwards.
5. Open `http://<PC-IP>:4175` in the phone browser.

## Limitations / fail-closed behavior

- The current MapLibre map runtime intentionally allows OSM tiles only on loopback and requires HTTPS plus MapTiler config on non-loopback origins. Thus **the interactive map is not expected to render on LAN HTTP** until a separate reviewed HTTPS path is implemented. Do not weaken that policy to force a map to appear.
- The existing web client login and realtime UI may appear, but LAN proxy rejects all auth, writes and Socket.IO. It permits only unauthenticated GET /api/v1/feed. A live feed may still be empty or unavailable depending on backend state.
- The local NestJS backend must be started separately with the sandbox launcher and must remain bound to 127.0.0.1:33188.
- No actual production accounts, private messages, real payment credentials or provider integrations should be used.
- This preview does not provide full NEXUS Web on a phone. The next milestone is a trusted HTTPS origin, same-origin proxy for /api/v1 and WebSocket, synthetic accounts, and provider egress review.

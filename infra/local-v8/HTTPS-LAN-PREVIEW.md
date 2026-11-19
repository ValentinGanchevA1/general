# NEXUS v8 — experimental HTTPS phone preview

This is a **separate opt-in mode** from the existing read-only HTTP diagnostic `lan-preview.mjs` (port 4175). The HTTPS proxy is `lan-preview.cjs` on port **4176**, serving the existing web client and forwarding `/api/v1` plus Socket.IO upgrades to the **fixed local** backend `127.0.0.1:33188`. Nothing is deployed or migrated.

## Before starting
- Use **synthetic test accounts only**. Backend external-provider isolation is not yet independently verified.
- PC and phone must be on a trusted private Wi-Fi, without client isolation.
- Start the existing PostGIS/Redis stack and local NestJS backend with `infra/local-v8/start-backend.ps1` in its own persistent PowerShell window. Check `http://127.0.0.1:33188/health`.
- Build web from repo root: `corepack pnpm exec tsc -p web/tsconfig.json` and `node web/build.mjs`.
- Obtain a trusted local TLS certificate and key with a Subject Alternative Name matching your PC's **actual private LAN IPv4** (for example using locally installed mkcert). Keep the private key outside the repository. Trusting a new CA on the phone changes device trust; use a dedicated test device/profile and remove the test CA afterwards.

## Windows PowerShell — new terminal
```powershell
cd "$HOME\nexus-v8-staging"
$env:NEXUS_LAN_IP = '192.168.1.105'  # REPLACE with PC Wi-Fi IPv4
$env:NEXUS_LAN_CERT = 'C:\secure-test-certs\lan.pem'  # REPLACE
$env:NEXUS_LAN_KEY = 'C:\secure-test-certs\lan-key.pem'  # REPLACE
node infra/local-v8/lan-preview.cjs
```
On phone open `https://<PC-IP>:4176`. Windows Firewall must allow **inbound TCP 4176 only from the phone's IPv4, on Private profile**. Never use Public profile or router port forwarding. Close the rule after testing.

## Limits
- This is **not** a hardened/public reverse proxy. The backend Origin header is normalized to the local backend origin; this is not an authorization mechanism. LAN access must be firewall-restricted.
- The web app has existing HTTPS-only non-loopback map policy: OSM standard tiles work **only on loopback**. Phone basemap needs a valid build-time MapTiler key restricted to the LAN HTTPS origin, and a rebuilt web bundle. Without it, web shell may load but basemap may not.
- Web login and Socket.IO integration have **not yet been end-to-end verified on a physical phone**. Do not use production credentials or real messages.
- Certificate trust and backend egress safeguards require separate validation.
- Press Ctrl+C to stop; no other processes are stopped automatically.

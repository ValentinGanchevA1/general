# NEXA web preview v1

Browser validation slice for the NEXA web/desktop client. It intentionally remains outside the pnpm workspace while browser auth, CORS, map behavior and realtime lifecycle are validated, avoiding a new lockfile importer in the frozen-install monorepo.

## Implemented

- Canonical **Map / Discover / Pulse / Connections / You** navigation.
- Responsive desktop rail + mobile bottom navigation.
- NEXA dark/light/system semantics: cyan for discovery/live and violet for action/identity.
- Interactive Web Mercator map preview with pan/zoom, visible OSM raster tiles and required attribution.
- Settled map bounds + zoom drive `POST /api/v1/discovery/nearby`; superseded requests are aborted.
- Live `GET /api/v1/feed` Pulse activity.
- Live Connections using the existing interactions, friends, conversations and `/realtime` Socket.IO contracts.
- Browser-specific `/api/v1/auth/web/login|refresh|logout` adapter over the existing auth service.
- Memory-only access token + HttpOnly SameSite refresh cookie; no auth credential in Web Storage.
- Cross-tab auth mutation serialization with Web Locks and credential-free session-change signals with BroadcastChannel.
- Production fail-closed HTTPS CORS policy and same-origin API/realtime topology.
- Strict TypeScript with shared API/event types.
- Demo map/Pulse fallback without fabricated private Connections data.

## Run

From repository root after the normal workspace install:

```bash
pnpm exec tsc -p web/tsconfig.json
node web/build.mjs
node web/serve.mjs
```

Open `http://127.0.0.1:4174` with the backend on `http://127.0.0.1:3001`.

Local preview uses fixed loopback mappings only. Production uses same-origin `/api/v1` and `/socket.io`; there is no user-editable backend/socket host.

## Browser auth boundary

- Access token exists only in browser memory.
- Refresh token is an HttpOnly SameSite=Lax cookie scoped to `/api/v1/auth/web` and `Secure` in production.
- Refresh rotation reuses the backend token-family replay protection.
- Browser auth mutations require an allowlisted `Origin` plus `X-Nexa-Web-Session: 1`.
- Login, refresh and logout are serialized across same-origin tabs with the Web Locks API so two tabs cannot concurrently consume the same rotating refresh credential.
- Login/logout/terminal refresh failure broadcast only a `session-changed` signal; access and refresh tokens are never broadcast between tabs.
- A remote session change reloads the other tab so it cannot keep using an access token from a replaced account/session.
- `sessionStorage` is used only for a short-lived reload-loop suppression marker; it never stores a credential.
- Access-token rotation reconnects Socket.IO with the new handshake token and rejoins the active chat room.
- Public deployment requires HTTPS/current browsers with Web Locks; legacy fallback remains functional but does not provide cross-tab serialization.

## Map runtime boundary

The accepted production direction is **MapLibre GL JS** with a managed vector-tile provider for beta and a PMTiles/self-hosted portability path. The package is not yet added to the frozen pnpm workspace, so the runtime policy is intentionally split from dependency adoption.

- Standard OpenStreetMap raster tiles are available only on loopback (`localhost`, `127.0.0.1`, `::1`) for local preview, with attribution and no offline/prefetch path.
- Every non-loopback browser origin fails closed to the production target (`maplibre` + `maptiler`) and does **not** generate OSM standard tile requests until the pinned MapLibre runtime and approved provider configuration are bundled.
- Discovery points, viewport state, pan/zoom controls and `POST /discovery/nearby` remain renderer/provider independent; a missing production basemap does not change the spatial query contract.
- The planned MapLibre worker path is same-origin at `/maplibre-worker.mjs`; the web edge CSP reserves only `worker-src 'self'` and does not add a CDN/external script origin.
- Provider hostnames, style URLs and public API-key policy will be allowlisted explicitly in the implementation that actually bundles the provider. No arbitrary/user-editable map host is accepted.

Opening Map, Discover or Connections does **not** request browser/device geolocation. The Varna default camera is product context, not the user's asserted position.

## Realtime build boundary

The web bundle imports `socket.io-client` at build time from the already locked `apps/admin` workspace dependency. This avoids a runtime CDN/backend script inclusion and avoids a new web workspace importer. A dedicated web package/importer is the cleaner long-term architecture once the browser slice graduates from preview.

## Real-browser regression gate

`Web Preview CI` runs the real browser code in headless Chrome without Playwright/Cypress. The current suite covers:

- multi-tab rotating refresh cookies, Web Locks serialization, HttpOnly isolation and BroadcastChannel session propagation (#594);
- Socket.IO access-token rotation, reconnect and active-room rejoin (#595);
- map viewport supersession, request abort and stale-response protection (#596);
- Connections friend accept, wave-back, REST history/read, room join, chat send, ack/event dedupe and peer receive (#638);
- map runtime policy: loopback-only OSM preview, fail-closed public MapLibre target and same-origin worker contract.

This is strong Chromium regression coverage, not a declaration that every browser engine is production-supported.

## Deployed HTTPS smoke gate

`Web Deployed Smoke` is a manual `workflow_dispatch` gate for a stable staging/production-like HTTPS origin.

- `public-only` verifies edge health, required security headers, same-origin `/api/v1` reachability and a real `/socket.io` WebSocket/Engine.IO upgrade.
- `authenticated` additionally signs in through the deployed UI, verifies the refresh cookie remains HttpOnly, rotates `/auth/web/refresh`, waits for realtime Connections and signs out.
- Authenticated mode reads only `WEB_SMOKE_EMAIL` and `WEB_SMOKE_PASSWORD` repository secrets; credentials are never accepted as workflow inputs or committed to the repo.
- The default authenticated mode fails closed when those secrets are not configured.

The existence of this workflow is not itself a deployed pass. The release gate closes only after it succeeds against the chosen stable HTTPS topology.

## Remaining release blockers

1. Choose the production web hostname/deployment policy, configure same-origin `/api/v1` + `/socket.io`, and allowlist only the exact HTTPS browser origin.
2. Define the supported-browser matrix and validate the Web Locks/BroadcastChannel session contract on each supported engine.
3. Add a pinned `maplibre-gl` dependency through a reproducible lockfile/importer change, bundle its same-origin worker, then configure the approved production basemap/style/key origins and validate attribution, CSP, performance and provider terms.
4. Run `Web Deployed Smoke` in authenticated mode against the final stable HTTPS staging/production-like topology and require a green result before web release.

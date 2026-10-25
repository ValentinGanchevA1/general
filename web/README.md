# NEXA web preview v1

Browser validation slice for the NEXA web/desktop client. `web/` is now a real pnpm workspace importer so browser runtime dependencies are explicit, pinned through the canonical lockfile and installed by the normal frozen workspace install.

## Implemented

- Canonical **Map / Discover / Pulse / Connections / You** navigation.
- Responsive desktop rail + mobile bottom navigation.
- NEXA dark/light/system semantics: cyan for discovery/live and violet for action/identity.
- Interactive Web Mercator loopback preview with pan/zoom, visible OSM raster tiles and required attribution.
- Pinned **MapLibre GL JS 6.15.0** production renderer with a same-origin worker and bundled CSS.
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

The accepted production direction is **MapLibre GL JS + MapTiler Cloud** for beta, with a PMTiles/self-hosted portability path. The renderer dependency is exact-pinned at `maplibre-gl@6.15.0`; the build verifies that installed version before producing browser artifacts.

- Standard OpenStreetMap raster tiles remain available only on loopback (`localhost`, `127.0.0.1`, `::1`) for local preview, with attribution and no offline/prefetch path.
- Every non-loopback browser origin requires HTTPS plus a valid build-generated MapTiler configuration. Missing/invalid config fails closed and never falls back to OSM standard tiles.
- The MapLibre worker is copied from the pinned package to `/dist/maplibre-worker.mjs`; CSP uses `worker-src 'self'` and does not require a blob/CDN worker.
- MapLibre CSS is copied from the pinned package into `/dist/maplibre-gl.css`.
- Discovery points are rendered as a provider-neutral GeoJSON source; server cluster points are rendered directly and are **not** re-clustered in the browser.
- Rotation/pitch are disabled; no geolocation control is added.
- Provider/network errors are not rendered verbatim because provider URLs can contain the public API key.
- The renderer removes its WebGL/worker instance when the containing app shell is replaced, preventing detached-map leaks under the current shell rendering model.

### Production MapTiler build variables

`node web/build.mjs` reads:

- `NEXA_MAPTILER_API_KEY` — browser-public MapTiler API key. Do **not** treat it as a server secret; protect/restrict it in MapTiler to the approved NEXA web origin before launch.
- `NEXA_MAPTILER_MAP_ID` — simple map identifier; defaults to `streets-v4`.
- `NEXA_MAPTILER_REGION` — `eu` (default) or `global`.

`eu` produces `https://api.maptiler.eu/...` style requests and is the privacy-first NEXA default. MapTiler documents the EU endpoint as EU-only infrastructure for end-user personal data such as IP addresses, but it is available only on paid plans. `global` explicitly selects `https://api.maptiler.com/...` for a future global rollout policy.

The generated `/dist/map-config.js` contains only public browser map configuration. Arbitrary provider origins, path-like map IDs, whitespace/control characters in the key, and non-HTTPS public map activation are rejected.

Opening Map, Discover or Connections does **not** request browser/device geolocation. The Varna default camera is product context, not the user's asserted position.

## Realtime build boundary

The web client now owns its browser runtime dependency explicitly through the `web` pnpm importer (`socket.io-client@4.8.4`). The bundle no longer resolves Socket.IO from `apps/admin/node_modules`, and no runtime CDN/backend script inclusion is used.

## Real-browser regression gate

`Web Preview CI` runs the real browser code in headless Chrome without Playwright/Cypress. The current suite covers:

- multi-tab rotating refresh cookies, Web Locks serialization, HttpOnly isolation and BroadcastChannel session propagation (#594);
- Socket.IO access-token rotation, reconnect and active-room rejoin (#595);
- map viewport supersession, request abort and stale-response protection (#596);
- Connections friend accept, wave-back, REST history/read, room join, chat send, ack/event dedupe and peer receive (#638);
- map runtime policy: loopback-only OSM preview, HTTPS-only production activation, exact MapTiler origins and same-origin worker;
- real MapLibre/WebGL initialization with the bundled worker, NEXA GeoJSON overlay and viewport callback using a local style so CI never depends on a paid provider key.

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
3. Provision a protected MapTiler browser key on the chosen paid plan/region, validate provider attribution and terms, and complete a production-map performance/lifecycle gate before enabling the key in public deployment.
4. Run `Web Deployed Smoke` in authenticated mode against the final stable HTTPS staging/production-like topology and require a green result before web release.

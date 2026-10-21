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

## Map preview boundary

The draft uses the standard OpenStreetMap raster tile service only for visible preview tiles, with attribution and no offline/prefetch path. Public NEXA must select a production tile provider or self-hosted/vector-tile stack with explicit SLA, privacy, caching and usage terms.

Opening Map, Discover or Connections does **not** request browser/device geolocation. The Varna default camera is product context, not the user's asserted position.

## Realtime build boundary

The web bundle imports `socket.io-client` at build time from the already locked `apps/admin` workspace dependency. This avoids a runtime CDN/backend script inclusion and avoids a new web workspace importer. A dedicated web package/importer is the cleaner long-term architecture once the browser slice graduates from preview.

## Remaining release blockers

1. Configure production same-origin reverse proxies for `/api/v1` and `/socket.io`, then set exact HTTPS `CORS_ORIGINS`.
2. Validate Web Locks refresh serialization, account switching and logout propagation with multi-tab browser E2E across the supported browser matrix.
3. Select the production map/tile stack.
4. Add browser E2E for auth rotation, realtime reconnect/room rejoin, friend actions, chat send/receive and viewport races.
5. Deploy a non-public preview and validate cookie/proxy behavior end to end.

# NEXA Web Client v1 — implementation contract

## Decision

Ship a small browser slice first without creating a new pnpm workspace importer. The goal is to validate browser-specific risk—CORS, auth storage, map behavior and realtime lifecycle—before committing to the full web runtime architecture.

## Canonical IA

| Surface | Web role |
|---|---|
| Map | Primary spatial state; people, events, listings and contextual creation |
| Discover | Navigation hub into focused discovery lanes; never a duplicate ranked feed |
| Pulse | Local activity interpretation; events, alerts and listings |
| Connections | Private interactions inbox, conversations and realtime 1:1 chat |
| You | Identity, verification, map presence, privacy and settings |

## API reuse

The browser client keeps the existing mobile token endpoints unchanged and adds a browser-only adapter under `/api/v1/auth/web`:

- `POST /auth/web/login` — validates with the existing auth service, returns the short-lived access token and sets the refresh token as an HttpOnly cookie.
- `POST /auth/web/refresh` — rotates the existing refresh-token family through the HttpOnly cookie and returns a new short-lived access token.
- `POST /auth/web/logout` — revokes the current refresh token and clears the browser cookie.
- `GET /auth/me`, `POST /discovery/nearby`, `GET /feed`, `GET /interactions/inbox`, `GET /conversations`, conversation-message/read endpoints, friend-request actions and `POST /interactions/wave` reuse existing Bearer access-token contracts.

No backend schema, PostGIS query or persistence change is introduced.

## Browser session contract

- Access token is memory-only. It is not written to `localStorage` or `sessionStorage`.
- Refresh token is never exposed to browser JavaScript and is stored in an HttpOnly, SameSite=Lax cookie scoped to `/api/v1/auth/web`.
- The refresh cookie is `Secure` in production; local HTTP preview keeps `Secure=false` so the local preview can exercise the flow.
- Production browser traffic targets same-origin `/api/v1`; the web edge/reverse proxy forwards that path to NestJS. The browser never accepts a user-selected API host.
- Local preview has two fixed mappings only: `127.0.0.1:4174 → 127.0.0.1:3001` and `localhost:4174 → localhost:3001`.
- Browser auth mutations require both an allowlisted `Origin` and `X-Nexa-Web-Session: 1`.
- A single tab deduplicates refresh requests so one expired access token does not rotate the refresh family multiple times concurrently.
- Login, refresh and logout are serialized across same-origin tabs with one Web Locks API lock. This prevents two tabs from concurrently consuming the same rotating refresh cookie and triggering replay-family revocation.
- BroadcastChannel communicates only a `session-changed` control signal. Access and refresh tokens are never broadcast between tabs.
- Login, logout or terminal refresh rejection causes other tabs to reload and recover from the current HttpOnly-cookie state, preventing a replaced account/session from leaving a stale access token active in another tab.
- A short-lived `sessionStorage` marker suppresses cross-tab reload-signal loops. It contains no credential or account data.
- Public deployment requires HTTPS/current browsers with Web Locks. The fallback path preserves browser functionality when Web Locks are unavailable but cannot guarantee cross-tab refresh serialization; the final supported-browser policy must explicitly define this boundary.

## CORS / edge contract

- Development explicitly allows the admin origins plus `http://127.0.0.1:4174` and `http://localhost:4174` for the browser preview.
- Production has no implicit localhost fallback and must provide at least one explicit HTTPS `CORS_ORIGINS` entry.
- Origins are normalized as bare HTTP(S) origins only.
- REST and Socket.IO use the same configured origin source.
- Production edge routing must expose both `/api/v1` and `/socket.io` on the web origin. `/socket.io` transports the bundled browser client's `/realtime` namespace; no runtime script is loaded from the backend.

## Map / viewport contract

- Web v1 renders a real interactive slippy map with Web Mercator raster tiles; no third-party JavaScript map SDK or workspace dependency is introduced in this draft.
- Default camera opens on Varna as product context only. The map does **not** request device geolocation and does not label viewport center as the user.
- Pan, wheel zoom, zoom controls and keyboard navigation update the in-memory camera.
- After 220 ms of settled interaction, current NE/SW bounds + integer zoom become authoritative for `POST /discovery/nearby`.
- A newer viewport query aborts its predecessor so stale responses cannot win a fast pan/zoom race.
- Entity-kind filters reuse the current viewport and query only for authenticated sessions.
- Demo mode keeps the interactive map but issues no discovery requests.
- Preview tiles are requested only for the visible viewport from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; no prefetch, offline download or background tile crawl is implemented.
- OpenStreetMap attribution remains visible. Standard OSM tiles are preview-only; public NEXA requires a production provider or self-hosted/vector-tile stack with explicit SLA, privacy, caching and usage terms.

## Connections / realtime contract

- Connections is private/authenticated; unauthenticated users see a sign-in state rather than fabricated social activity.
- Actionable activity comes from `GET /interactions/inbox?limit=24`; conversations come from `GET /conversations`.
- Friend-request accept/decline and wave-back call the existing domain endpoints; IDs are UUID-validated before becoming API path segments or action payloads.
- Opening a conversation loads up to 50 recent messages, marks the conversation read, then requests `conversation:join` on `/realtime`.
- Sending is enabled only after the room-join acknowledgment and enforces the backend 2000-character limit.
- Incoming `chat:message` events are deduplicated by message id; background conversation events coalesce into a short delayed Connections refresh rather than triggering a request storm.
- Friend presence updates only the existing privacy-gated `peerOnline` field returned for friend conversations.
- Browser Connections does **not** emit `presence:update` or request device location. Realtime use here is limited to user-room, friend, wave and chat events.
- The preview bundles `socket.io-client` at build time from the already locked `apps/admin` workspace dependency. There is no runtime CDN/backend script inclusion and no new web lockfile importer.
- When the access token rotates, the socket reconnects with the new handshake token because guarded gateway events re-verify `handshake.auth.token`. Any active conversation is then rejoined.
- Location/location-session chat messages display a generic sharing label in the list; raw coordinates are not rendered by this Connections slice.
- Realtime/backend error details are not surfaced verbatim in the Connections UI; user-visible failures are generic while server-side diagnostics remain authoritative.

## Automated browser validation

`Web Preview CI` now runs the actual browser code in headless Chrome through the dependency-free CDP harness. These checks are regression evidence for the implemented contracts; they do not by themselves define the final cross-browser support matrix.

- **Multi-tab auth (#594):** two real same-origin tabs share an HttpOnly rotating refresh cookie; the unlocked control reproduces replay, Web Locks serialize rotations, the cookie remains unavailable to JavaScript, and BroadcastChannel/reload-loop behavior is verified.
- **Realtime token rotation (#595):** the real `WebRealtimeClient` connects with one token, rotates the token, reconnects with a new Socket.IO handshake, rejoins the active conversation, and receives room traffic afterward.
- **Viewport race (#596):** the actual bundled app pans to newer viewports, aborts an older slow `/discovery/nearby` request, and prevents its stale response from overwriting the current result.
- **Connections actions/chat (#638):** the actual bundled app accepts a friend request, sends a wave-back, opens REST history, marks read, joins the Socket.IO room, sends chat, deduplicates ack + event delivery, and renders a peer reply.

## DOM / request security

- Production API routing is fixed to same-origin `/api/v1`; arbitrary client-side request destinations are not configurable.
- Backend/user strings are escaped before template composition.
- Rendered app-shell markup is parsed inertly and passed through an allowlist sanitizer before insertion with `replaceChildren`.
- Map tiles, controls, attribution and markers are created through DOM APIs (`createElement`, `textContent`).
- Dynamic REST path IDs are UUID-validated before interpolation.
- The local preview server applies a restrictive CSP, `nosniff`, frame denial, same-origin opener isolation and strict referrer policy.
- Preview `Permissions-Policy` explicitly disables geolocation, camera and microphone.

## Security / privacy

- Keep discovery coordinates under the server's existing privacy/fuzzing policy; the web client must not infer or persist higher precision.
- Map interaction is not equivalent to device location permission.
- Discover and Connections must not request fresh device location on their own.
- No vanity badges/counts in primary navigation.
- `You` renders factual verification state and does not calculate a public numeric trust score.

## Acceptance criteria

- Primary navigation is exactly `Map / Discover / Pulse / Connections / You`.
- Demo mode works without backend connectivity and identifies itself as demo.
- Map supports pan, zoom controls, wheel zoom and keyboard navigation.
- Settled viewport bounds + zoom drive authenticated nearby discovery queries; superseded requests are aborted.
- No implicit geolocation request occurs when Map, Discover or Connections opens.
- OSM attribution is visible in the preview and no tile prefetch/offline path exists.
- Connections loads the authenticated inbox + conversations and supports friend-request actions, wave-back and realtime 1:1 chat.
- Conversation sending is blocked until room join succeeds and survives access-token rotation via socket reconnect + room rejoin.
- Neither access nor refresh tokens are persisted in Web Storage; refresh token remains unavailable to browser JavaScript.
- Same-origin tabs serialize browser auth cookie mutations; session-change signaling never includes credentials.
- Production refuses to start without an explicit HTTPS CORS allowlist.
- Production browser requests use same-origin `/api/v1`, and realtime uses same-origin `/socket.io` through a controlled edge/reverse proxy.
- No user-editable API/socket host exists.
- No runtime executable script is fetched from an HTTP backend/CDN; the realtime client is part of the built web bundle.
- Dynamic app-shell DOM insertion passes through the allowlist sanitizer; map dynamic nodes use safe DOM APIs.
- `You` exposes no synthetic trust score.
- Theme follows system by default and supports explicit dark/light overrides.
- At <=760px the desktop rail becomes a five-item bottom navigation.
- Existing workspace definition and lockfile remain untouched.

## Remaining release blockers

1. **Production hosting:** choose the final web hostname/deployment policy, expose same-origin `/api/v1` + `/socket.io`, and configure the exact HTTPS browser origin in the backend allowlist without weakening the current fail-closed CORS policy.
2. **Supported-browser policy:** define the production browser matrix and validate the Web Locks/BroadcastChannel session contract on every supported engine; the current automated browser gate is Chrome/Chromium only.
3. **Production map stack:** replace preview-only OSM standard raster tiles with an approved provider or self-hosted/vector-tile stack and document SLA, attribution, caching, CSP, privacy and usage terms.
4. **Deployed end-to-end validation:** run the browser auth cookie, REST proxy and Socket.IO upgrade flows against the final HTTPS preview/production topology, including login/refresh/logout and reconnect behavior.

The core Chromium browser interaction gaps originally tracked for multi-tab auth, realtime reconnect/room rejoin, friend/wave/chat actions and viewport stale-response races are covered by merged real-browser E2E tests (#594, #595, #596, #638).
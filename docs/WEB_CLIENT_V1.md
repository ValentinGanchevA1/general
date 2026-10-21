# NEXA Web Client v1 — implementation contract

## Decision

Ship a small browser slice first without creating a new pnpm workspace importer. The goal is to validate browser-specific risk—CORS, auth storage, map behavior and realtime lifecycle—before committing to the full web runtime architecture.

## Canonical IA

| Surface | Web role |
|---|---|
| Map | Primary spatial state; people, events, listings and contextual creation |
| Discover | Navigation hub into focused discovery lanes; never a duplicate ranked feed |
| Pulse | Local activity interpretation; events, alerts and listings |
| Connections | Chats and actionable relationship state |
| You | Identity, verification, map presence, privacy and settings |

## API reuse

The browser client keeps the existing mobile token endpoints unchanged and adds a browser-only adapter under `/api/v1/auth/web`:

- `POST /auth/web/login` — validates with the existing auth service, returns the short-lived access token and sets the refresh token as an HttpOnly cookie.
- `POST /auth/web/refresh` — rotates the existing refresh-token family through the HttpOnly cookie and returns a new short-lived access token.
- `POST /auth/web/logout` — revokes the current refresh token and clears the browser cookie.
- `GET /auth/me`, `POST /discovery/nearby`, and `GET /feed` continue to use the existing Bearer access-token contracts.

No backend schema, PostGIS query or persistence change is introduced.

## Browser session contract

- Access token is memory-only. It is not written to `localStorage` or `sessionStorage`.
- Refresh token is never exposed to browser JavaScript and is stored in an HttpOnly, SameSite=Lax cookie scoped to `/api/v1/auth/web`.
- The refresh cookie is `Secure` in production; local HTTP preview keeps `Secure=false` so the local preview can exercise the flow.
- Production browser traffic targets same-origin `/api/v1`; the web edge/reverse proxy forwards that path to NestJS. The browser never accepts a user-selected API host.
- Local preview has two fixed mappings only: `127.0.0.1:4174 → 127.0.0.1:3001` and `localhost:4174 → localhost:3001`.
- Browser auth mutations require both an allowlisted `Origin` and `X-Nexa-Web-Session: 1`, preventing form-based CSRF and disallowed cross-origin callers from using the cookie endpoints.
- A single tab deduplicates refresh requests so one expired access token does not rotate the refresh family multiple times concurrently.
- Multi-tab refresh coordination is still a required E2E/security case before public deployment because the backend intentionally revokes a refresh-token family on replay.

## CORS contract

- Development explicitly allows the admin origins plus `http://127.0.0.1:4174` and `http://localhost:4174` for the browser preview.
- Production has no implicit localhost fallback.
- Production must provide `CORS_ORIGINS` with at least one explicit HTTPS origin; startup fails otherwise.
- The production web origin remains in `CORS_ORIGINS` because backend browser-auth requests validate the `Origin` header even when the public edge proxies `/api/v1` same-origin.
- Origins are normalized as bare origins only. Paths, query strings, fragments and non-HTTP(S) schemes are rejected.
- REST and Socket.IO use the same origin source.

## Map / viewport contract

- Web v1 now renders a real interactive slippy map with Web Mercator raster tiles; no third-party JavaScript map SDK or workspace dependency is introduced in this draft.
- Default camera opens on Varna as product context only. The map does **not** request device geolocation and does not label viewport center as the user.
- Pan, wheel zoom, zoom controls and keyboard navigation update the in-memory camera.
- After 220 ms of settled interaction, the current NE/SW bounds + integer zoom become authoritative for `POST /discovery/nearby`.
- An in-flight discovery request is aborted when a newer viewport query supersedes it, preventing stale responses from winning a fast pan/zoom race.
- Entity-kind filters reuse the current viewport and trigger a fresh nearby query only for authenticated sessions.
- Demo mode keeps the interactive map but does not issue discovery API requests.
- Preview tiles are requested only for the visible viewport from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; no prefetch, offline download or background tile crawl is implemented.
- OpenStreetMap attribution remains visible on the map and tile requests retain normal browser referrer behavior.
- The standard OSM tile service is a **preview-only** provider. Public/paid NEXA release must use a production tile provider or self-hosted/vector-tile stack with explicit SLA, privacy, caching and usage terms.

## DOM / request security

- Production API routing is fixed to same-origin `/api/v1`; arbitrary client-side request destinations are not configurable.
- Backend/user strings are escaped before template composition.
- Rendered app-shell markup is parsed inertly and passed through an allowlist sanitizer before nodes are inserted with `replaceChildren`; event-handler, URL-bearing and unknown attributes/tags are rejected.
- Map tiles, controls, attribution and markers are created through DOM APIs (`createElement`, `textContent`) rather than HTML string insertion.

## Security / privacy

- Keep discovery coordinates under the server's existing privacy/fuzzing policy; the web client must not infer or persist higher precision.
- Map interaction is not equivalent to device location permission.
- Discover must not request fresh device location on its own.
- No vanity badges/counts in primary navigation.
- `You` must render factual verification state from the backend and must not calculate a public numeric trust score.

## Acceptance criteria

- Primary navigation is exactly `Map / Discover / Pulse / Connections / You`.
- Demo mode works without backend connectivity and identifies itself as demo.
- Map supports pan, zoom controls, wheel zoom and keyboard navigation.
- Settled viewport bounds + zoom drive authenticated nearby discovery queries.
- Superseded discovery requests are aborted.
- No implicit geolocation request occurs when Map or Discover opens.
- OSM attribution is visible in the preview and no tile prefetch/offline path exists.
- Authenticated mode uses the browser session adapter plus the existing discovery and Pulse endpoints.
- Neither access nor refresh tokens are persisted in Web Storage.
- Refresh token is unavailable to browser JavaScript.
- Production refuses to start without an explicit HTTPS CORS allowlist.
- Production browser requests use same-origin `/api/v1` through a controlled edge/reverse proxy.
- No user-editable API host exists.
- Dynamic app-shell DOM insertion passes through the allowlist sanitizer; map dynamic nodes use safe DOM APIs.
- `You` exposes no synthetic trust score.
- Theme follows system by default and supports explicit dark/light overrides.
- At <=760px the desktop rail becomes a five-item bottom navigation.
- Existing workspace definition and lockfile remain untouched.

## Remaining release blockers

1. Select the production web hostname, configure its same-origin `/api/v1` reverse proxy, and put that HTTPS web origin in `CORS_ORIGINS`.
2. Add multi-tab refresh/replay E2E coverage.
3. Select the production map/tile provider or self-hosted vector-tile stack and document SLA, attribution, caching, CSP and privacy policy.
4. Wire Connections to the existing chat/friend/wave APIs and Socket.IO.
5. Add browser E2E coverage for auth + map viewport races and a non-public preview deployment.

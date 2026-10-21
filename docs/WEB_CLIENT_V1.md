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
- The refresh cookie is `Secure` in production; local HTTP preview keeps `Secure=false` so `127.0.0.1:4174` can exercise the flow.
- Browser auth mutations require both an allowlisted `Origin` and `X-Nexa-Web-Session: 1`, preventing form-based CSRF and disallowed cross-origin callers from using the cookie endpoints.
- A single tab deduplicates refresh requests so one expired access token does not rotate the refresh family multiple times concurrently.
- Multi-tab refresh coordination is still a required E2E/security case before public deployment because the backend intentionally revokes a refresh-token family on replay.

## CORS contract

- Development explicitly allows the admin origins plus `http://127.0.0.1:4174` and `http://localhost:4174` for the browser preview.
- Production has no implicit localhost fallback.
- Production must provide `CORS_ORIGINS` with at least one explicit HTTPS origin; startup fails otherwise.
- Origins are normalized as bare origins only. Paths, query strings, fragments and non-HTTP(S) schemes are rejected.
- REST and Socket.IO use the same origin source.

## Security / privacy

- Escape backend/user strings before HTML insertion.
- Keep map coordinates under the server's existing privacy/fuzzing policy; the web client must not infer or persist higher precision.
- Discover must not request fresh device location on its own.
- No vanity badges/counts in primary navigation.
- `You` must render factual verification state from the backend and must not calculate a public numeric trust score.
- The editable API base is a developer-only preview control and must not ship as a public production setting.

## Acceptance criteria

- Primary navigation is exactly `Map / Discover / Pulse / Connections / You`.
- Demo mode works without backend connectivity and identifies itself as demo.
- Authenticated mode uses the browser session adapter plus the existing discovery and Pulse endpoints.
- Neither access nor refresh tokens are persisted in Web Storage.
- Refresh token is unavailable to browser JavaScript.
- Production refuses to start without an explicit HTTPS CORS allowlist.
- Backend/user strings rendered into HTML are escaped.
- `You` exposes no synthetic trust score.
- Theme follows system by default and supports explicit dark/light overrides.
- At <=760px the desktop rail becomes a five-item bottom navigation.
- Existing workspace definition and lockfile remain untouched.

## Remaining release blockers

1. Select the production preview host and set its exact `CORS_ORIGINS` value.
2. Add multi-tab refresh/replay E2E coverage.
3. Replace the geometry preview with the selected real map renderer/provider and document tile/privacy policy.
4. Wire Connections to the existing chat/friend/wave APIs and Socket.IO.
5. Add browser E2E coverage and a non-public preview deployment.

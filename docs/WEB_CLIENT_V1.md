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
| You | Identity, trust, map presence, privacy and settings |

## API reuse

The preview uses existing contracts only: `POST /auth/login`, `GET /auth/me`, `POST /discovery/nearby`, and `GET /feed` under `/api/v1`. No backend schema, PostGIS query, Socket.IO event or persistence change is introduced.

## Security / privacy

- Never persist refresh tokens in browser storage.
- Escape backend/user strings before HTML insertion.
- Keep map coordinates under the server's existing privacy/fuzzing policy; the web client must not infer or persist higher precision.
- Discover must not request fresh device location on its own.
- No vanity badges/counts in primary navigation.
- Public deployment is blocked until browser auth uses HttpOnly cookies/BFF and CORS is origin-restricted.

## Acceptance criteria

- Primary navigation is exactly `Map / Discover / Pulse / Connections / You`.
- Demo mode works without backend connectivity and identifies itself as demo.
- Authenticated mode uses existing discovery and Pulse endpoints.
- Backend/user strings rendered into HTML are escaped.
- Theme follows system by default and supports explicit dark/light overrides.
- At <=760px the desktop rail becomes a five-item bottom navigation.
- Existing workspace definition and lockfile remain untouched.

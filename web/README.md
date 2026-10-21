# NEXA web preview v1

Dependency-neutral browser slice for the NEXA web/desktop client. It intentionally lives outside the pnpm workspace while browser auth, CORS, discovery behavior and product scope are validated. This avoids adding a new lockfile importer to the existing frozen-install monorepo.

## Implemented

- Canonical **Map / Discover / Pulse / Connections / You** navigation.
- Responsive desktop rail + mobile bottom navigation.
- NEXA dark/light/system semantics: cyan for discovery/live and violet for action/identity.
- Live `POST /api/v1/discovery/nearby` map signals after sign-in.
- Live `GET /api/v1/feed` Pulse activity after sign-in.
- Existing `POST /api/v1/auth/login` + `GET /api/v1/auth/me` contracts.
- Strict TypeScript with shared API/activity types imported type-only.
- Demo fallback for frontend work without a backend session.

## Run

From repository root after the normal workspace install:

```bash
pnpm exec tsc -p web/tsconfig.json
node web/build.mjs
node web/serve.mjs
```

Open `http://127.0.0.1:4174`.

The default API base is `http://127.0.0.1:3001/api/v1`; it can be changed in the sign-in panel.

## Browser auth boundary

The preview stores only the access token in `sessionStorage`. Refresh tokens are deliberately not persisted. Before public web launch, move browser auth to **Secure + HttpOnly + SameSite cookies** or a BFF/session layer.

## Next slice

1. Confirm backend CORS origin policy for the selected preview host.
2. Add production browser session/cookie contract.
3. Replace the geometry preview with a real map renderer after selecting map provider + tile/privacy policy.
4. Wire Connections to existing chat/friend/wave APIs and Socket.IO.
5. Add browser E2E coverage and a non-public preview deployment.

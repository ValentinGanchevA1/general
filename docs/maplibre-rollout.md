# MapLibre rollout and rollback contract

## Current state

Production stays on the `legacy` renderer by default. MapLibre is available in the native bundle, guarded by build-time renderer request, native availability, validated MapTiler provider configuration, and the server-owned runtime renderer policy.

The manual `iOS MapLibre Canary` workflow is the first gate that intentionally uses the real MapTiler client configuration and real provider style URL. It does not change the production default.

The manual `Android MapLibre Canary` workflow builds a non-production Release APK from the same real provider configuration and forces the CI-only `maplibre-smoke.js` entry. It proves the Android artifact contains the MapLibre provider-canary bundle, but it does not replace physical-device interaction smoke.

B2.6 provides a server-owned runtime renderer policy so MapLibre-capable production releases can be disabled without publishing a new mobile binary. B2.6a defines the public backend contract. B2.6b wires that contract into the mobile Redux/runtime renderer gate with bounded local caching and fail-closed refresh behavior.

## Canary prerequisites

The repository must provide:

- Actions secret `NEXA_MAPTILER_API_KEY`.
- Optional repository variable `NEXA_MAPTILER_MAP_ID` (default: `streets-v4`).
- Optional repository variable `NEXA_MAPTILER_REGION` (`eu` or `global`, default: `eu`).

The MapTiler key is a public client credential embedded in app builds. Storing it as a GitHub secret is pipeline hygiene, not the security boundary. Provider-side restrictions, rotation, and quota controls remain required.

## Remote renderer policy

The backend exposes `GET /api/v1/runtime-config/map-renderer` with the shared `MapRendererPolicyDto` contract.

Server-side activation is fail-closed:

- `NEXA_MAPLIBRE_REMOTE_ENABLED=true` enables the remote MapLibre permission.
- Missing values, `false`, alternate casing, whitespace, numeric truthy values, and malformed values all resolve to disabled.
- The endpoint is read-only and returns no secret material.
- HTTP intermediaries are instructed not to cache the response; the mobile client owns its bounded local cache policy.
- The endpoint is exempt from the application IP throttler because carrier-NAT clients can legitimately share one public IP and would otherwise create false policy outages. The endpoint performs no DB or Redis work.

Mobile activation is also fail-closed:

- A release must still be built with exact `NEXA_MAP_RENDERER=maplibre`; remote policy can never promote a `legacy` build.
- The response is runtime-validated. Wrong version, malformed fields, non-boolean enable values, non-integer TTLs, and TTLs above the client maximum are rejected.
- A valid policy may be persisted only until its server TTL, capped by the client maximum of 60 seconds.
- Persisted data is revalidated on read; expired or overlong cached enable permissions are discarded.
- The map hydrates a still-valid cache for startup continuity and immediately revalidates it with the backend.
- The policy refreshes at TTL expiry and when the app returns to the foreground while the map is mounted.
- Network failure, malformed response, or expired policy immediately resolves renderer permission to `legacy`; the client retries from the safe state.

The effective production MapLibre decision is therefore:

`build requests maplibre` **AND** `fresh remote policy allows maplibre` **AND** `native MapLibre is available` **AND** `provider config is valid`.

## Live policy verification

The manual `Runtime Renderer Policy Verification` workflow is the audit-able read-only check for the deployed public policy endpoint. It never changes Render configuration.

For the B2.6 live rollback proof, use this sequence only after a backend deployment containing B2.6a/B2.6b is live:

1. Run **Actions → Runtime Renderer Policy Verification** with `expected_enabled=false` and require green.
2. Change backend `NEXA_MAPLIBRE_REMOTE_ENABLED` to exact `true` and let the backend apply that configuration.
3. Run the workflow with `expected_enabled=true` and require green.
4. Change the backend variable back to `false` or remove it.
5. Run the workflow again with `expected_enabled=false` and require green.

Each run validates HTTP 200, the v1 response shape, boolean `mapLibreEnabled`, integer TTL between 1 and 60 seconds, and `Cache-Control: no-store`. A 404 means the backend deployment is too old and the env toggle must not be treated as a valid B2.6 test.

The workflow proves the live server control plane. A MapLibre-capable non-production client must still verify that `true` enables its renderer request and that the final `false` returns it to `legacy` within the bounded policy lifetime.

## iOS provider canary

Run **Actions → iOS MapLibre Canary → Run workflow** from the intended release commit on `master`.

The workflow must:

1. Validate the real MapTiler client configuration.
2. Build the CI-only smoke entry with `NEXA_MAP_RENDERER=maplibre`.
3. Force the smoke surface to use the resolved real provider style URL.
4. Launch the Release simulator build.
5. Require the NEXA runtime-router/MapLibre ready marker within 30 seconds.
6. Fail on startup crash, provider/style load failure, or ready timeout.

## Android provider-canary APK

Run **Actions → Android MapLibre Canary → Run workflow** from the intended release commit on `master`.

The workflow must:

1. Validate the real MapTiler client configuration.
2. Build a Release APK with `ENTRY_FILE=maplibre-smoke.js` and `NEXA_MAP_RENDERER=maplibre`.
3. Force the smoke surface to use the resolved real provider style URL.
4. Verify the APK embeds `assets/index.android.bundle`.
5. Verify the embedded Hermes bundle contains the `maplibre-smoke-ready` marker so a normal production entry cannot pass accidentally.
6. Upload the APK as `nexa-maplibre-canary-apk` for physical-device smoke.

A green Android canary workflow proves the intended APK was built with the MapLibre provider-canary entry. It does **not** count as the required Android device-smoke pass until the uploaded APK is installed and exercised on a physical device.

## Activation criteria

Do not flip the production default to MapLibre until all of the following are true:

1. `master` CI, lint, typecheck, Android build, CodeQL, and provider config gates are green for the intended release commit.
2. The synthetic/offline iOS MapLibre smoke is green.
3. The real-provider iOS canary is green for **three consecutive runs** from the intended release commit or equivalent release candidate commits with no MapLibre/runtime changes between them.
4. The Android provider-canary APK is green and that exact artifact passes physical-device smoke for launch, map load, pan/zoom, cluster press, entity press, long press, selection, and dimming.
5. A physical iOS device smoke passes the same interaction set plus foreground/background recovery and location-permission transitions.
6. MapTiler client-key restrictions, rotation procedure, and quota/alerting are configured provider-side.
7. The remote renderer policy is verified to force `legacy` in a MapLibre-capable client without publishing a new client build, including TTL expiry and network-failure behavior.
8. There are no unresolved MapLibre-specific startup crashes, ready timeouts, provider authorization failures, or interaction regressions.

Production activation must be a separate PR. The canary workflows must never mutate the renderer default.

## Rollback triggers

Rollback to `legacy` on any of the following after activation:

- MapLibre startup crash or repeated ready timeout.
- MapTiler authorization, style, or tile failures affecting normal map use.
- Broken pan/zoom, clustering, entity selection, long press, or viewport updates.
- Material location-permission or foreground/background regression.
- Material crash-rate or performance regression attributable to the MapLibre path.
- Provider quota/restriction incident that cannot be mitigated without user impact.

## Rollback procedure

For clients that include B2.6b, the primary renderer rollback is remote:

1. Set backend `NEXA_MAPLIBRE_REMOTE_ENABLED` to disabled or remove it, then apply the backend configuration.
2. Active map clients revalidate at their bounded policy deadline (maximum 60 seconds) and on foreground. On refresh failure they also fail closed to `legacy`.
3. Keep backend/API/database state unchanged; no data migration is involved.
4. Use a client rebuild with `NEXA_MAP_RENDERER=legacy` as the secondary rollback if the remote control path itself is impaired or for older clients that predate B2.6b.
5. Rotate/restrict the MapTiler client key only if credential exposure or abuse is involved.
6. Preserve the MapLibre implementation and canary workflows for diagnosis and the next controlled rollout attempt.

No data migration or server rollback is required for renderer rollback.

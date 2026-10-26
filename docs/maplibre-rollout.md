# MapLibre rollout and rollback contract

## Current state

Production stays on the `legacy` renderer by default. MapLibre is available in the native bundle, guarded by build-time renderer request, native availability, and validated MapTiler provider configuration.

The manual `iOS MapLibre Canary` workflow is the first gate that intentionally uses the real MapTiler client configuration and real provider style URL. It does not change the production default.

## Canary prerequisites

The repository must provide:

- Actions secret `NEXA_MAPTILER_API_KEY`.
- Optional repository variable `NEXA_MAPTILER_MAP_ID` (default: `streets-v4`).
- Optional repository variable `NEXA_MAPTILER_REGION` (`eu` or `global`, default: `eu`).

The MapTiler key is a public client credential embedded in app builds. Storing it as a GitHub secret is pipeline hygiene, not the security boundary. Provider-side restrictions, rotation, and quota controls remain required.

## Canary execution

Run **Actions → iOS MapLibre Canary → Run workflow** from the intended release commit on `master`.

The workflow must:

1. Validate the real MapTiler client configuration.
2. Build the CI-only smoke entry with `NEXA_MAP_RENDERER=maplibre`.
3. Force the smoke surface to use the resolved real provider style URL.
4. Launch the Release simulator build.
5. Require the NEXA runtime-router/MapLibre ready marker within 30 seconds.
6. Fail on startup crash, provider/style load failure, or ready timeout.

## Activation criteria

Do not flip the production default to MapLibre until all of the following are true:

1. `master` CI, lint, typecheck, Android build, CodeQL, and provider config gates are green for the intended release commit.
2. The synthetic/offline iOS MapLibre smoke is green.
3. The real-provider iOS canary is green for **three consecutive runs** from the intended release commit or equivalent release candidate commits with no MapLibre/runtime changes between them.
4. A non-production Android build with `NEXA_MAP_RENDERER=maplibre` passes device smoke for launch, map load, pan/zoom, cluster press, entity press, long press, selection, and dimming. This remains a blocking criterion until it is automated.
5. A physical iOS device smoke passes the same interaction set plus foreground/background recovery and location-permission transitions.
6. MapTiler client-key restrictions, rotation procedure, and quota/alerting are configured provider-side.
7. There are no unresolved MapLibre-specific startup crashes, ready timeouts, provider authorization failures, or interaction regressions.

Production activation must be a separate PR. The canary workflow must never mutate the renderer default.

## Rollback triggers

Rollback to `legacy` on any of the following after activation:

- MapLibre startup crash or repeated ready timeout.
- MapTiler authorization, style, or tile failures affecting normal map use.
- Broken pan/zoom, clustering, entity selection, long press, or viewport updates.
- Material location-permission or foreground/background regression.
- Material crash-rate or performance regression attributable to the MapLibre path.
- Provider quota/restriction incident that cannot be mitigated without user impact.

## Rollback procedure

1. Set the release renderer request to `legacy` or omit `NEXA_MAP_RENDERER`.
2. Rebuild and redeploy the affected client release.
3. Keep backend/API/database state unchanged; renderer rollback is client-side only.
4. Rotate/restrict the MapTiler client key only if credential exposure or abuse is involved.
5. Preserve the MapLibre implementation and canary workflow for diagnosis and the next controlled rollout attempt.

No data migration or server rollback is required for renderer rollback.

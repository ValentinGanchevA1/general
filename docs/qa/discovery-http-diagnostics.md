# Discovery HTTP diagnostics (privacy-safe)

Related: #1030, #580, #963, #992.

## Scope

The production backend's `RuntimeHttpDiagnosticsService` previously emitted aggregate status classes for **all** endpoints. This could not distinguish the two map discovery lanes or an HTTP 429, and the global Nest interceptor does not observe responses rejected by guards before controller execution.

`DiscoveryHttpDiagnosticsService` observes only **POST** requests whose Express `req.path` matches exactly:

- `/api/v1/discovery/nearby` → `nearby`
- `/api/v1/discovery/places` → `places`

It is registered as middleware **before Nest guards**. The logger emits at most one `discovery_http` summary per 15-second interval, only for intervals with activity, with these bounded counters for each lane:

- `completed`, `2xx`, `429`, `4xx_other`, `5xx`, `other`
- `aborted`, `slow_over_5s` (completed request duration only), `inflight`

Counts reset between windows while ongoing requests remain in flight. No per-request timing or raw payload is retained. The logging enablement matches `RUNTIME_DIAGNOSTICS_ENABLED` (production on by default, `false`/ `0`/ `off` disables it).

## Privacy and diagnosis

The service does **not** record or log IP addresses, user IDs, coordinates, viewport geometry, tokens, headers, query strings, request/response bodies, entity IDs, device identifiers, or individual request timings. It uses a hard-coded route allowlist and fixed field names.

To investigate `Nearby signal interrupted`:

1. Identify the exact tested APK run/commit/SHA-256 and approximate UTC reproduction window; don't upload personal screen recordings.
2. Compare `nearby_429` versus `places_429`, `5xx`, `aborted`, and `slow_over_5s` in that window. Whole-service `runtime_resources` remains a separate coarse resource signal.
3. If a lane shows 429, reproduce a short burst and inspect the configured rate-limit tracker/key behavior before changing limits. Multiple users behind a shared public IP may share a tracker.
4. If the lane shows slow responses or 5xx, profile the relevant service/database path under a controlled test with sanitized data.
5. If all server outcomes are healthy but the mobile banner persists, verify device connectivity/client timeout and the Sentry `map_discovery_failure` breadcrumb. A breadcrumb is not independently guaranteed to be uploaded.

A zero count for 429/5xx alone **does not prove** the absence of client-side failures. Do not claim root cause or Android release sign-off from server aggregates.

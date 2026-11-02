# #963 discovery lane regression note

This branch intentionally keeps the legacy `/discovery/nearby` lane authoritative for the full blocking map error state while treating renderer-local public Place discovery as supplementary.

Behavioral contract:
- legacy discovery failure + no usable points -> full recoverable `error`;
- legacy discovery failure + visible legacy/Place points -> compact `stale-error`;
- Place-only discovery failure -> compact retryable `stale-error`, even when the Place lane has no points;
- both lanes failing with no usable content -> full recoverable `error`.

Device QA evidence for #963 showed repeated `Discovery did not load` while Render telemetry recorded 0 HTTP 4xx and 0 HTTP 5xx in the same window. The purpose of this change is to prevent a supplementary Place transport/state failure from replacing the entire map surface.

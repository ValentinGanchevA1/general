# Discovery realtime delta contract

`discovery:entity:enter` and `discovery:entity:update` carry the same sanitized `EntityPoint` shape returned by `/discovery/nearby`.

The server must apply viewer-specific visibility, blocking, dating/friends filters, and location privacy before emitting these events. Raw `presence:delta` coordinates are not a discovery entity source.

`discovery:entity:leave` carries the canonical kind-aware `DiscoveryPointKey` (`user:id`, `event:id`, or `listing:id`). Clusters remain authoritative to viewport discovery queries and are not mutated by entity delta events.

# NEXUS Worlds W2-5 — Privacy, realtime and abuse safety contract

## Scope
Worlds are presentation/context hints within the same NEXUS identity, map, social graph and feature infrastructure. A selected World is not an authorization, visibility, age-verification, trust, or safety grant.

## Non-negotiable invariants
- **Authorization:** every REST, socket, entity, conversation, event and marketplace action must authorize against server-side current state. World selection never grants access.
- **Location:** exact GPS must not enter public discovery rows, World presets, logs, analytics or client-visible realtime payloads. Use the established server privacy transformation and spatial scoping.
- **Visibility:** global visibility settings, block relationships and account safety state apply across Worlds; no World-specific bypass or alternate visibility defaults.
- **Realtime:** joining a room is not a permanent authorization grant. Revalidate recipients at delivery for sensitive deltas and evict stale subscriptions where existing policy requires.
- **Sharing:** live-location sharing remains explicit, scoped to an authorized conversation and stoppable/expirable. Worlds must not start or extend location-sharing sessions.
- **Age eligibility:** existing server-side eligibility gate and socket revocation behavior remain authoritative.
- **Abuse controls:** existing rate limits, idempotency, moderation, blocking and trust policies remain unchanged; World context must not introduce alternate command paths.
- **Telemetry:** never log exact location, tokens or private identifiers in World telemetry. Use bounded, privacy-safe diagnostics.
- **Fail closed:** when authoritative authorization/eligibility cannot be established, do not deliver private realtime payloads or permit protected actions.

## W2-5 review checklist
- [ ] World selection cannot change account visibility or sharing permissions.
- [ ] World preset resolution is local, read-only and does not generate queries.
- [ ] Any eventual World-driven discovery uses existing discovery APIs, filters and privacy policy.
- [ ] Realtime rooms and recipient fanout are governed by existing authorization checks.
- [ ] World context is absent from privileged action payloads unless strictly needed and validated.
- [ ] Block, mute, report, moderation and account deletion behavior remain global.
- [ ] No exact GPS, tokens or private IDs in logs/analytics.
- [ ] Automated regression tests cover cross-World behavior for blocks, visibility and authorization before any integration.

## Evidence and limits
The existing code audit inspected the main realtime gateway, discovery-subscription gateway and Map v1 DoD. This document records the contract and review criteria; it does not claim additional tests or physical-device validation have been performed.

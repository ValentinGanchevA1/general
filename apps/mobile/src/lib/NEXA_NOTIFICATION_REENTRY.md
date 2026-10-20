# NEXA Notification & Re-entry Identity v2

## Product rule

A notification is a continuation of discovery, not a detached inbox event. Tapping it must return the user to the most useful NEXA context with a deterministic, privacy-safe fallback.

## Semantic taxonomy

| Kind | Pillar | Privacy | Re-entry |
| --- | --- | --- | --- |
| `interaction.wave` | Interaction | private | peer on Map |
| `interaction.gift` | Interaction | private | Gifts inbox |
| `interaction.message` | Interaction | sensitive | Chat |
| `interaction.connection-request` | Interaction | private | Interactions |
| `interaction.connection-accepted` | Interaction | private | peer on Map |
| `live.nearby-alert` | Live | ambient | Pulse / Nearby |
| `event.nearby` | Event | ambient | Event detail |
| `marketplace.nearby-listing` | Marketplace | ambient | Listing detail |
| `trust.id-verified` | Trust | sensitive | Trust Center |
| `trust.id-rejected` | Trust | sensitive | Trust Center |
| `discovery.daily-recap` | Discovery | private | Interactions |

The delivery channel (`waves`, `messages`, `events`, etc.) remains separate from the semantic pillar. Channels control preferences and rate limits; kinds control identity and re-entry.

## FCM data contract

Every v2 push includes:

- `schemaVersion=2`
- allow-listed semantic `kind`
- `pillar`
- `privacy`
- allow-listed `target`
- legacy `type` for older clients
- only opaque IDs needed for authenticated re-entry

The payload must never contain exact coordinates, an address, H3 cells, a message preview, verification rejection reason or arbitrary route/screen names.

## Lock-screen privacy

Lock-screen title/body intentionally reveal less than the authenticated destination. Examples:

- message: `New message` / `Open NEXA to read it.`
- nearby alert: `A live signal is nearby` / `Open NEXA to see what's happening.`
- trust rejection: `Trust status needs attention` / `Open NEXA Trust Center to review the next step.`

Sensitive detail is revealed only after NEXA opens under the authenticated session.

## Re-entry safety

Mobile treats all FCM data as untrusted input. `nexaNotificationReentry.ts` maps known kinds to a closed destination union; the payload cannot directly choose a React Navigation route.

Missing, malformed or unsupported identifiers fall back to the Map (or the nearest safe interaction surface for a known interaction). Legacy `type` payloads remain supported during migration.

Cold-start taps are queued until `NavigationContainer` is ready. FCM `messageId` values are deduplicated for 30 seconds so the same tap cannot navigate twice through initial/background handlers. The queue is one-deep: the latest explicit user tap wins.

## Foreground behavior

Socket.IO remains the owner of foreground interaction UI. FCM foreground delivery does not produce a second toast or duplicate navigation.

## Acceptance criteria

1. No NEXA push exposes precise location, message text or verification reason on the lock screen or in FCM data.
2. Every v2 kind has a deterministic destination and a safe fallback.
3. Unknown/malformed payloads never crash navigation and return to the Map.
4. A wave or accepted connection returns to the peer's map context when a public pin can be resolved.
5. Nearby alerts re-enter Pulse with the canonical `nearby` filter, not an unsupported ad-hoc filter.
6. Event/listing notifications route to their canonical nested detail stacks.
7. Trust decisions route to Trust Center without exposing review details in the push.
8. Cold-start and background notification handlers cannot double-navigate the same FCM message.
9. Existing pre-v2 `type` payloads continue to route during migration.
10. Notification preference labels use NEXA product language and preserve existing backend channel keys.

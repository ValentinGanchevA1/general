# NEXA Motion + Interaction Feedback v2

NEXA feedback should feel spatial, precise, and truthful. Motion and tactile response must reinforce the state the user actually changed; they must never become decorative noise, impersonate a successful server mutation, or interrupt map interaction.

## Motion timing

| Token | Duration | Use |
| --- | ---: | --- |
| immediate | 110ms | pressed / local state feedback |
| standard | 180ms | small UI transitions |
| sheet | 250ms | sheet-adjacent transitions |
| map | 320ms | contextual camera / spatial movement |
| celebration | 340ms | rare success / ambient celebration |

Reduced Motion rules:
- decorative motion can be skipped entirely;
- essential state transitions use at most a 120ms opacity crossfade;
- no bounce or scale choreography is required to understand state.

## Semantic tactile grammar

Product code calls semantic intents instead of raw vibration values:

| Intent | Meaning | Typical surfaces |
| --- | --- | --- |
| `select` | local selection changed | marker, filter, FAB state |
| `discover` | spatial context expanded | cluster expansion, nearby discovery |
| `connect` | a person-to-person action | Wave, Like, Gift |
| `commit` | consequential state mutation accepted | RSVP, follow/friend state, verification submit, block/unblock |
| `success` | rare positive milestone | match, verified, challenge/achievement completion |
| `warning` | consequential warning | destructive or irreversible warning |
| `error` | direct action failed | rejected mutation / failed user action |

High-frequency intents are throttled both per intent and globally so rapid marker taps or stacked mutation outcomes cannot spam the vibration motor.

## Truthful mutation boundary

`withNexaMutationFeedback()` is the canonical wrapper for direct async mutations. It emits the requested success intent only after the operation resolves and emits `error` only after the operation rejects.

Use it for direct user actions such as:
- Event RSVP → `commit`;
- Gift send → `connect`;
- profile Wave → `connect`;
- follow / friend / block state changes → `commit`;
- ID verification submission → `commit`.

Do not use it for reads, background refreshes, Socket.IO reconciliation, presence changes, map viewport queries, or automatic retries.

## Origin policy

Every tactile event has an origin:

- `direct` — initiated by the user. Allowed while the app is active.
- `realtime` — foreground ambient / Socket.IO arrival. Only rare `success` celebrations are tactile; inbound Wave/Gift/discovery events remain visual-only.
- `system` — passive or background state change. Always tactile-silent.

All origins are silent while the app is inactive or backgrounded. This prevents incoming realtime activity from vibrating after NEXA is no longer the active interaction surface.

`triggerNexaHaptic()` defaults to the conservative `realtime` origin. Direct product controls should use the `nexaHaptics` facade (`nexaHaptics.select()`, `connect()`, `commit()`, etc.), which explicitly marks the feedback as direct.

## Platform policy

Android currently uses a conservative vibration fallback behind the semantic adapter. Product code must not call `Vibration` directly.

On iOS, the foundation intentionally emits no full-device vibration until a proper native haptic driver is available. This avoids replacing subtle Taptic-style feedback with an accessibility-hostile vibration hack.

When a native haptic module is introduced later, only the adapter should change; feature code keeps the same semantic API.

## Current product integration

- Map entity tap → `select`.
- Cluster tap → `discover`.
- Map Wave / Like → `connect`; Pass → `commit`.
- Profile Wave → confirmed `connect`.
- Profile follow / friend / block / unblock → confirmed `commit`.
- Gift send → confirmed `connect`.
- Event RSVP from either map sheet or full event detail → confirmed `commit`.
- ID verification submit → confirmed `commit`.
- Direct mutation failures → `error`.
- Ambient Wave/Gift Socket.IO toasts → visual only.
- Ambient achievement/level/challenge success may use `success` only while the app is active.

## Integration rules

- Never trigger tactile feedback from render loops, socket reconciliation loops, map region-change callbacks, live-location updates, delivery receipts, or marker redraws.
- Immediate tactile feedback may acknowledge a direct tap; server-outcome feedback must wait for the actual result.
- Do not use `success` for routine toggles. Reserve it for meaningful milestones.
- Haptics are enhancement-only; failures must never block navigation or actions.
- Motion and haptics must not expose, log, or persist location data.

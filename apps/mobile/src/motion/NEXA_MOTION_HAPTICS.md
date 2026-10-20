# NEXA Motion + Haptics Foundation v1

NEXA motion should feel spatial, precise, and alive. It must never become decorative noise or slow down map interaction.

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

## Semantic haptics

The UI calls semantic intents rather than raw vibration values:
- `select` — marker, filter, snap-state selection;
- `discover` — cluster expansion / nearby discovery;
- `connect` — wave, join, offer, relationship action;
- `success` — verified / matched / completed;
- `warning` — destructive or consequential warning.

High-frequency intents are throttled so map interactions cannot spam the vibration motor.

### Platform policy

Android currently uses a conservative vibration fallback behind the semantic adapter. Product code must not call `Vibration` directly.

On iOS, the foundation intentionally emits no full-device vibration until a native haptic driver is available. This avoids replacing subtle selection feedback with an accessibility-hostile vibration hack.

When a native haptic module is introduced later, only the adapter should change; feature code keeps the same semantic API.

## Integration rules

- Never trigger haptics from render loops, socket reconciliation loops, or map region-change callbacks.
- Trigger only from user intent or confirmed outcome.
- Do not haptic on every live-location update, marker redraw, presence event, or delivery receipt.
- Haptics are enhancement-only; failures must never block navigation or actions.
- Motion and haptics must not expose or persist location data.

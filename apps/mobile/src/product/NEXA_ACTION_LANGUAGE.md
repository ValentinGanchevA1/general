# NEXA App-wide Action Language v2

NEXA is a discovery product. Action copy must make the next user action obvious without promising an outcome that has not happened yet.

## Canonical intents

| Intent | Canonical label | Meaning | Accent |
| --- | --- | --- | --- |
| Discover | `Discover nearby` | reveal or retry spatial discovery | cyan / discovery |
| Connect | `Connect` | person-to-person interaction | violet / action |
| Join | `Join` | request participation in an event | violet / action |
| Offer | `Send offer` | submit marketplace intent | violet / action |
| Verify | `Verify` | confirm an identity signal | violet / action; cyan is the earned verified state |
| Retry | `Try again` | repeat a failed recoverable operation | neutral secondary |

Concrete variants are encouraged when they describe the mechanism more clearly than the umbrella verb. Examples: `Wave`, `Message`, `Connect profile`, `Make offer`, `Send counter`, `Verify phone`, `Retry discovery`.

## Truthfulness rule

Button copy describes the operation the user is about to attempt. Confirmed-state copy appears only after the source of truth accepts the operation.

Examples:
- Event: `Join` → server confirms RSVP → `Going`.
- Marketplace: `Send offer` → server accepts → offer state is rendered from refreshed data.
- Verification: `Verify identity` → upload succeeds → `Under review`; `Verified` is reserved for the verified state.
- Connect: `Wave` is the action; successful delivery is not implied before the interaction request succeeds.

Never use copy such as `Matched`, `Verified`, `Connected`, `Offer sent`, or similar completed language as the pre-submit CTA.

## Surface grammar

### Map and discovery
- `Discover everyone`
- `Show nearby`
- `Create nearby`
- `Retry discovery`
- `Zoom in`

The map remains visible during recoverable discovery states. Retry copy must not expose endpoint, PostGIS, H3, or network implementation details.

### Person
- `Wave`
- `Message`
- `Connect profile`
- Dating-specific `Like` and `Pass` remain explicit product actions because changing them to generic `Connect` would alter meaning.

### Event
- Primary participation CTA: `Join`.
- Confirmed going state: `Going`.
- Other RSVP states remain `Maybe` and `Can't go`.

### Marketplace
- Entry: `Make offer`.
- Mutation: `Send offer`.
- Negotiation: `Send counter`, `Accept offer`, `Decline offer`, `Withdraw offer`.
- Messaging the seller is still `Message` / `Message seller`, under the Connect intent.

### Trust and verification
- `Verify email`
- `Verify phone`
- `Verify identity`
- rejected submission: `Try identity verification again`
- optional supporting social signal: `Connect profile`

Verification copy must describe specific earned signals. Do not use numeric trust-score language or promise that a social link "boosts trust".

## Pending and completed language

Canonical pending labels exist for shared patterns (`Discovering…`, `Connecting…`, `Joining…`, `Sending offer…`, `Verifying…`, `Retrying…`). Existing surfaces may keep a spinner with the stable CTA label when changing text would cause layout shift; the semantic rule is more important than animated wording.

Completed labels are state labels, not optimistic button labels. Server, Redux, XState, or other authoritative feature state owns completion.

## Hierarchy

- **Discovery / cyan**: system intelligence, live/nearby context, verified state.
- **Primary action / violet**: user intent that changes or starts something.
- **Secondary / neutral**: details, retry when compact, cancel/back, supporting actions.
- **Warning / danger**: consequences and destructive operations only.

Color is not sufficient to convey meaning; geometry, copy, iconography and accessibility labels must remain understandable without color.

## Accessibility

- Minimum interactive target: 44dp.
- Accessibility label should express the same semantic action as visible copy.
- Selection/confirmation state must be exposed through accessibility state where applicable.
- Busy actions are disabled until the operation settles.
- Do not announce success until the authoritative operation has completed.

## Migration boundaries

This language layer does not change REST, Socket.IO, PostGIS, navigation, or shared data shapes. It may consume existing state to choose truthful labels, but it must not invent new product state from copy.

Internal package names such as `@g88/*` remain infrastructure identifiers until a separate technical namespace migration.

## Acceptance criteria

- The canonical six intents have one typed source of truth.
- Map, spatial sheets, Event detail, Marketplace detail, Trust Center and profile trust actions use the same semantic resolvers.
- Event `going` renders `Join` before confirmation and `Going` after confirmation.
- Marketplace offer stages use distinct, truthful verbs.
- Phone/ID trust surfaces no longer say `Add phone`, `Resubmit`, or vague `Verify` when a more precise action is available.
- Recoverable discovery failures use `Retry discovery` and keep the map as the primary surface.
- No CTA promises a successful server outcome before confirmation.
- No action copy exposes exact location, internal service names, backend errors, or trust-score framing.

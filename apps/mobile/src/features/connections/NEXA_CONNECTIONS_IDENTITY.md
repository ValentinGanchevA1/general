# NEXA Connections Identity v2

Connections is the relationship-return surface for NEXA. It is not a social feed and it does not compete with the map as the discovery surface.

## Product role

- **Map** discovers people and local activity.
- **Connections** keeps people the user can return to: waves, requests, follows and chats.
- **Pulse** remains the live local activity interpretation layer.
- Passive popularity metrics do not belong in Connections.

## Information architecture

The screen has two stable views:

1. **Activity** — waves, connection requests, follows and other relationship signals.
2. **Chats** — durable 1:1 conversations and message requests.

The primary screen title is `Connections`; `Interactions` remains only an internal compatibility route name while legacy re-entry paths migrate.

## Attention semantics

Attention indicators must correspond to work the user can understand:

- Chats use the authoritative unread-message count and cap display at `99+`.
- Activity uses a dot rather than an inflated numeric popularity count.
- Activity needs attention when there is an unread received interaction or a row with a direct relationship action such as Wave back, Accept or Follow back.
- Gifts, reactions, historical matches and passive notifications never become a numeric popularity badge.

Opening the Connections screen alone does not mark activity as read. A seen-through timestamp advances only when the user opens or acts on an activity row.

## Realtime contract

Socket events reconcile data only:

- `chat:message` refreshes conversations;
- inbox hooks refresh waves, gifts and request signals;
- `friend:accepted` refreshes relationship hints in chats.

Passive realtime arrivals do not trigger haptics from this screen. Direct mutations use the central `withNexaMutationFeedback()` boundary so success feedback happens only after the server accepts the action.

## Direct actions

- Wave -> **Wave back**
- Friend request -> **Accept / Decline**
- Follow -> **Follow back**
- Person presence -> **Map**
- Chat row -> open Chat

All direct action targets are at least 44dp high. Errors use privacy-safe product copy and do not expose API messages.

## Empty and error states

Connections stays map-first:

- empty Activity -> `Discover nearby`
- empty Chats -> `Discover people`
- empty/error recovery never implies profile or relationship data was deleted
- stale data stays visible with a compact retry banner when refresh fails

## Privacy and abuse safety

- Map lookup uses the existing privacy-filtered pin focusing contract.
- Failure copy says a person is not discoverable on the map right now; it never reveals exact coordinates or why visibility is unavailable.
- No new location, analytics, REST, Socket.IO or persistence contract is introduced.
- Blocking/reporting behavior remains owned by profile/chat safety surfaces.

## Acceptance criteria

- Header says `Connections`.
- Activity and Chats have distinct, stable hierarchy.
- Chat unread counts are authoritative and capped at `99+`.
- Activity does not expose vanity/popularity counts.
- Direct relationship mutations use truthful success/error feedback.
- Socket arrivals stay tactile-silent.
- Empty states route back toward map discovery.
- Existing backend and realtime contracts remain unchanged.

# NEXA Navigation & Tab Identity v2

## Product contract

The main navigation is map-first and fixed to five tabs:

1. **Map** — the primary product surface and nearby spatial context.
2. **Discover** — focused entry points into people, events and marketplace discovery.
3. **Pulse** — live local activity interpretation, not a generic social feed.
4. **Connections** — chats plus actionable relationship activity.
5. **You** — the signed-in user's identity, activity and settings entry points.

The old centered Create tab is removed from primary navigation. Creation stays contextual to the map through existing map create/FAB flows.

## Visual identity

- One icon family: MaterialCommunityIcons.
- Active tabs use a compact 38 x 30dp pill stage instead of changing icon size.
- Map / Discover / Pulse use the cyan discovery/live semantic tone.
- Connections / You use the violet action/identity tone.
- Labels are always visible; navigation does not depend on icon recognition alone.
- Tab targets remain at least 44dp wide.
- The tab bar hides while the keyboard is open.

## Badge policy

Badges are functional state, never engagement vanity:

- Map has no numeric novelty badge; spatial novelty remains on the map surface.
- Discover has no badge.
- Pulse has no generic engagement badge.
- Connections may show only unread chats + pending connection actions.
- You has no vanity/profile-completeness badge.
- Connections count caps at `99+`.

## Discover tab

Discover is deliberately a lightweight navigation hub. It does not create a second feed and does not duplicate discovery ranking.

Current lanes:

- Nearby people -> Map
- Local events -> Pulse / Events filter
- Marketplace -> Commerce / Marketplace
- People you may know -> Social / Suggestions

No new REST, Socket.IO, PostGIS, persistence or location-permission contract is introduced by the Discover tab.

## Re-entry semantics

`Interactions` remains a legacy logical destination for existing push/toast/map callers, but `openRootScreen(..., 'Interactions')` now re-enters the canonical `Main -> Connections` tab. This avoids a duplicate root interactions surface for normal re-entry while preserving compatibility with existing notification payloads and call sites.

The root `Interactions` route remains temporarily registered as a compatibility fallback for any direct navigation path that has not yet been migrated.

## Privacy and abuse constraints

- Discover does not request a fresh location or persist coordinates.
- Existing map/discovery privacy precision remains authoritative.
- No tab badge exposes popularity, profile score, follower count or nearby population.
- Push re-entry does not reveal additional lock-screen data.
- No navigation change bypasses block, verification or messaging permissions.

## Acceptance criteria

- Main tabs render in exactly `Map / Discover / Pulse / Connections / You` order.
- Each tab has a stable icon, text label and accessible label.
- Active state uses semantic NEXA tone and geometry.
- Connections badge equals actionable unread + pending relationship state only.
- Legacy `Interactions` re-entry resolves to `Main -> Connections`.
- Discover routes only to existing product surfaces and makes no new network/location request itself.
- Existing Map and Pulse route params remain source-compatible.
- No backend/shared API contract changes are required.

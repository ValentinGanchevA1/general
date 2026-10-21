# NEXA You / Profile Identity v2

`You` is the self-identity hub in NEXA. It is not a second discovery feed and it should not compete with the map.

## Product role

- **Map** is where nearby discovery and spatial presence happen.
- **Connections** is where relationships return.
- **You** is where the user understands and manages their identity, verification, presence and personal activity.

## Hierarchy

1. **You hero** — NEXA identity, avatar, display name and compact identity line.
2. **Identity signals** — verification state, relationship count and activity level shown as factual summaries.
3. **Identity** — profile content the user owns: photos and bio.
4. **Presence** — friends and map presence.
5. **Activity** — storyline and marketplace participation.
6. **Account** — premium/account-level destination.

## Semantic color ownership

- Violet owns self-actions and relationship management.
- Cyan owns verification and map/discovery presence.
- Premium gold is reserved for subscription identity.
- Neutral surfaces carry content and navigation hierarchy.

## Trust and privacy rules

- Verification is presented as completed signals, never as a vanity or popularity score.
- Social links are not framed as trust boosters.
- Map presence copy does not reveal exact coordinates or visibility reasons.
- Private map visibility remains explicit and does not imply the profile is hidden everywhere.
- No success state is shown before authoritative profile/verification data confirms it.

## Interaction rules

- Primary self-management action is **Edit profile**.
- Verification routes to Trust Center.
- Map presence returns to the canonical Map surface.
- Navigation rows remain at least 44dp high and expose useful accessibility labels.

## Acceptance criteria

- The visible screen identity is `You`, not a generic profile/settings page.
- The hero explains self identity without adding a social feed.
- Verification copy remains factual and score-free.
- Map presence is a first-class destination and respects privacy state.
- Flat miscellaneous rows are grouped into Identity, Presence, Activity and Account.
- Existing navigation, REST, Socket.IO and profile data contracts remain unchanged.
- Existing light, dark and PROTOS NEXUS themes continue to resolve through semantic tokens.

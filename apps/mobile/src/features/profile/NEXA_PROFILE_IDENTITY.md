# NEXA You / Profile Identity v3

`You` is the user's self-profile in NEXA. It should primarily answer **“How do I appear in my local world?”**, not behave like a second Settings screen.

## Product role

- **Map** owns nearby discovery and spatial presence.
- **Connections** owns relationships and returning conversations.
- **You** owns personal identity, interests, Purpose, content, trust and personal activity.
- **Settings** owns account/configuration management.

## Hierarchy

1. **Hero** — avatar, display name, age when enabled, verification, compact origin line.
2. **Summary** — factual trust signals, friends and level.
3. **About me** — inline bio plus derived/opted-in profile facts such as age, zodiac, origin and nationality.
4. **Interests & Purpose** — what the user likes and why they use NEXA.
5. **Photos** — personal visual identity.
6. **Activity** — own Storyline, marketplace participation and achievements.
7. **Connections** — friends and map presence.
8. **Trust** — verification signals and Trust Center entry.
9. **Account** — premium/account-level destinations.

## Interests vs Purpose

### Interests

Interests describe persistent affinities such as Football, Music, Reading, Cinema, Travel or Technology. They are normalized tags intended for shared-interest suggestions and later matching/ranking signals.

### Purpose

Purpose describes core intent: why the user is using NEXA. The user-facing term is **Purpose**, while persistence intentionally remains the existing `goals[]` field so current messaging and recommendation logic stays compatible.

Interests and Purpose must not be collapsed into one concept.

## Editing rules

- There is no large **Edit profile** CTA below the avatar.
- About me and Interests/Purpose expose small contextual edit affordances.
- Bio is rendered inline rather than as a navigation row that duplicates Edit Profile.
- Settings remains a separate cog/destination.

## Storyline rule

The self Profile must never navigate to `UserProfile` using the current user's id merely to focus Storyline. Own Storyline is rendered on the self surface (or may later move to a dedicated self-management screen). `UserProfileScreen` remains the visitor/public-profile surface.

## Trust and privacy rules

- Verification is presented as completed signals, never as a vanity/popularity score.
- Exact date of birth is owner-only; age and zodiac may be derived from it.
- Existing hometown fields are displayed as **From**, not falsely labelled as place of birth.
- Map presence copy never reveals exact coordinates.
- Private map visibility remains explicit and does not imply the profile is hidden everywhere.
- No success state is shown before authoritative profile/verification data confirms it.

## Semantic color ownership

- Violet owns self-actions and relationship management.
- Cyan owns verification and map/discovery presence.
- Premium gold is reserved for subscription identity.
- Neutral surfaces carry content and navigation hierarchy.

## Acceptance criteria

- The visible screen identity is `You`, not a generic profile/settings page.
- No duplicate Bio/Edit Profile navigation exists.
- Interests and Purpose are visible and editable as separate concepts.
- Own Storyline does not route through `UserProfile`.
- Verification remains factual and score-free.
- Map presence remains a first-class destination and respects privacy state.
- Existing `goals` REST/storage semantics remain compatible while the UI says Purpose.
- Existing light/dark themes continue to resolve through semantic tokens.

# NEXA Auth + Onboarding v5

## Product intent

Auth and first-run setup introduce NEXA as a map-first local discovery product, not as a generic social network.

The first-run sequence establishes two distinct matching signals:

- **Interests** — what the user likes and does; normalized tags used for shared-interest discovery.
- **Purpose** — the user's core reason for using NEXA. Purpose is persisted through the existing `goals` contract for backward compatibility.

## Auth screen

- horizontal outlined-vector NEXA wordmark with filled eye/iris and the tagline “a gateway to your local world.”
- uncluttered, theme-aware form; dark mode matches the approved dark/violet reference
- no discovery hero, panel border, welcome heading or sign-in subtitle on login
- email/password fields have leading icons; password visibility is an accessible 48dp control
- primary action uses canonical semantic theme tokens
- neutral Google sign-in treatment with the provider's multicolor mark
- create-account action follows Google sign-in
- email/password, registration, optional phone and Google auth contracts are unchanged
- safe-area-aware scroll layout preserves access with the keyboard and larger text
- separate Terms and Privacy links retain configured destinations
- “Forgot password?” uses the recovery workflow owned by Auth
- no location permission request is introduced during authentication

## Profile onboarding

The five user-facing setup steps are:

1. **Identity** — display name
2. **Interests** — choose at least 3 predefined normalized tags
3. **About you** — date of birth + optional origin visibility
4. **Purpose** — choose at least one core reason for using NEXA
5. **Map visibility** — Discoverable or Private browsing

### Interests

Interests are selected from the curated taxonomy in `features/profile/interestOptions.ts` rather than entered as arbitrary free text. Stable lowercase keys are persisted in `interests[]`; localized/user-facing labels are presentation data.

Examples include Football, Music, Reading, Cinema, Travel, Fitness, Technology, AI and Cybersecurity.

The minimum of three gives matching/suggestion systems a useful cold-start signal without asking for a long profile form.

### Purpose

Purpose replaces **Goals** as the user-facing term. It answers “Why are you here?” rather than “What do you like?”. Current values remain compatible with the existing backend contract:

- Meet people
- Local events
- Networking
- Explore area
- Activity partner
- Just chatting

Persistence intentionally remains `goals[]` because messaging and recommendation logic already consume it. Internal migration away from that field name is not required for Profile v3.

### Bio

Bio is no longer a mandatory first-run step. It is an optional **About me** field edited from the Profile surface after setup.

The current authentication state still derives `profileSetupComplete` from a non-null Bio, so onboarding writes an empty string as a temporary compatibility marker. This should be replaced in a later schema migration with an explicit onboarding-completed field.

### Age, zodiac and origin

Exact date of birth is owner-only. It may be used to derive age and zodiac, but the exact date is not shown publicly.

The existing hometown fields are presented as **From** rather than incorrectly claiming they represent place of birth.

### Visibility language

`public` is presented as **Discoverable**.

`private` is presented as **Private browsing**.

The UI does not expose a public numeric trust score and does not imply precise coordinate sharing.

## Accessibility

- primary/back controls use >= 44dp targets
- onboarding progress announces the current step
- interest, Purpose and visibility options expose selected state
- text remains the source of meaning; color is supplemental
- decorative spatial artwork is excluded from screen readers

## Theme contract

Touched auth/onboarding UI uses `useAppTheme().colors` semantic tokens.

`FormField` remains theme-aware so auth/onboarding fields stay consistent in dark and light modes.

## Brand surface contract

- `NexaSymbol`: compact eye/discovery core for launcher, notification, small navigation/system surfaces.
- `BrandLogo`: canonical eye + NEXA wordmark lockup.
- `NexaEntityOrbit`: expanded ecosystem composition for splash and large hero surfaces only.

## Non-goals

This change does not:

- modify authentication endpoints or token/session behavior
- add or change identity-verification requirements
- request location during auth/onboarding
- expose exact coordinates or exact date of birth
- rename internal `goals` storage before dependent matching/messaging code is migrated

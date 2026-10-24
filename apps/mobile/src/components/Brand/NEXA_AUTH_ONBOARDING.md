# NEXA Auth + Onboarding v3

## Product intent

Auth and first-run setup must introduce NEXA as a map-first local discovery product, not as a generic social network.

The sequence communicates:

1. local discovery
2. profile context
3. privacy control
4. discovery intent
5. map visibility

## Auth screen

- canonical NEXA lockup
- spatial discovery motif instead of stock/social artwork
- primary action uses violet (`actionPrimary`)
- discovery emphasis uses cyan (`discovery`)
- neutral Google sign-in treatment
- email/password, registration, optional phone and Google auth contracts are unchanged
- legal links remain unchanged
- no location permission request is introduced
- no map or previous-session location screenshot is shown behind auth

## Spatial discovery hero

`NexaDiscoveryHero` is decorative and contains no real user/location data.

It renders the reusable `NexaEntityOrbit`, which is the expanded NEXA ecosystem mark for hero-sized surfaces. The compact app identity remains `NexaSymbol`.

Canonical entity vocabulary:

- person: circle
- event: four-point star
- listing: square
- opportunity / other: diamond
- two elliptical discovery/action orbit paths around the final eye core

The same circle / star / square / diamond vocabulary is used by the animated launch composition and map marker system so first-run product identity does not switch visual languages after splash.

The component is intentionally non-interactive and hidden from the accessibility tree.

## Profile onboarding

The existing five-step data contract remains intact:

1. identity / display name
2. profile context / bio
3. age + optional origin visibility
4. discovery goals
5. map visibility

No profile API or persistence contract changes are part of this branding pass.

### Visibility language

`public` is presented as **Discoverable**.

`private` is presented as **Private browsing**.

The UI does not expose a public numeric trust score and does not imply precise coordinate sharing.

## Accessibility

- primary/back controls use >= 44dp targets
- onboarding progress announces the current step
- selectable goal and visibility options expose selected state
- text remains the source of meaning; color is supplemental
- decorative spatial artwork is excluded from screen readers

## Theme contract

Touched auth/onboarding UI uses `useAppTheme().colors` semantic tokens.

`FormField` is theme-aware so auth/onboarding fields remain consistent in dark and light modes.

## Brand surface contract

- `NexaSymbol`: compact eye/discovery core for launcher, notification, small navigation/system surfaces.
- `BrandLogo`: canonical eye + NEXA wordmark lockup.
- `NexaEntityOrbit`: expanded ecosystem composition for splash and large hero surfaces only.

## Non-goals

This change does not:

- modify authentication endpoints or token/session behavior
- add or change identity-verification requirements
- request location during auth/onboarding
- change discovery ranking
- expose exact coordinates
- rename internal `@g88/*`, native package IDs, storage keys or backend identifiers

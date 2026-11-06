# NEXA World Modes — Android / iOS device QA (pre-release)

Applies to stacked PRs [#1037](https://github.com/ValentinGanchevA1/general/pull/1037) (selector) and [#1042](https://github.com/ValentinGanchevA1/general/pull/1042) (decorative visuals).

## Release safety

- World Modes are gated by \`WORLD_MODES_ENABLED = __DEV__\`. **Release APK/AAB intentionally hides the selector and the visual overlays**. A successful release APK build does **not** constitute feature device QA.
- Do not turn on the feature in production, merge, or retarget #1042 to master until the parent has passed review and branch integration checks.
- World Modes are **decorative and local-only**. They never grant trust, subscription entitlements or access to other users' data; they cannot change privacy, map query kinds, selection, live events, chat, or location disclosure.
- Capture QA evidence only with test accounts and non-sensitive map data; redact locations/avatars/identifiers.

## Setup

1. Check out \`feat/nexa-world-modes-visual-integration\` from GitHub locally; it contains #1037 + #1042 changes.
2. Use the Node version in \`.nvmrc\`, then run \`pnpm install --frozen-lockfile\` and \`pnpm --filter @g88/shared build\`.
3. Configure the existing supported local or device backend environment. Do **not** commit \`.env\`, credentials or screenshots with user data.
4. For a connected Android device: enable USB debugging, verify \`adb devices\`, then start Metro with \`pnpm --filter @g88/mobile start\` and run \`pnpm --filter @g88/mobile android\` in a second terminal. This runs a development build with \`__DEV__ = true\`.
5. On macOS, use the project's existing React Native iOS toolchain and \`pnpm --filter @g88/mobile ios\` for iOS. A Linux host cannot perform physical iOS build QA.

## Functional acceptance (record Pass / Fail / N/A and evidence)

| ID | Procedure | Expected |
|---|---|---|
| WM-01 | Sign in, open Identity → Settings → Appearance → World Modes | 10 mode cards and four category filters, no unrequested permissions |
| WM-02 | Preview Nexus, Noir, Profiler, Pathfinder, Nocturne, Diplomat, Architect, Bazaar, Vanguard, Sanctuary | Each name, description, three highlights and decorative color appear; preview does not save |
| WM-03 | Select Pathfinder → Activate; return to Map / Discover / Identity | Visual accents reflect Pathfinder; navigation, labels and map content remain unchanged |
| WM-04 | Return to World Modes, activate Sanctuary, kill app and restart | Sanctuary loads from per-account local preference without first reopening Settings |
| WM-05 | Sign out, log into second test account | Default is Nexus or that account's own saved mode; previous account's preference never flashes |
| WM-06 | Log back into initial account | Its saved mode is restored; second account's preference is not shown |
| WM-07 | Turn on system Light appearance, then Dark | Light mode keeps established semantic theme. Dark mode shows selected World Mode accents |
| WM-08 | Open Trust, map, Connections, Subscription and check premium \`PROTOS NEXUS\` | Trust/premium permissions, verification badges, notification status and paywall behavior do not change |
| WM-09 | Focus map search while a World Mode is active | Search focus remains discovery-colored; theme accents affect only idle borders and neutral chrome |
| WM-10 | Perform a map lens switch and inspect nearby results | Mode selection never changes spatial lens or viewport query filters |
| WM-11 | Turn off network or force device storage error; tap Activate | Redux error shown; no false success state; previously selected mode retained |
| WM-12 | Open 10 mode cards with TalkBack / VoiceOver; increase OS font size | Labels convey selected/active state, controls remain reachable, 44dp targets, no important clipping |
| WM-13 | Enable Reduce Motion in OS settings | Mode selection remains fully usable; no mandatory animation or flashing |
| WM-14 | Build a release variant and inspect Settings | World Modes remain hidden and no world visual treatment is applied |

## Regression watchlist

- Existing five tabs **Map, Experiences, Opportunities, Connections, Identity** are still in the same order.
- Legacy Discover / Pulse / You routes and deep links still resolve.
- User pins, live Socket.IO activity, unseen counters, filters and map renderer remain unchanged.
- Verify close/reopen of Identity and Map without remount flicker, unexpected state reset, or navigation crashes.
- Android: low-memory app restoration and background→foreground while switching modes.
- iOS: safe areas, back gestures, VoiceOver, focus order.
- QA on a Huawei device may not have GMS; use supported email login if Google services are unavailable.

## Evidence and sign-off

Attach to each PR: device model, Android/iOS version, build commit SHA, QA table results, 2–3 redacted screenshots (selector, Map, Identity), and link to CI artifacts/logs. Mark blockers as blockers; do not infer passes from a green CI or a mockup.

Current status when authored: #1037 CI checks green on \`ea5bd841\`; #1042 is a stacked Draft whose pull_request workflows do not trigger against its feature-branch base. Device QA has **not** been completed.

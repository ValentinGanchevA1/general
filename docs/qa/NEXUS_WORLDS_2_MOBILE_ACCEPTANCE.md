# NEXUS Worlds 2.0 — Mobile acceptance and device QA

Current implementation: [PR #1147](https://github.com/ValentinGanchevA1/general/pull/1147)

## Release safety

- `WORLD_MODES_ENABLED = __DEV__`. Production APK/AAB keeps the selector and decorative World accents disabled.
- World selection is a local, account-scoped preference. It does not grant trust, identity verification, subscription entitlement, visibility or access.
- Early-version scope is disclosed in the selector: decorative accents and portal entry only; no ranking, visibility, permissions or access changes.
- World accents are dark-appearance-only until every palette is separately contrast-validated for light appearance.
- Keep semantic discovery/action, trust, verification, privacy, danger, success and premium colors unchanged.
- Do not capture or commit screenshots with real precise locations, private avatars, identifiers or tokens.

## First-run acceptance

| ID | Procedure | Expected |
|---|---|---|
| ONB-01 | Fresh email/password registration | Account is registered; only that account receives a first-run marker |
| ONB-02 | Complete Profile Creation | World Selection is the next screen |
| ONB-03 | Preview all 10 worlds | Preview changes only local screen state; no preference is saved |
| ONB-04 | Activate Sanctuary | Preference is written before the marker is removed; WorldSelection remains mounted through the Sanctuary portal, then Main replaces it |
| ONB-05 | Skip World Selection | NEXUS is selected; route remains mounted through its portal; Main replaces it afterwards |
| ONB-06 | Simulate AsyncStorage write failure during selection | No false saved state; user can continue with NEXUS for this session |
| ONB-06A | Simulate marker cleanup failure after World preference write | Selection succeeds in-session; marker remains and safely reoffers selector on later launch |
| ONB-07 | Sign into an existing account with no first-run marker | Goes directly to Main; no forced onboarding |
| ONB-08 | Two accounts on one device | Account B never sees account A's in-memory or persisted mode |
| ONB-09 | Force-close and relaunch after activation | Correct account's stored World is restored before decorative accents are applied |
| ONB-10 | Open Settings → Appearance → World Modes | Existing account can preview and switch Worlds |

## Visual integration acceptance

| ID | Procedure | Expected |
|---|---|---|
| VIS-01 | Select a World in dark appearance | Active tab halo and indicator use that World's decorative accent |
| VIS-02 | Inspect Map search while focused | Search focus remains the semantic discovery color |
| VIS-03 | Inspect idle Map search and locate control | World accent may tint only the neutral border |
| VIS-04 | Inspect Trending card | Only card border receives World accent |
| VIS-05 | Open Discover | Hero border/glyph/eyebrow reflect active World; discovery actions retain their semantic colors |
| VIS-06 | Open Identity | Hero glow/eyebrow and World chip reflect active World |
| VIS-07 | Change World from Identity chip | Opens the same World Modes account route |
| VIS-08 | Switch device to light appearance | World accents fall back to the established light theme |
| VIS-09 | Switch accounts during app use | Previous account's World accent disappears until new account hydration completes |
| VIS-10 | Inspect trust, verification, privacy, danger and premium states | No World palette overrides semantic state or PROTOS NEXUS entitlement |

## Accessibility and regression

- TalkBack/VoiceOver announces World card name, subtitle, selected/active state and activation/skip actions.
- After activation or Skip, the portal label matches the persisted World; the route to Main occurs once only after the transition.
- With Reduce Motion enabled, the portal expansion is skipped and navigation continues immediately; no splash/launch timing token is changed.
- Portal motion preference lookup defaults to reduced motion on timeout/error and does not alter cold-start motion telemetry.
- Text scaling does not clip the 2-column selector or footer actions.
- Touch targets remain at least 44 dp/pt.
- Reduce Motion leaves selection fully usable; decorative World accents do not require motion.
- The five visible tabs remain Map, Experiences, Opportunities, Connections and Identity.
- Experiences and Opportunities remain lenses on the existing single Map instance.
- No new viewport query, map remount, location permission, API, database table or Socket.IO event is introduced.
- Existing deep links and legacy route redirects remain intact.

## Splash / portal acceptance — tracked separately

The existing Radiant Eye launch is retained. Do not alter animation timings from subjective review alone. Complete [issue #669](https://github.com/ValentinGanchevA1/general/issues/669) on a physical Android device before changing splash choreography.

- 10 cold starts with full motion and 5 with Android Reduce Motion.
- Validate native frame/no flash, ray → eye → orbit → entity → NEXUS composition.
- Exercise location permission granted, denied and never requested.
- Exercise cold/warm map readiness, app background/resume during entrance and spatial handoff.
- Record Sentry launch segments and p50/p95 before tuning animation constants.

## Evidence required before merge

- CI: mobile lint, typecheck, Jest, backend checks, CodeQL, Semgrep and Android Release APK.
- Android physical-device record: device/OS/build SHA and pass/fail per applicable row.
- iOS simulator/device record when available.
- Redacted selector, Map, Discover and Identity screenshots.
- Explicit product review of world labels and visual treatment.

A green CI or a successful Release APK build alone is not physical-device QA.

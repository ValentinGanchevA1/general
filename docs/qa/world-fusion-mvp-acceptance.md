# NEXA Worlds 2.0 — FUSION-02 mobile QA

This is a **DEV-only** UX slice stacked on FUSION-01 (#1057) and the
World Mode Selector (#1037). It is **not** a production-ready discovery filter
or a new map implementation.

## User flow

1. Open **Identity → Settings → World Modes** in a development build.
2. Confirm the active World (World A). Tap **Explore World Fusion**.
3. Preview another World (World B); no preference save should occur.
4. Confirm the **Apply Fusion** action. After a successful account-scoped
   storage write, a saved World pair appears.
5. Tap **Remove Fusion**. The secondary World disappears, while World A
   remains active.
6. Close and reopen Fusion. Verify account-scoped persisted World B.
7. Log out and sign in with another account. No previous account's preference
   should be displayed.

## Required edge cases

| Case | Expected behavior |
| --- | --- |
| No saved Fusion | Shows World A + choose World B; no automatic selection |
| Same World A and B | The same-World pair resolves to a single World |
| Preview without Apply | No AsyncStorage write, map camera or API mutation |
| Apply with valid World B | Only the per-account secondary World is stored |
| Remove Fusion | Writes `discoveryWorld: null`; keeps World A |
| Repeated Apply while save is pending | Second write blocked; no double commit |
| Storage rejected | Error visible in Redux, no false success |
| Switch account during hydration | Ignore previous account's pending response |
| Switch account during save | Ignore the old account's pending response in UI |
| Unsupported World discovery | Honest “not implemented” message |
| Existing map lens/custom filters | Never overwritten or navigated from Preview/Apply |
| Screen readers and font scaling | 44+ dp option controls; button semantics and selection states |
| Dark/light theme | Main CTAs use semantic accessible action colors, not decorative hues |
| Production APK | World Modes and Fusion remain unavailable behind `__DEV__` |

## How to test DEV-only UI

Test a **debug build connected to Metro** rather than a release APK. In a
release bundle `__DEV__` is false. Android debug device and iOS simulator/
device flows should each be tested. On Android, use `adb reverse tcp:8081
tcp:8081` if USB-connected and ensure development API connectivity. A
Huawei device without Google Play Services may have a separate native
Google Maps dependency issue; distinguish that from World Fusion UI QA.

## FUSION-03 — Explicit existing-map lens shortcut

The shortcut appears only after a **saved Fusion** with a real supported
discovery hint: Nocturne or Architect → Experiences, Bazaar → Opportunities.
A World B preview is not enough to enable it.

1. Open Map once. Verify its filters remain at defaults and the current lens
   is Map. Open Settings → World Modes → World Fusion.
2. Select Nocturne, tap **Apply Fusion**, then separately tap **Open Experiences lens**.
   Verify the single existing Map surface shows events. No second map mounts.
3. With Bazaar saved, verify the shortcut is **Open Opportunities lens**,
   showing listings on the same Map surface.
4. Enter custom layers, search text, Friends/Dating-only, listing-mode,
   sort, marketplace-kind, *disable public Places* (public Places is ON by
   default) or *enable saved Places* (OFF by default); re-enter Fusion.
   The shortcut must be disabled with a clear explanation. No filters cleared.
   A fresh default map with public Places ON must **not** be blocked.
5. With an active Experiences or Opportunities tab lens, the Fusion shortcut is
   disabled, even if World B suggests another lens.
6. With MapScreen never loaded, unmounted or unverified, the shortcut is
   disabled (fail closed); no stale guess that filters are at defaults.
7. Verify the shortcut does not appear for unsaved previews, removed Fusion,
   unsupported World B, storage failure or while another save is pending.
8. Return from Account to Map. The camera and zoom must remain unchanged.
   No forced GPS recenter, permissions prompt, profile exposure or RSVP.
9. Validate the shortcut on a small Android debug build with TalkBack, large
   font and reduced motion; test VoiceOver and Dynamic Type on iOS.

This opt-in shortcut calls the existing session-only spatial lens store
and navigates to the canonical Main → Map tab. It does not add new REST
endpoints, PostGIS requests beyond the Map's normal lens query, or map
instances. The manual-filter store contains only a boolean summary, never
search strings, user IDs, precise coordinates or private filter values.

**Non-goal:** automatic application on World Fusion Save or app startup.

## Product gate

World Fusion in FUSION-02 stores secondary discovery intent only. The selected
World **does not** change the active spatial lens, backend permissions,
location visibility, social graph or authentication. Explicit opt-in lens
integration (FUSION-03) requires existing-map filter precedence and separate
tests. World Passport is deferred.

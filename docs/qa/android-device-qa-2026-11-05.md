# Android physical-device QA — screen-recording review (2026-11-05)

## Evidence and scope

- Source: user-supplied local `SVID_20261105_025450_1.mp4`, duration **315.49 seconds** (5:15), portrait **574 × 1280** screen capture.
- User describes the installed app as the most recent GitHub Android Build APK. **Exact run ID, APK SHA-256, commit embedded in the APK, Android OS version and device model are not independently available from the video.** Do not assert APK/source parity or close release gate #580 on that basis.
- The recording includes real account/profile material; **do not commit the media, screenshots or personally identifying values** to the repository.
- Source-of-truth for current mobile IA: `apps/mobile/src/navigation/AppNavigator.tsx`, `apps/mobile/src/navigation/nexaTabIdentity.ts`, `docs/IA_NAVIGATION.md` (navigation v3, 2026-11-04).
- Historical RC3 QA #580 and other release documents still describe the previous `Map / Discover / Pulse / Connections / You` layout. Those historical checks cannot be used unchanged to reject the v3 APK.

## Observations

| Video time | Use case | Observation | Assessment |
|---|---|---|---|
| 00:00–00:20 | Map onboarding, zoom / discovery | NEXA Map with clustered nearby results and recovery/zoom UI remains visible; onboarding overlay appears | **Partial:** first launch/auth path and reduced-motion not captured |
| 00:20–00:44 | Connections, Settings, Blocked, Trust | Connections Activity and Settings reachable; blocked-user empty state; email/phone/ID status displayed individually | **Observed:** no proof of backend verification correctness or TalkBack |
| 00:45–01:15 | Social linking external flow | External Instagram consent/browser flow opens and user returns to app | **Partial:** do not infer server-side link success from navigation alone |
| 01:15–01:40 | Profile editing, visibility | Profile fields, interest chips and public/private controls render; Settings re-entry visible | **Partial:** saving/persistence across new session and public-profile visibility not proven |
| 01:40–02:50 | Notifications, Settings, Help, About | Notification preferences, Help/FAQ, support and NEXA About reachable | **Copy bug:** Help FAQ still says `You → My map presence`, which is not the current visible v3 path |
| 02:55–03:35 | Map pan/zoom, clusters, empty states, listing/profile | Map is navigable; map empty state appears, listing detail and person profile reachable | **Partial:** specific event marker, hit target size, snap positions unverified |
| 03:55–04:30 | Repeated Map discovery and filter use | Compact `Nearby signal interrupted / Showing the last nearby view` banner with `Retry discovery`; map stays interactive | **Degraded:** nonblocking behavior aligns with #963; trigger, failing lane, transport status and successful recovery unproven without diagnostics |
| 04:35–04:55 | Connections / chats / groups | Chats list, group entry/composer and direct conversation accessible; messages visible | **Partial:** group creation round trip, unread/read receipts, Socket.IO delivery and permission checks need two-client test |
| 05:00–05:13 | Map person pin / entity sheet | Person sheet appears on Map and map remains available after dismissal | **Partial:** repeat with fresh cluster tap, slow profile fetch and 38%/68% snaps |

## Findings and disposition

1. **P2 — confirmed user-facing stale Help route.** FAQ directs users to old `You → My map presence`; runtime Settings row is `Identity → Settings → Appear on map`. Fix copy and add a Jest copy guard.
2. **P2 — outdated Android QA/store copy.** `docs/PLAY_CLOSED_TESTING.md`, `docs/play-store-listing.md`, `PRODUCT.md` refer to historical tabs. Align v3 mobile information while preserving the browser v1 distinction and historical RC3 evidence.
3. **P2 to investigate — interrupted nearby discovery.** The *fallback itself* is expected after #963; repeated degraded discovery should be correlated with the discovery/place lane, safe error class, HTTP status, backend throttle and request IDs before making transport or map data changes. Do not infer a 429/5xx or force a speculative client fix from video alone. Related performance issue: #992.
4. **P1 production blocker (pre-existing) — #592.** Terms of Service still points to Privacy URL. Do not synthesize legal content or treat this video as legal sign-off.
5. **Unverified:** launch-to-auth, underage DOB rejection, offline + permission-denied, Android light/system/PROTOS themes, TalkBack/enlarged fonts, 44dp, reduced motion, backend parity, verified privacy controls and cross-client realtime.

## Next physical-device QA run

1. Attach **APK SHA-256 + Android Build run + git commit + device/Android version** and validate it matches the tested binary.
2. Follow `docs/IA_NAVIGATION.md` v3 matrix: Map → Experiences → Opportunities → Map **preserves the same viewport/camera**; lenses apply exactly once, do not introduce a second map; hidden legacy deep links still work.
3. Reproduce the map interruption with timestamped privacy-safe diagnostics for **both** discovery and places lanes; record retry success/failure, error class, rate-limit headers (when present) and active viewport without uploading exact GPS or user tokens.
4. Validate Identity → Settings → Appear on map, Help path, verification status, native launch, themes, reduced motion and TalkBack. Recheck Terms only after #592 publishes a separately reviewed document.
5. Keep #580 open until exact-build evidence and all release gates are complete. This recording alone is **not production sign-off**.

## Code change scope

Navigation, backend, identity policy and map error logic are **not changed** by this QA copy fix. CI/Jest must pass on the PR before merge.

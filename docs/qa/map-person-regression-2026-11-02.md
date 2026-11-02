# Android person-map regression — 2026-11-02

Evidence source: physical Android recording `SVID_20261102_170507_1.mp4` against RC4 (`0f372bc02487aa7fb7f19da6147bb4ebd5b66d97`).

## Reproduced

1. `View Full Profile` from the map person sheet dismisses the sheet but does not present `UserProfile`.
2. With the People layer active, Nearby People rail renders the user's avatar while the corresponding map person marker remains the generic/fallback circle.
3. RC4's transient discovery presentation is non-blocking: the recording ends with compact `Discovery temporarily unavailable` + Retry while the map remains interactive. This is expected post-#967 behavior and is separate from the two person UX regressions above.

## Code findings

### Full profile handoff

`MapScreen.onSheetOpenFull` transitions the pin machine to `fullProfile`, dismisses the entity sheet, then calls `navigation.navigate('UserProfile', ...)` from the Map tab context. The physical recording shows the dismiss occurring without a visible root `UserProfile` transition.

Required fix: route the handoff through the root navigation boundary while preserving the pin-machine full-profile/back-to-sheet contract and focus params.

### Avatar marker paint

Discovery data is not the problem: the same viewport data renders a real avatar in `NearbyPeopleRail`.

`MapScreen` already warms discovery media through `prefetchAvatars`, which resolves remote avatar media into the app's local avatar cache. `MapMarkers`, however, ignores that cache and resets `personAvatarUri` to `null`, then waits for a second `Image.prefetch(remoteUrl)` before allowing the marker image to paint. On Android custom `react-native-maps` markers, the native snapshot can settle on the fallback before the remote image paint is captured.

Required fix: let person markers use the candidate avatar immediately and upgrade to the resolved local cache URI asynchronously; keep initials only for blank/broken media. Do not reintroduce compact-density avatar suppression.

## Acceptance

- Person sheet → `View Full Profile` opens the correct `UserProfile` deterministically.
- Back from full profile restores the same person/map context.
- People pins with a non-blank discovery `avatarUrl` render avatar media at standard and compact density.
- Marker avatar uses the local cache URI when available, without avatar → fallback churn.
- Blank/broken avatar safely falls back to initials.
- Existing selected/live/verified/own marker states remain intact.
- Android device QA covers direct person pin → sheet → full profile → back and compact↔standard avatar stability.

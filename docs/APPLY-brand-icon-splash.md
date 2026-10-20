# Brand: NEXA splash handoff

## Status (NEXA Visual System v2)

- Android native launch uses `react-native-bootsplash` with `BootTheme`.
- Native splash background is `#08090D` and uses the NEXA v2 horizon/portal symbol.
- React Native mounts `NexaLaunchOverlay` above navigation, then performs the short handoff: wordmark dissolve -> single cyan discovery pulse -> application reveal.
- The splash waits only for boot-time auth/session restoration; map entities, Socket.IO, location acquisition, push refresh, and other non-critical services continue after the app becomes interactive.
- Reduced Motion uses a short crossfade and skips the discovery pulse/scale motion.
- The legacy G88 launcher/auth artwork remains separate until the wider NEXA brand migration is approved.

## Verify

1. Rebuild Android so `BootTheme` and the vector splash asset are packaged.
2. Cold boot while logged out: native NEXA symbol -> runtime NEXA wordmark -> pulse -> Auth.
3. Cold boot while logged in: native NEXA symbol -> runtime NEXA wordmark -> pulse -> Map/Main.
4. Confirm no white/dark blank frame appears between native and React Native surfaces.
5. Enable Android "Remove animations" / system reduced motion and confirm the runtime handoff becomes a short crossfade.
6. Background/resume the app and confirm the branded runtime sequence does not replay while the process remains alive.

## iOS

The repository currently does not track an Xcode application project/LaunchScreen storyboard under `apps/mobile/ios`; only the shared runtime overlay is active there. When the iOS project is restored/added, initialize `react-native-bootsplash` from the app delegate and generate the same `#08090D` + NEXA symbol native launch frame before release.

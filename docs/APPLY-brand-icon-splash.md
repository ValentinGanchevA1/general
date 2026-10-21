# Brand: NEXA splash handoff

## Status (NEXA Visual System v3)

- The final NEXA launch mark is the eye/discovery core surrounded by the entity orbit: circle, star, square, and location pin.
- Android native launch still uses `react-native-bootsplash`, but the native frame is intentionally only the `#08090D` canvas. The complete symbol is no longer shown instantly before React Native motion starts.
- React Native mounts `NexaLaunchOverlay` above navigation and performs the v3 sequence: dark canvas -> light-ray ignition -> eye core reveal -> orbit refill -> entity glyph resolve -> NEXA wordmark fade-in -> application dissolve.
- The reusable `NexaSymbol` is the eye/discovery core. Orbiting entity glyphs belong to the launch/ecosystem composition rather than every small brand placement.
- The splash waits only for boot-time auth/session restoration. Map entities, Socket.IO, location acquisition, push refresh, and other non-critical services continue after the app becomes interactive.
- Reduced Motion replaces orbit/ray motion with a short crossfade while preserving the final NEXA composition.
- No additional animation dependency is required; the sequence uses React Native `Animated` plus the existing `react-native-linear-gradient` package.

## Animation intent

1. Native launch displays a seamless dark canvas only.
2. Three short violet/cyan/white light rays streak through the optical center.
3. The eye core scales and fades in while a brief violet-white ignition halo blooms behind it.
4. Two elliptical orbit lines refill/resolve around the eye while the orbit settles through a small rotation.
5. Circle, star, square, and pin entity markers resolve together around the orbit.
6. A bright streak sweeps across the orbit to finish the refill effect.
7. `NEXA` fades upward into place after the symbol has become readable.
8. Once boot-time auth restore is complete, the wordmark and orbit dissolve first, then the eye and dark backdrop reveal the already-mounted app.

## Verify

1. Rebuild Android so `BootTheme` and `bootsplash_blank.xml` are packaged.
2. Cold boot while logged out: dark native frame -> animated NEXA orbital mark -> wordmark -> Auth.
3. Cold boot while logged in: dark native frame -> animated NEXA orbital mark -> wordmark -> Map/Main.
4. Confirm there is no fully-formed static NEXA symbol before the animation starts and no white frame between native and React Native surfaces.
5. Confirm the four orbit entities are legible on small Android devices without clipping: circle, star, square, pin.
6. Enable Android "Remove animations" / system Reduced Motion and confirm the handoff becomes a short crossfade with no streak/orbit motion.
7. Test both a fast session restore and an intentionally slow session restore. The entrance animation should complete once and hold cleanly until `ready=true`.
8. Background/resume the app and confirm the branded runtime sequence does not replay while the process remains alive.

## iOS

The repository currently does not track an Xcode application project/LaunchScreen storyboard under `apps/mobile/ios`; only the shared runtime overlay is active there. When the iOS project is restored/added, initialize `react-native-bootsplash` from the app delegate and use the same `#08090D` blank native frame so the animated NEXA v3 composition remains the first visible brand reveal.

# Brand: NEXA splash handoff

## Status (NEXA Visual System v4)

- The final NEXA launch mark is the eye/discovery core surrounded by the entity orbit: circle, star, square, and location pin.
- Android native launch still uses `react-native-bootsplash`, but the native frame is intentionally only the `#08090D` canvas. The complete symbol is no longer shown instantly before React Native motion starts.
- React Native mounts `NexaLaunchOverlay` above navigation and performs the existing motion sequence: dark canvas -> simultaneous light-ray ignition -> eye core reveal -> orbit refill -> entity glyph resolve -> NEXA wordmark fade-in -> application dissolve.
- Visual System v4 refines the reusable `NexaSymbol`: a shallower upper lid, iris and pupil aligned to one optical center, and a restrained split lower lid make the mark read immediately as an eye rather than an antenna/broadcast glyph.
- Orbiting entity glyphs remain launch/ecosystem composition; they do not become part of every small brand placement.
- The splash waits only for boot-time auth/session restoration. Map entities, Socket.IO, location acquisition, push refresh, and other non-critical services continue after the app becomes interactive.
- Reduced Motion replaces orbit/ray motion with a short crossfade while preserving the final NEXA composition.
- No additional animation dependency is required; the sequence uses React Native `Animated` plus the existing `react-native-linear-gradient` package.

## Animation intent

1. Native launch displays a seamless dark canvas only.
2. Three short violet/cyan/white light rays refill simultaneously through the optical center.
3. The eye core scales and fades in while a brief violet-white ignition halo blooms behind it.
4. The refined eye resolves around a shared iris/pupil optical center; the lower lid stays visually secondary to the luminous core.
5. Two elliptical orbit lines refill/resolve around the eye while the orbit settles through a small rotation.
6. Circle, star, square, and pin entity markers resolve together around the orbit.
7. A bright streak sweeps across the orbit to finish the refill effect.
8. `NEXA` fades upward into place only after the symbol has become readable.
9. Once boot-time auth restore is complete, the wordmark and orbit dissolve first, then the eye and dark backdrop reveal the already-mounted app.

## Verify

1. Rebuild Android so `BootTheme` and `bootsplash_blank.xml` are packaged.
2. Cold boot while logged out: dark native frame -> simultaneous ray ignition -> animated NEXA eye/orbit -> wordmark -> Auth.
3. Cold boot while logged in: dark native frame -> simultaneous ray ignition -> animated NEXA eye/orbit -> wordmark -> Map/Main.
4. Confirm there is no fully-formed static NEXA symbol before the animation starts and no white frame between native and React Native surfaces.
5. Confirm the symbol reads as an eye at both launch size (`146`) and compact reusable sizes: upper lid + centered iris/pupil + subtle lower lid.
6. Confirm the four orbit entities are legible on small Android devices without clipping: circle, star, square, pin.
7. Enable Android "Remove animations" / system Reduced Motion and confirm the handoff becomes a short crossfade with no streak/orbit motion.
8. Test both a fast session restore and an intentionally slow session restore. The entrance animation should complete once and hold cleanly until `ready=true`.
9. Background/resume the app and confirm the branded runtime sequence does not replay while the process remains alive.

## iOS

The repository currently does not track an Xcode application project/LaunchScreen storyboard under `apps/mobile/ios`; only the shared runtime overlay is active there. When the iOS project is restored/added, initialize `react-native-bootsplash` from the app delegate and use the same `#08090D` blank native frame so the animated NEXA v4 composition remains the first visible brand reveal.

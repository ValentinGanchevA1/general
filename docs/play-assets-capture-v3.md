# NEXA — genuine Google Play assets capture plan (Android navigation v3)

**Do not generate fake in-app UI screenshots.** Capture genuine screens of an exact, QA-approved Android release candidate. A static marketing poster is not a substitute for a Play screenshot. Current navigation source: `docs/IA_NAVIGATION.md` (2026-11-04), not the frozen older RC3 screenshot references in issue #616.

## Files / image specification

| Deliverable | Format | Acceptance |
|---|---|---|
| Store icon `nexa-play-icon-512.png` | 512x512, 32-bit PNG with alpha, <=1024 KB | Match current NEXA launcher eye geometry, no legacy G88 UI |
| Feature graphic `nexa-play-feature-1024x500.png` | 1024x500, 24-bit PNG no alpha (or JPEG) | Premium graphite / violet / cyan spatial identity, restrained branding, no fake app screens |
| Phone captures `nexa-v3-01-map.png` ... `06-identity.png` | Valid portrait JPEG/PNG (recommended 1080x1920; verify Play accepted range) | Minimum 2, target 5-6; all captured from the *same* release candidate |
| Release proof `nexa-v3-capture-manifest.md` | Markdown | Build SHA, versionCode, device+Android, date, screenshot paths, privacy review, QA issue evidence |

## Suggested sequence / truthful visible captions

1. **Map** — actual live home map, person circles, event stars, listing squares (use non-sensitive test content).
2. **Experiences** — events lens selected on the *same* Map; no duplicate map claim.
3. **Opportunities** — listings lens selected on the same Map.
4. **Selected entity** — real event/listing/person sheet from that candidate; no private user data.
5. **Connections** — real Activity/Chats surface, test accounts and redacted content.
6. **Identity** — self-profile / trust management; avoid ID/selfie, phone/email, unsupported scoring claims.

**Required review:** no private conversations, real photos without consent, full phone/email, exact coordinates, ID verification uploads, auth tokens, debug overlays, raw server errors, obsolete Map/Discover/Pulse/Connections/You navigation or legacy G88 product label. Test dark/light appearance and Android 1.3x font scale. Add optional marketing captions **outside** the actual captured application area only if they are truthful and comply with Play rules.

## Capture procedure

1. Freeze a specific commit + uploadable `.aab`; install Play-signed build (or a production-equivalent APK with signed-build traceability) on a real Android device.
2. Create disposable test identities, safe sample map content and event/listing records; no personal data.
3. Run `docs/IA_NAVIGATION.md` regression and issue #580 physical QA; do not capture a broken candidate.
4. Take screenshots on device; preserve unedited originals, then compose optional annotated store versions without falsifying UI.
5. Use an image tool to resize/crop from verified originals and output required store dimensions; do not stretch the UI.
6. Record screenshots + exact SHA and QA evidence in capture manifest and review before Play Console upload.

**Blocked until:** the approved v3 build and real device capture evidence are available. Old RC3 screenshots can be historical comparison only.

Official rules: https://support.google.com/googleplay/android-developer/answer/9866151

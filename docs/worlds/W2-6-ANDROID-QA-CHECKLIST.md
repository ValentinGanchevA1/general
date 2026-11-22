# Worlds W2-6 — UX, performance and Android QA checklist

## Test environment
- Device: Huawei Nova 11 (record OS/build, app version and commit)
- Account: test accounts only; never use production private data
- Network: normal Wi-Fi, then throttled/interrupted connection
- Record each step as Pass / Fail / Not tested and include privacy-safe evidence

## Functional checks
- [ ] First-run World choice can be skipped and recovered through Settings.
- [ ] World selection persists only in the intended account scope.
- [ ] Map selector changes presentation context only.
- [ ] Switch Map → Experiences → Opportunities → Map without duplicate navigation or map instances.
- [ ] Viewport/camera and user filters remain stable unless user changes them.
- [ ] Spatial context suggestions are optional and do not auto-apply.
- [ ] Discovery presets are suggestions only; they do not mutate requests or permissions.
- [ ] Contextual actions are affordances only; authoritative feature flow revalidates eligibility and access.
- [ ] World disabled/unknown/preview state is handled safely and does not grant capability.

## Privacy and abuse regression
- [ ] Global map visibility settings behave identically across Worlds.
- [ ] Blocked users remain excluded across World switches and refreshes.
- [ ] No World choice initiates live location sharing.
- [ ] No exact GPS or access tokens appear in screenshots, logs or analytics.
- [ ] Report/block controls remain accessible and work across context changes.
- [ ] Existing server-side age eligibility, moderation and rate limits remain effective.

## Performance and accessibility
- [ ] Rapidly switch World selector 10 times; no crash, state leak or duplicate query.
- [ ] Pan/zoom for 60 seconds; observe request rate, marker churn and UI responsiveness.
- [ ] Open/close sheets and selector; no accidental camera or filter changes.
- [ ] TalkBack announces selector, selected World and modal actions.
- [ ] Reduce Motion setting respected.
- [ ] Contrast and tap targets verified on device.

## Release decision
- Automated checks alone do not close physical-device QA.
- Any privacy/access regression blocks release and is triaged before merge.
- Attach only redacted, privacy-safe screenshots/logs.

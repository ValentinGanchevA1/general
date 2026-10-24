# NEXA — Closed Testing Release Notes

> For the Closed testing release of `com.g88`. The package/application ID is
> intentionally retained for Android update continuity; the public product name
> is **NEXA**. Paste section 1 into Play Console release notes and use section 2
> for tester onboarding.

---

## 1. Play Console release notes (`<en-US>`, ≤ 500 chars)

```
Welcome to the NEXA closed beta.

• Map-first nearby discovery
• Waves, Connections and 1:1 chat
• Local events and marketplace listings
• Identity verification and privacy-aware map presence

Your exact location is never shown to other users; NEXA coarsens map presence before it is stored or displayed.

Please report bugs, crashes, confusing flows, or visual issues. Thanks for testing!
```

### Shorter variant

```
NEXA closed beta: map-first nearby discovery, waves, Connections, chat, events and marketplace. Map presence is privacy-coarsened and exact location is never shown to other users. Please report bugs or confusing flows — thanks for testing!
```

---

## 2. Tester opt-in email / onboarding

```
You're in the NEXA closed beta — thanks for helping us test.

WHAT NEXA IS
NEXA is a map-first way to discover people, local activity, events and listings
around you. Open the app, explore nearby activity, wave, connect and chat.

HOW TO JOIN
1. Open the Play testing opt-in link with the Google account registered as a tester.
2. Accept the test, then install/update NEXA from the Play Store.
3. Open NEXA, create your profile, and allow location only when prompted for nearby discovery.

WHAT TO TRY
• Launch flow: native splash → NEXA animation → live app
• Map discovery, marker selection and entity sheets
• Discover and Pulse
• Connections → Activity / Chats
• Profile / You and Trust Center
• Events and marketplace listings
• Light, dark, system and PROTOS NEXUS themes when available
• Reduced Motion and larger text if your device supports them

PRIVACY
Other users never receive your exact location. NEXA uses your location for
nearby discovery and stores/displays privacy-coarsened map presence rather than
your precise position.

KNOWN LIMITATIONS
• Beta data may be reset between builds
• Some non-core features are still being polished
• Closed-testing UX and visual QA is still in progress

ACCOUNT CONTROL
Account deletion is available in-app from Settings → Delete account.

HOW TO REPORT ISSUES
Reply to this email (or ⟨bug-report channel/link⟩) with what you did, what
happened, what you expected, device model / Android version, and a screenshot or
screen recording when useful. Crashes are captured automatically, but tester
context is still valuable.

Thanks for testing,
The NEXA team
```

---

## 3. Notes

- Keep release notes truthful per build; update the known-limitations section as
  fixes land.
- If localization is added later, create explicit `<xx-XX>` blocks; en-US remains
  the baseline.
- Keep privacy wording aligned with `ARCHITECTURE.md §3.3`, the hosted privacy
  policy, and `docs/play-store-listing.md`.
- Do not rename `com.g88` as part of store-copy cleanup; native package migration
  is a separate compatibility project.

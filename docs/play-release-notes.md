# G88 — Closed Testing Release Notes (first build)

> For the first Closed testing release of `com.g88`. Paste section 1 into the
> Play Console "Release notes" field. Use section 2 in the tester opt-in email.
> Play limit: release notes ≤ 500 chars per language.

---

## 1. Play Console release notes (`<en-US>`, ≤ 500 chars)

```
Welcome to the G88 closed beta! This is our first test build.

• Live map — see who's nearby in real time
• Wave & chat — say hi and start a conversation
• Profiles, events, listings, gifts & challenges

Your exact location is never shared — we coarsen it to ~120m before anyone sees you.

Please report bugs, crashes, and anything confusing. Thanks for testing!
```
*(~360 chars — within limit.)*

### Shorter variant (if you prefer one-liners)
```
First G88 closed beta. Live nearby-people map, waves, chat, profiles, events & more. Location is coarsened to ~120m for privacy. Please report any bugs or crashes — thanks for testing!
```

---

## 2. Tester opt-in email / onboarding (longer — not for the notes field)

```
You're in the G88 closed beta — thanks for helping us test!

WHAT G88 IS
A map-first way to see who's around you. Open the app and nearby people appear
as live avatars. Wave, chat, and discover local events and listings.

HOW TO JOIN
1. Tap the opt-in link we sent (use the same Google account you gave us).
2. Accept the test, then install/update G88 from the Play Store.
3. Open the app, create your profile, and allow location when asked.

WHAT TO TRY
• Let the map load and check nearby people show up
• Send a wave, then start a chat
• Set up your profile + a photo
• Browse events / listings / challenges

PRIVACY
Your precise GPS never leaves your control in a usable form — we coarsen every
location to about a 120-meter area before anyone else can see it.

KNOWN LIMITATIONS (this build)
• Beta data may be reset between builds
• Some P3 features are still being polished
• Account self-deletion isn't in the app yet — email us to delete your data

HOW TO REPORT ISSUES
Reply to this email (or ⟨bug-report channel/link⟩) with: what you did, what
happened, what you expected, and a screenshot if you can. Crashes are captured
automatically, but your notes help a lot.

Thanks for testing,
The G88 team
```

---

## 3. Notes
- Keep release notes truthful per build — update the "KNOWN LIMITATIONS" list as
  fixes land.
- If you localize later, add `<xx-XX>` blocks; en-US is required.
- The privacy line mirrors `ARCHITECTURE.md §3.3` (H3 r10 ~120m fuzzing) — keep
  it consistent with the store listing + Data Safety copy in
  `docs/play-store-listing.md`.

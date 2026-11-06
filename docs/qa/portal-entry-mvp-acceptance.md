# PORTAL-03 — Event Entry device QA

Feature is development-only and stacked on PORTAL-02 (#1046). Open an event
marker on the existing Map; select **Explore Portal**; verify that the existing
EventDetail route shows the Portal banner while a normal EventDetail deep link
still uses its original presentation.

## Required scenarios

| Scenario | Expected result |
| --- | --- |
| Upcoming public event | Status Upcoming; RSVP untouched until user presses Going / Maybe / Declined |
| Started, no end time | Status Started, **not Live**; do not suggest physical presence |
| At capacity, viewer not going | Going disabled; Maybe and Declined remain available |
| At capacity, viewer going | Existing Going state preserved |
| Ended with valid end time | All Portal RSVP changes disabled; event details remain viewable |
| Bad or reversed schedule | Unavailable schedule; Portal RSVP disabled |
| Private, blocked, deleted, or missing event | Uniform Portal unavailable; no title, organizer or attendees leaked |
| 401 | Sign in required; no private metadata |
| Offline or server timeout | Generic retry state; no stale detail rendered or mutation attempted |
| Failed RSVP / capacity race | Safe error text; current confirmed RSVP unchanged; refresh available |
| Explicit Share to Pulse | Never triggered by Enter Portal or RSVP; remains separate opt-in |
| Legacy EventDetail entry | No Portal banner or Portal-only restrictions |
| Screen reader | Portal status is a header; RSVP buttons announce selected/disabled |
| Reduced motion | Existing reduced-motion and sheet behavior preserved |
| Return to map | Same map instance; selection and camera restoration verified |
| Production bundle | `PORTAL_EVENT_PREVIEW_ENABLED` false; original event sheet remains |

## Correct Android build for DEV-only Portal testing

**Do not use** the successful `Release APK (sideload)` artifact from #1046 to
test Portal. That workflow executes `assembleRelease`, whose embedded JS has
`__DEV__ === false`; `PORTAL_EVENT_PREVIEW_ENABLED` is therefore off.
An APK installing successfully does not establish Portal functional QA.

Use the checked-out `feat/portal-event-detail-entry-states` branch and a
local React Native **debug** build connected to Metro:

```bash
pnpm install --frozen-lockfile
pnpm --filter @g88/shared build
adb devices
adb reverse tcp:8081 tcp:8081
# Terminal 1 (leave running):
pnpm --filter @g88/mobile start
# Terminal 2:
pnpm --filter @g88/mobile android
```

This requires Node >=22.13, Android SDK, platform tools, an authorized USB
debugging device and a reachable **development** API configured for that
device. React Native debug builds rely on Metro; an independently installed
release APK does not. Verify the app indicates development mode and the
`NEXA / EVENT PORTAL` sheet is visible. Never put live credentials in test
logs or commit device-specific `.env` files.

On a Huawei device without Google Play Services, a Google-maps-backed surface
can be a separate environment blocker. Log this explicitly rather than treating
a blank map as a Portal regression; validate on a supported second Android
device and iOS as well. Production builds must continue to render the legacy
event sheet and unchanged map behavior.

## Physical-device smoke

- Android: verify on a phone with small display, TalkBack, large font, and
  offline/online transitions.
- iOS: verify VoiceOver, Dynamic Type and return-to-map behavior.
- Use **two accounts** for block and event-visibility transitions; revalidate
  details after access is revoked. No private detail should remain on screen.

## Backend follow-up

This PR blocks ended-event RSVP in the Portal UI only. A future independent
server-side product rule must enforce lifecycle restrictions consistently for
all API clients before claiming that ended RSVPs are impossible.

## Release gates

No change to production feature flags, Google Play configuration, database
migrations, event endpoints or Socket.IO rooms. Do not merge this stacked PR
before PORTAL-02 #1046 is accepted and the mobile CI suite passes.

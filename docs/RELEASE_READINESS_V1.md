# NEXA Release Readiness v1

Scope: Android closed/internal testing readiness. This document distinguishes code-level readiness from external Play Console, legal, credential, and physical-device gates.

## Code-level DoD

### Android build and signing

- [x] Package/namespace is `com.g88`.
- [x] Android `versionName` is `1.0.0`.
- [x] CI supplies a monotonically changing `versionCode` via `github.run_number`.
- [x] Signed AAB workflow exists for Play distribution.
- [x] Release workflow injects the upload keystore from GitHub secrets.
- [x] Release workflow rejects a debug-signed AAB.
- [x] Release manifest sets `usesCleartextTraffic=false`.
- [x] Production API base URL is HTTPS.
- [x] Release workflow fails closed when Maps, Firebase, Google Sign-In, Sentry, or signing configuration needed by the production bundle is missing.

### Android permissions

Declared runtime-sensitive permissions are limited to current product features:

- foreground coarse/fine location for map discovery and explicit live-location flows;
- notifications;
- camera/media/audio for profile/story capture;
- legacy external-storage read only through Android 12 (`maxSdkVersion=32`).

There is no `ACCESS_BACKGROUND_LOCATION` permission in the application manifest.

### Push notifications

- [x] Android 13+ notification permission is requested at runtime.
- [x] FCM token is registered to the authenticated user.
- [x] Logout/account transitions unregister the current device token while auth is valid.
- [x] FCM token rotation is observed with `onTokenRefresh` and the new token is registered server-side.
- [x] Notification tap re-entry is allow-listed; payloads cannot select arbitrary navigation routes or supply coordinates.
- [x] Foreground Socket.IO delivery remains authoritative to avoid duplicate interaction UI.

### Crash/performance telemetry

- [x] Sentry is disabled in development and enabled only when a production DSN is configured.
- [x] `sendDefaultPii=false`.
- [x] events and breadcrumbs pass through the shared scrubber.
- [x] navigation tracing and NEXA launch performance spans are wired.
- [x] Sentry release identity is aligned to Android `1.0.0` and CI `versionCode`.
- [ ] Source-map/native-symbol upload hooks are not yet wired. `SENTRY_AUTH_TOKEN` alone is not proof of symbolication.

### Account deletion and privacy

- [x] Delete Account is available in Settings.
- [x] Backend requires literal `confirm: DELETE`.
- [x] Password accounts must re-enter the correct password.
- [x] Presence is taken offline best-effort before deletion.
- [x] User-owned S3 objects are purged best-effort.
- [x] conversations involving the deleting account are removed before the user row.
- [x] identity-verification rows cascade with account deletion and verification media is under the user S3 prefix.
- [x] Android backups are disabled.

### Legal release guard

- [x] Privacy Policy has a dedicated HTTPS URL.
- [x] CI blocks the `production` Play track while Terms of Service resolves to the Privacy Policy.
- [ ] Dedicated legal-reviewed NEXA Terms of Service remains issue #592.

Closed/internal testing may continue while #592 is open. Public production remains NO-GO until the dedicated Terms document is reviewed, published, reachable without authentication, and wired in the app.

## Deliberately not implemented in this PR

### App Links / deep links

Android currently exposes only the launcher intent filter. Do not add a broad `https://g88.app/*` app-link filter until all of the following exist:

1. canonical public URL patterns for people/events/listings/chat-safe destinations;
2. an allow-listed URL parser that maps those URLs to typed NEXA navigation intents;
3. `https://g88.app/.well-known/assetlinks.json` containing the Play App Signing SHA-256 certificate;
4. cold-start, warm-start, signed-out and deleted/private-entity fallback tests.

Push notification re-entry is a separate, already allow-listed mechanism and does not justify claiming Android App Links support.

### Product analytics / retention

`apps/mobile/src/lib/analytics.ts` currently sanitizes properties and records Sentry breadcrumbs only. It is useful for crash context but is not an analytics warehouse and cannot reliably answer activation, funnel, D1, or D7 retention questions.

Before the first cohort intended for product-learning decisions, add a dedicated privacy-safe analytics sink with a versioned event contract. Never send exact coordinates, message text, ID media, email/phone, auth tokens, or raw internal trust data.

Minimum first-cohort funnel:

`account_created -> profile_usable -> map_opened -> entity_opened -> meaningful_interaction -> connection_or_rsvp_or_offer -> conversation_started`

Required cohort cuts should include verified/unverified, first interaction, first connection and first conversation.

## External gates before Play closed testing

These cannot be proven by repository code alone:

- [ ] Required GitHub Actions release secrets exist and are valid. The AAB workflow now fails closed if required values are absent.
- [ ] Google Maps release key restrictions include the correct package + certificate identity.
- [ ] Firebase Android app matches `com.g88` and production `google-services.json`.
- [ ] Google OAuth Web Client ID matches backend `GOOGLE_CLIENT_ID`.
- [ ] Upload keystore is the intended Play upload key and is backed up securely.
- [ ] Play App Signing is enabled and its signing certificate is recorded for future App Links/Maps restrictions as applicable.
- [ ] Play Console application exists and the first required manual/API bootstrap release is complete.
- [ ] Closed-testing tester list/group is configured.
- [ ] Data Safety form matches actual collection/processing behavior.
- [ ] Store listing links use the hosted Privacy Policy.
- [ ] Sentry production project receives a test crash/performance event from the release build.
- [ ] Real FCM push reaches a release build, and tap re-entry works from killed/background state.
- [ ] Trust Ops real approve + reject smoke is completed with disposable accounts.
- [ ] Physical mid-range Android smoke passes cold start, login, onboarding, Map, Wave, chat, event RSVP, marketplace, verification, push, offline/reconnect and account deletion.

## Production-only gates

- [ ] Issue #592: dedicated legal-reviewed Terms of Service.
- [ ] Sentry source-map/native-symbol upload and verified symbolication.
- [ ] App Links contract + `assetlinks.json`, if external links are part of launch scope.
- [ ] Explicit verification-document retention period and storage lifecycle policy.

## Release decision

Closed/internal Android testing is **GO** when all code-level checks above are green and every item under “External gates before Play closed testing” that applies to the selected track has been manually verified.

Public production is **NO-GO** while any Production-only gate required for launch scope remains unresolved.

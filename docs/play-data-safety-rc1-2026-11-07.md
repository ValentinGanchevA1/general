# NEXUS — Google Play Data Safety declaration review (7 November 2026)

> **Working declaration only.** Based on source in `feat/play-ugc-dating-safety-followup-20261107`, stacked on draft PR #1064. Does not certify the uploaded AAB, live runtime flags, production data retention, hosted legal page, or submitted Play Console values. **Do not submit blindly.**

## Source-backed data inventory

| Google Play category | Code-backed behavior | Launch declaration guidance / verification |
|---|---|---|
| **Location → Precise location** | `ACCESS_FINE_LOCATION` is requested; raw device GPS goes to backend for nearby discovery, H3 r10 coarsening before ordinary public display; optional 1:1 live sharing persists `chat_location_sessions.last_lat/last_lng` and first shared `messages.location` | **Collected: Yes.** H3 r10 (~120m) remains *precise* under Google's **less than 3 km²** definition. Confirm optional consent/user-initiated sharing treatment in the live Play questionnaire. |
| **Location → Approximate location** | Public position is coarsened relative to raw GPS, but not coarse enough to meet Google Play's 3km² threshold | **Do not infer 'Approximate' just from H3 fuzzing.** Declare only if another qualifying coarse collection path exists in the shipped release. |
| **Personal info → Name / Email / Phone number / User IDs** | Account registration, OAuth/profile, optional phone verification | **Collected:** name/email/user ID yes; phone when supplied. Verify `optional` choice field-by-field. |
| **Personal info → Sexual orientation** | ProfileEdit offers optional orientation; `users.sexual_orientation`, including self-description when selected | **Collected when provided.** Private profile visibility is NOT equivalent to no collection. |
| **Personal info → Other info** | DOB required in normal onboarding; gender identity, purpose/interests, dating preference and hometown | **Collected.** DOB is used for adult eligibility; legal controls must match the deployed service. |
| **Photos & videos → Photos** | Avatars, gallery, story photos, listing media and optional verification selfie/ID images | **Collected when supplied.** Audit storage, deletion and processors. |
| **Photos & videos → Videos** | Stories can contain camera/gallery video, uploaded using S3 presigned URLs | **Collected when supplied.** Verify whether audio/video file types require further separate declaration. |
| **Files and docs → Files and docs** | Optional identity verification document uploads | **Collected if verification is enabled and used in the AAB/backend.** Determine retention and provider before finalizing. |
| **Messages → Other in-app messages** | Persistent 1:1 and group messages; initial live location can be in message payload | **Collected: Yes.** Evaluate user-to-user sharing rules explicitly. |
| **App activity → Other user-generated content** | Profiles, Stories, listings, events/questions, check-ins/reviews | **Collected: Yes.** Backend moderation reports store only IDs, types and reason, not copied content. |
| **App activity → App interactions** | App-generated analytics events sent to backend; PostHog mirror may be runtime-gated | **Collected: Yes for first-party analytics.** Determine active PostHog flags and user/device identifiers. |
| **App info and performance → Crash logs / Diagnostics** | Sentry integrated with PII scrubbing | **Verify release DSN and payloads.** Do not assume dormant integration is disabled. |
| **Device or other IDs** | Push tokens, Firebase/FCM SDK and diagnostics identifiers | **Verify merged manifest/SDK behavior and identifiers in the exact AAB.** |
| **Financial info / Purchase history** | First launch planned free; draft PR #1064 removes visible checkout, but backend subscriptions code exists | **Unknown until release build and production `ENABLE_PAID_SUBSCRIPTIONS` flag verified off.** Do not declare card collection solely from backend source or omit historical account status without verification. |

## Public location versus exact DM location

1. Ordinary map presence: precise GPS is transmitted over TLS for computation and coarsened before storage of normal public discovery coordinates. H3 r10 is still **Precise location in Play taxonomy**.
2. Explicit 1:1 live location: initiated by the sender for 15 minutes, 60 minutes or until stopped; delivered to authorized chat peer; last coordinates are in `chat_location_sessions` and initial coordinates in `messages.location`.
3. Stopping the session stops live updates; it **does not clear** the existing stored coordinate records. State this clearly in privacy copy and retention policy.
4. The current privacy-policy source `docs/legal/privacy/index.html` was updated for these two modes. Hosting at `https://g88-legal.onrender.com/privacy` must be verified independently before Play submission.

## Mandatory evidence before final Submit

- [ ] Freeze a commit SHA and inspect merged **release AAB** permissions, SDK dependency manifest, build flags and data flows.
- [ ] Compare each **collected / shared / ephemeral / required-or-optional / purpose** answer against the Play form exactly as presented.
- [ ] Validate precise location and user-initiated chat sharing; do not equate 'not public' with 'not collected'.
- [ ] Confirm optional profile orientation, gender and dating preference handling and sensitive-data disclosures.
- [ ] Confirm Story photo/video, selfie, ID-document and uploaded file paths in runtime; verify data retention/deletion with a disposable account.
- [ ] Audit Sentry, FCM, first-party analytics and optional PostHog/Stripe flags before marking shared/collected categories.
- [ ] Confirm hosted privacy policy and external account-deletion request URL load anonymously over HTTPS, and reflect the build.
- [ ] Complete Terms of Service + policy acceptance for posting UGC (tracked separately as #592); do not present this follow-up PR as clearing that blocker.
- [ ] Validate IARC/target audience 18+ and any applicable **Restrict Minor Access** Play Console setting.

## Google policy sources

- Data Safety taxonomy: https://support.google.com/googleplay/android-developer/answer/10787469
- UGC moderation: https://support.google.com/googleplay/android-developer/answer/9876937
- Dating age-restrictions: https://support.google.com/googleplay/android-developer/answer/16838200

**Status: DECLARATION DRAFT / NO SIGN-OFF.** Code review is not substitute for deployed build, Play Console evidence or legal review.

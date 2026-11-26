# NEXUS Play Console declaration worksheet — 2026-11-26

**State: prepared from repository evidence, not entered or submitted.** No authenticated Google Play Console session or Console tool is connected. Confirm every value in the live form before submission.

| Play Console area | Current evidence | Required action / status |
|---|---|---|
| App identity | Public product name NEXUS; Android package `com.g88` | Preserve the existing app record/package. Confirm it in the authenticated Console. |
| App category | Social discovery, nearby activity, events, listings, profiles and chat | Social is the intended category; confirm the final Console value. Social apps remain in Child Safety scope even if adults only. |
| Target audience | Owner-facing release scope says Social 18+, Dating OFF | Declare 18+ only after matching the signed build. Classify nearby discovery + spontaneous chat against the random-connection rule; configure Play minor blocking if in scope. |
| Child Safety Standards URL | Source exists at `docs/legal/child-safety/index.html` | Legal review and anonymous HTTPS reachability/content checks remain open. Do not enter a URL until the final standards are approved and published. |
| Child Safety contact | Source names Valentin Ganchev / `vganchev6@gmail.com` | Verify address delivery, monitoring, backup coverage and match with the Play developer contact. Do not use the unverified `g88.app` forwarding address. |
| In-app feedback / UGC moderation | Source includes reporting and block controls; Terms screen adds a safety email link | Run signed-build report/block and report-to-admin moderation tests. Source alone does not establish operational moderation. |
| Terms acceptance | This branch adds explicit version/hash acceptance and server UGC gates | Not merged/deployed; migration 0078 and backend flag/values are not configured. Keep disabled until legal approval, privacy update and staging/device QA. |
| Content rating | User profiles, public/private content, social chat, location discovery, events and listings | Complete the questionnaire against the exact release build; no rating outcome is asserted. |
| Data Safety | Account/profile data, fine/coarse and optional precise location, photos/video, messages, reports, diagnostics and analytics; third-party SDK data must be reconciled | Do not submit final answers without inspecting the exact signed AAB, merged manifest, SDK/provider flows, sharing, encryption, retention and deletion. |
| Ads and monetization | Owner review scope says free first release with no third-party ads or active subscriptions/purchases | Verify the signed AAB, backend configuration and Play products before selecting No ads / no purchases. |
| Account deletion | In-app deletion flow exists in source; external deletion page source exists | Verify both public URL and end-to-end processing before completing Data Safety deletion answers. |
| App access | No reviewer credentials/instructions recorded | Prepare restricted reviewer access without sharing an admin account. |
| Permissions | Source requests `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`; no background location | Re-check the final signed AAB manifest and runtime prompts. |

## Submission blockers

1. No current-master AAB is available. The latest AAB artifact is from commit `e6c6c50`, before current master `27b6ae2`.
2. Device is connected, but currently has only a sideload APK at version 1.0.0 / versionCode 2555; current AAB install and flow QA remain incomplete.
3. Terms and Child Safety lack legal/safety approval records; public availability is unverified.
4. Child Safety contact delivery and report-to-moderation operation are not verified.
5. Random-chat/minor-blocking classification remains open.
6. Data Safety, content rating, reviewer access and account-deletion answers must be tied to the exact AAB and production configuration.

Do not submit by inference. Record package, versionCode, AAB SHA-256, upload certificate, backend commit/deploy, legal hashes, Play form revision and submission date after authenticated Console work.
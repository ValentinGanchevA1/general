# NEXUS RC1 — Product-owner review of Privacy, Terms and Child Safety

**Status: INTERNAL REVIEW PACKET / NOT LEGAL APPROVAL / NOT FOR PUBLICATION**

Purpose: let the product owner review the factual service scope and intended Release policy before appointing qualified legal counsel. Owner/product approval confirms only that the draft reflects the intended product. It does not approve legal sufficiency, publish a document, or authorize Play Console self-certification.

## 1. Release scope to review

Current intended first public release:

- Product/brand: **NEXUS**.
- Product category intended: Social; final Play Console category must be checked against the actual app.
- Access: **18+ for the entire Social app**, not only Dating.
- Dating/matchmaking: **OFF** for RC1 across mobile UI, REST, discovery, profile preferences and realtime.
- Commercial model: free Early Access; no third-party ads and no active subscriptions/purchases in the initial Bulgaria launch. Confirm that the actual signed AAB, backend configuration and store listing still match this decision.
- Main functions: nearby people and places on a map, profiles, waves/interactions, 1:1 chat, events/RSVP/Q&A/reviews, Stories, local listings, verification, reporting/blocking and gamification.
- Public map presence is location-coarsened; precise 1:1 live-location sharing is a separate user-initiated feature.

**Owner review:** confirm that the above is still the intended Release scope. Any excluded or deferred capability must also be excluded from legal promises and Play declarations.

## 2. Source documents and current state

| Document | Current source | State |
|---|---|---|
| Privacy Policy | `docs/legal/privacy/index.html` — SHA `699435878fe7470cf61b7420154d86ccef37b021` | On master and served by the Render static site; last-updated date in content is 7 Nov 2026 |
| Terms draft | `docs/legal-review/NEXUS_TERMS_DRAFT_2026-11-07.md` — SHA `290a890038c770f18f1b91da656a20ba8fbbb344` | Editorial draft in stale Draft PR #1067; not approved or published as Terms |
| Terms HTML preview | `docs/legal-review/NEXUS_TERMS_PREVIEW_2026-11-07.html` | Review-only HTML with draft warning and placeholders |
| Child Safety draft | `docs/legal-review/NEXUS_CHILD_SAFETY_STANDARDS_DRAFT_2026-11-08.md` — SHA `c25b88c8b082bbc181c330f14294566d8cd67502` | Internal working draft; not approved or published |
| Child Safety HTML | `docs/legal/child-safety/index.html` on PR #1140 branch only | Draft/noindex candidate; not present on master |
| Play checklist | `docs/play-console-launch-checklist.md` | Release checklist; update prepared in Draft PR #1176 |

The Render static service `g88-legal` auto-deploys from `master` and publishes `docs/legal`. Merging a final Terms or Child Safety HTML page will publish it. Do not merge a candidate page while it still contains a draft banner, noindex tag or unresolved placeholders.

## 3. Privacy Policy — factual review

The current Privacy page makes the following material claims. Confirm each against the exact RC1 app, backend, database, providers and retention configuration.

### 3.1 Account and profile data
- Email, salted password hash or Google sign-in identifier, display name.
- Profile photos, biography, interests/goals, date of birth, optional hometown and social links.
- Phone number and optional selfie/ID document data for verification.
- Chat messages, waves, RSVPs, listings, gifts and challenges.
- Crash/diagnostic data, app-usage events and push token.
- Optional payment/subscription status and Stripe handling are described in the page. This needs reconciliation with the free/no-subscription RC1 scope; do not imply that purchases are available if they are disabled.

### 3.2 Location
The current page states:
- The device obtains precise GPS for nearby discovery and transmits it to the server over an encrypted connection.
- Public map presence is coarsened to approximately a 120-metre H3 cell/centroid before public presence data is stored.
- One-to-one chat live-location sharing is optional, can run for 15 minutes, 60 minutes or until stopped, and exposes precise coordinates to the chosen recipient.
- The latest precise location is stored in the session record and initial coordinates are retained in the chat message.
- Ending a session stops further updates but does not automatically remove previously stored coordinates.
- Location is foreground-only; the Android source manifest requests fine and coarse location but has no background-location permission.

**Owner must confirm:** all user-facing wording, durations, default states, stop behavior, retention of session/message coordinates, whether every described platform uses the same behavior, and whether the product still uses the approximate 120m representation. Do not describe the app as coarse-location-only: fine location is requested and precise chat sharing exists.

### 3.3 Service providers / SDKs
The Privacy page currently names:
- Supabase — managed database.
- Render — application hosting.
- AWS S3 — photo/document storage.
- Firebase Cloud Messaging — push notifications.
- Google OAuth and Maps.
- Sentry — crash/error diagnostics.
- PostHog — product analytics.
- Stripe — subscription payments.
- Twilio — phone verification codes.

**Owner/engineering verification required:** reconcile this list with actual live Render/Supabase infrastructure, production secrets, mobile SDKs, transitive SDK collection, analytics settings, storage, push, email/SMS and release build. Add any real provider omitted; remove or qualify providers not used in RC1. Play Data Safety must include applicable SDK collection and sharing.

### 3.4 Retention and deletion
The current policy says account data is retained while the account is active; diagnostic/analytics data is retained for a limited period; presence expires within minutes; account deletion takes effect immediately while storage cleanup can continue asynchronously; some objects may remain temporarily during retry cleanup; encrypted backups may persist until overwritten; and legally required minimum records may be retained.

**Required decisions/evidence:**
- Define actual retention durations for logs, analytics, messages, live-location session records, reports, verification records, media, backups and deletion retries.
- Confirm whether report/moderation records are retained after account deletion and under what lawful basis.
- Verify active-system deletion and asynchronous S3 cleanup against a synthetic account.
- Verify the external deletion-request page and the email request process; source file exists at `docs/legal/delete-account/index.html`, but anonymous public reachability still requires verification.
- Do not promise instantaneous erasure from backups if that is not technically true.

### 3.5 Operator, contact and international transfers
The current Privacy page identifies a named individual as operator, publishes a postal address, lists a Gmail contact, and says providers may process in the EU and US under safeguards such as standard contractual clauses.

**Owner confirmation:** actual contracting/controller identity and capacity, legal entity or individual status, registered/correspondence address, correct contact mailbox and authority to publish these details. Qualified counsel must confirm controller/processor roles, lawful bases, GDPR notices/rights, international transfer mechanism and applicable local/EU requirements.

### 3.6 Claims needing implementation parity
The Privacy page says NEXUS is for adults 18+ and that the service rejects profiles that do not meet the age minimum. The backend has an opt-in age gate and the new mobile bootstrap is in Draft PR #1174; the production Render flag is unverified and has not been changed. Therefore do not treat the published claim as proven runtime enforcement until the exact backend flag, signed AAB, staging tests and production rollout are evidenced.

The page also says NEXUS does not sell personal data and shows no third-party advertising. Confirm these statements remain true for all current data flows and the RC1 commercial configuration.

## 4. Terms of Service — owner review points

The current Terms draft explicitly remains unapproved and contains unresolved placeholders. Before counsel review, the product owner should confirm:
- The full first-release feature set and the Social 18+ / Dating OFF scope.
- The operator name/status, registered address, support contact, effective date, version and supported languages.
- Community rules and prohibited behavior, including abuse, stalking, scams, illegal content and misuse of precise location.
- User Content categories: profile text/photos, Stories, messages, event content, listings, reviews and other UGC.
- The currently unresolved **license scope** needed to host, process, display, moderate and distribute User Content, including deletion/expiry limits. Do not publish the placeholder.
- Actual moderation powers and appeal path; do not promise suspension, content removal, cache purge or response times unless implemented.
- Responsibility boundaries for offline meetings, events, marketplace trades, user listings and verification badges.
- Subscription/payment, refunds and consumer-law terms only if relevant to the actual Release.
- Governing law, dispute resolution, liability, termination, account deletion and legally required retention. These are counsel decisions.

### Staging and database security facts (read-only, 25 Nov 2026)

- Supabase `G88` and `NEXUS-STAGING` are separate projects with distinct project refs and database hosts in `eu-west-1`. Both report `ACTIVE_HEALTHY`.
- `NEXUS-STAGING` currently has no public application tables, no `users` table, no app `schema_migrations` table and no Supabase migration history. Only default Supabase-managed schemas exist. The database is an empty foundation, not yet a usable NEXUS staging backend.
- Fresh Render metadata on 25 Nov shows `g88-api` Auto Deploy OFF, `pullRequestPreviewsEnabled=no`, `previews.generation=off`, and no `g88-api PR #...` services among the 4 services in the workspace. This is current containment evidence, not proof of historical preview DB targets or migration provenance.
- `G88` has 85 rows in `public.schema_migrations`, applied from 23 May to 8 Nov 2026. The merged offline PR #1092 recorded 85 applied filenames vs 70 checkout migrations at its historical commit, with 15 mismatches. Re-run against current master; do not copy/alias missing history or replay SQL blindly.
- A fresh read-only comparison against current GitHub `master` on 25 Nov confirms **70 migration SQL files in checkout vs 85 filenames in G88**, with exactly these 15 applied filenames absent from current master:
  - Applied 8 Sep: `0036_trade_offer_counter.sql`, `0037_conversation_kind_members.sql`, `0038_user_strikes.sql`.
  - Applied 26–27 Oct: `0051_event_reviews.sql`, `0054_posthog_deletion_queue.sql`.
  - Applied 6 Nov: `0069_realtime_room_revocation_outbox.sql`.
  - Applied 7 Nov: `0072_ugc_terms_acceptance.sql`, `0072_extend_content_report_targets.sql`, `0073_event_question_moderation.sql`, `0073_extend_content_report_targets.sql`, `0074_event_question_moderation.sql`.
  - Applied 8 Nov: `0072_personal_labels.sql`, `0075_dating_match_conversation_lookup.sql`, `0076_child_safety_report_reason.sql`, `0077_adult_only_rc1_visibility.sql`.
- The Nov 7–8 filenames overlap migrations present only in unmerged/closed Draft PRs (#1066, #1067, #1074, #1060). This is a **migration provenance/governance finding**. The records do not establish whether they were applied by a Render preview, manual operator, or another path. Do not assert the actor or assume the SQL body still exists in G88; no migration body is stored in the history table.
- Read-only aggregate check of the current `users` table after 0077: 2,493 active users; 2,395 DOB-null; 0 under-18 by the current UTC date; **0** DOB-null/under-18 users with non-private visibility; **0** DOB-null/under-18 users with Dating enabled. This is evidence of the current data postcondition, not proof that the runtime age gate is active. No per-user DOB, email or identifier was selected.
- The Render parent-service deploy history does not show a parent deployment aligned with several Nov 7–8 migration timestamps; this does not rule out a PR preview, CLI/manual database connection or another runner. Preserve the issue #1078 read-only investigation and obtain provenance through Render preview/deploy records, repo GitHub workflow logs, and Supabase audit logs if available. **Do not repair the 15 names by aliases, deletion, replay or rollback.** Prepare a forward-only, reviewable migration reconciliation after an isolated restore and counsel/owner-independent database review.
- Supabase table metadata reports RLS disabled on 65 public tables. Read-only PostgreSQL privilege checks found no direct SELECT/INSERT/UPDATE/DELETE privileges for `anon` or `authenticated` on those RLS-disabled tables, including sensitive examples, and no public SECURITY DEFINER functions executable by those roles. Thus current direct exposure via standard Supabase client roles was not confirmed; disabled RLS remains a defense-in-depth risk if grants change later. Do not bulk-enable RLS: table-specific policies and backend regression tests are required.
- Render still has only one NEXUS API service (`g88-api`); a distinct staging API deployment is absent. Its `DATABASE_URL` and Redis target are not readable through connected Render tools. Create/deploy a separate API that targets NEXUS-STAGING only after migration reconciliation and isolated credential setup; do not change the live service.
- No application schema, RLS flags, table grants, production rows, Render variables or migrations were changed during these checks.

### Terms acceptance engineering dependency
The current mobile `TERMS_OF_SERVICE_URL` still equals the Privacy URL `https://g88-legal.onrender.com/privacy`; no dedicated `docs/legal/terms/index.html` exists on master. PR #1067 is stale/diverged (93 commits ahead of an old base and 59 behind current master) and not mergeable. It must be split/rebased and revalidated; do not merge it wholesale or replay migration 0072 without isolated staging and migration-history review.

A link to Terms is not affirmative acceptance. The final flow must record user ID, exact approved version, timestamp and channel; enforce current-version acceptance before UGC creation/upload on HTTP and Socket.IO; support reacceptance after a version change; and keep safety reports, blocking, account deletion and access to policy documents available.

## 5. Child Safety Standards — owner review points

The current Child Safety draft:
- Prohibits CSAE/CSAM, grooming, sextortion, exploitation and facilitation across text, images, audio, video, profiles, Stories, messages, listings, events and links.
- Calls for in-app reporting and blocking and warns users not to copy or forward potentially illegal imagery.
- Describes intended moderation and possible restriction/removal/escalation but explicitly leaves response times, appeals and legal reporting routes unresolved.
- Contains placeholders for alternative contact, effective date, operator, named contact and public URL.
- States NEXUS Social is 18+ and Dating is not in RC1; age assurance is not independent ID verification.

### Operational limits that must remain truthful
Current source review documents a report route (mobile report → authenticated `POST /api/v1/reports`) and admin queue/decision endpoints. That is not proof of deployed operation. The Child Safety QA matrix CS-01–CS-12 remains **NOT RUN** on the exact signed AAB/API.

Source-reviewed behavior also notes:
- `hide_story` soft-deletes a Story; cached content/media may remain temporarily.
- A user-report review does not itself suspend the reported account.
- No automatic chat moderation or immediate media purge is established by the cited implementation.
- Admin moderation access is protected, but real queue access, triage, decision audit and escalation still need synthetic runtime testing.

Do not promise 24/7 coverage, fixed response SLAs, automatic CSAM detection, immediate deletion, account suspension or law-enforcement escalation unless the process is staffed, legally approved, deployed and tested.

### Child Safety contact status
The product owner previously designated the owner as NEXUS Child Safety Contact and selected the Google Play developer-account mailbox as the Play contact. The exact Play developer mailbox and a successful test delivery remain unverified.

Cloudflare setup as of 25 Nov 2026:
- Destination `vganchev6@gmail.com` is verified in the Cloudflare account.
- Forwarding rule `child-safety@g88.app → vganchev6@gmail.com` exists and is enabled in Cloudflare.
- **Email Routing is not operational:** `g88.app` zone is Pending; Email Routing is disabled/unconfigured; Cloudflare nameservers have not been delegated at the registrar; no end-to-end email delivery test has passed.
- No nameserver, MX, SPF or DKIM record was changed during this review.
- Therefore do not yet publish `child-safety@g88.app` as a working public contact or enter it as a verified Play contact. First complete registrar DNS delegation safely, enable Email Routing, verify MX/SPF/DKIM and receive a real test message.

Owner must also decide whether an alternate responder/backup exists, what coverage is actually available and what happens when the primary contact is unavailable.

## 6. Google Play declarations — match the exact Release

- Target audience: select 18+ only for the intended RC1 scope; confirm the correct Content Rating, app category and any required Restrict Minor Access tool in Play Console.
- Because NEXUS is intended as Social, Child Safety Standards must still be completed even with an adult-only target audience.
- The nearby-people discovery + spontaneous messaging flow needs a documented classification against Play's Age-Restricted Content and Functionality policy. Do not infer that hiding Dating removes this separate category.
- Google Play announced a policy update on 15 July 2026; the relevant Age-Restricted Content and Functionality and Child Safety Standards changes took effect on **26 August 2026**. The Age-Restricted policy now explicitly includes apps whose core functionality is randomly connecting users to spontaneously communicate with people they do not know. NEXUS must classify the actual nearby-people discovery + Waves + chat flow against this definition. Dating OFF alone does not settle the random-chat classification.
- The same 26 August 2026 expansion includes anonymous/random chat apps in the Child Safety Standards scope. For Social apps, Child Safety remains required even when the app is intended only for adults; target-age exclusion is not a Child Safety waiver.
- Data Safety: inventory all collection/sharing by the AAB and SDKs; include fine/precise location collection off device, even though public map pins are coarsened. The optional precise chat live-location flow must be described accurately.
- Permission declarations: source Android manifest requests `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`; source has no `ACCESS_BACKGROUND_LOCATION`; broad `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO` permissions are removed using manifest tools directives. Verify the final merged/signed AAB manifest, not only source.
- Child Safety declaration: publish the final reviewed standards page, verify report/feedback and moderation operations, and provide a confirmed monitored contact.
- Account deletion: verify the public external deletion-request URL and the in-app deletion flow are consistent.
- App access: prepare reviewer instructions/test credentials if Play needs access to gated features.
- Complete all declarations truthfully against the exact package/version/build; do not guess.

## 7. Engineering and release evidence at review time

| Area | Current evidence | Status |
|---|---|---|
| Existing Android core flows | Owner-confirmed Huawei Nova 11 tests for Storyline, Check-in, Chat, Map and Events on Build #2523 | PASS (owner-reported) |
| 18+ backend | DB-backed service + REST/Socket.IO guards exist; Render maps age endpoints | Source/startup evidence only |
| 18+ mobile bootstrap | Draft PR #1174; CI, security scans and Android sideload build passed | Not merged/deployed; age-gate device tests NOT RUN |
| Dating OFF | Draft PR #1173 head 23d8b53; CI, ESLint, CodeQL, Semgrep, AWS policy validation and DeepScan PASS; Android APK build PASS; iOS MapLibre Build still in progress | Not merged/deployed; APK is client-only QA, backend not live |
| Isolated staging | Separate Supabase project NEXUS-STAGING exists (ACTIVE_HEALTHY, different DB host from G88), but it has 0 public application tables and no app migration history; Render has no separate NEXUS staging API service; staging Redis/storage/OAuth/push/email remain unverified | BLOCKED — foundation exists, not provisioned |
| Terms page/acceptance | Dedicated /terms page absent on master; stale PR #1067 | BLOCKED |
| Child Safety page | Candidate only in Draft PR #1140; auto-publish risk on merge | BLOCKED |
| Child Safety runtime | CS-01–CS-12 not run on signed release build/API | BLOCKED |
| Child Safety email | Cloudflare verified destination/rule created, but zone and Email Routing are inactive | NOT OPERATIONAL |
| Play Console declarations | Must be checked in authenticated Play Console against exact signed AAB | NOT VERIFIED |
| Docs PR #1176 | Play checklist + owner review packet updated with Aug 2026 policy scope, staging and migration evidence | CI, ESLint, CodeQL, Semgrep, AWS policy validation and DeepScan PASS; still Draft |
| G88 database RLS | Supabase reports RLS disabled on 65 of 66 public tables; read-only grants check found 0 direct table privileges for anon/authenticated and 0 public SECURITY DEFINER functions executable by those roles | Defense-in-depth gap; do not bulk-enable without policies and regression tests |

### 7.1 Android Dating OFF sideload QA candidate — not a Release candidate

- Workflow run: [Android Build #45595846300](https://github.com/ValentinGanchevA1/general/actions/runs/45595846300), SUCCESS; artifact ID 15014029319 (g88-sideload-apk).
- Artifact ZIP SHA-256: fd3c259538d38f17844df4216adf721a0cf13a70ed150995facf4023213f8331.
- Extracted APK SHA-256: f13d84cee128e5e3d1ea6c7e0df3c51f3d26b9f19fcd0ce91472f3ee86042c2b.
- APK metadata: package com.g88; versionName 1.0.0; versionCode 2540; targetSdk 36; minSdk 24; JS bundle at assets/index.android.bundle.
- Final packaged manifest has no READ_MEDIA_IMAGES, READ_MEDIA_VIDEO or ACCESS_BACKGROUND_LOCATION; fine/coarse location and camera/microphone permissions remain. WRITE_EXTERNAL_STORAGE is present in the merged manifest and must stay documented for Play review.
- APK v2 signing block certificate fingerprint: 24f27aff192ee0a93b04f863f093a79adf776a0ea86ff6df097191ab75ec823b; the same certificate is embedded in the previously inspected master APK and PR #1166 APK.
- Scope limitation: this artifact contains PR #1173's client-side Dating UI gate only. It does not include PR #1174 mobile 18+ bootstrap, and the #1173 backend changes are not deployed to Render. It is not a complete server-enforced Dating OFF / Social 18+ build, not an AAB, and not Play-ready. Restrict its use to owner-controlled local QA with test accounts; do not treat it as evidence of backend policy enforcement.

## 8. Owner Release-candidate approval checklist

Complete after reviewing the actual product decisions and before sending the exact drafts to counsel.

- [ ] Confirm the entire first-release Social app is 18+ and Dating is OFF.
- [ ] Confirm launch-market availability and the free/no-ads/no-subscription scope.
- [ ] Confirm the exact live feature list and identify anything disabled or deferred.
- [ ] Confirm provider/SDK list against the production architecture and signed AAB.
- [ ] Confirm location wording, permissions, live-location durations, recipients and stored records.
- [ ] Confirm account deletion, backup, retention and report/moderation facts.
- [ ] Confirm operator identity/status/address, support channel and data-request contact.
- [ ] Confirm Child Safety contact owner, backup/coverage and operational response model.
- [ ] Confirm Terms' user-content license, prohibited-content rules and community enforcement model.
- [ ] Confirm intended language(s), document versions and effective-date plan.
- [ ] Record owner review date, exact commit/document SHAs and outstanding product changes.

**Owner review outcome:** `NOT YET RECORDED`

## 9. Qualified legal review and publication — separate final gate

After owner Release-candidate approval, appoint qualified legal counsel/safety reviewer to:
1. Review final Terms, Privacy and Child Safety text against the actual service, operator, Bulgaria/EU requirements, consumer law, GDPR, platform policy and relevant child-safety obligations.
2. Resolve all legal placeholders, retention/lawful-basis/transfer wording, age-assurance approach, UGC license, appeals and escalation.
3. Approve exact content SHA, version, effective date, operator and public contact.
4. Record reviewer identity/qualification, date, scope and approved content hashes.
5. Only then update the HTML candidates, remove draft/noindex notices, merge the approved pages and verify anonymous HTTPS content.
6. Update the app's Terms URL only after dedicated `/terms` is publicly live and verified; enable UGC acceptance enforcement only after code, migrations, DB isolation and tests are independently approved.
7. Complete Play Console declarations only with proven runtime and exact AAB/API evidence.

**This packet does not give legal advice, certify Google Play compliance, authorize public publication or authorize production configuration changes.**

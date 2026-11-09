# NEXUS — UGC Terms acceptance release runbook (2026-11-07)

Status: **implementation candidate** (PR #1067). The working Terms draft was merged as a **review artifact only** in #1065. It is **not legally approved** or published. Issue #592 remains open. This runbook does not certify legal compliance.

**Product age-scope decision (#1068, 7 Nov 2026):** General NEXUS social access is not universally 18+. Optional Dating/matchmaking is the only 18+ product pillar. General registration currently has no birth-date requirement; Dating uses a user-declared DOB plus backend guards, **not independently verified age**. The product minimum age for non-Dating features, regional consent, minor/teen protections and robust anti-bypass age assurance must be determined before Google Play target-age declaration or public release. See #1071 for tracked safeguarding requirements.

**First-release Dating hold (8 Nov 2026):** The default-deny backend `NEXUS_DATING_RELEASE_ENABLED` switch and mobile `DATING_RELEASE_ENABLED = false` suppress the adult-only Dating module until effective age assurance is approved. Do not enable this by entering an adult DOB or simply toggling a release switch. Confirm exact deployed backend configuration and signed Android candidate. General Social age safeguards are tracked separately in #1071.

## Google Play rule
Official UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937
Google requires affirmative acceptance of the app's terms/user policy before creating or uploading UGC, clear prohibited-content rules, effective reporting/blocking, and appropriate ongoing moderation.

## Implemented flow
1. User logs in by email/password or Google; authentication does **not** imply Terms acceptance.
2. Mobile calls authenticated `GET /api/v1/terms/status`.
3. Once the legal document is published and enforcement is enabled, server returns `required:true` for users without an acceptance of the **current** version. Mobile displays a Terms review link and an explicit consent switch.
4. Mobile `POST /api/v1/terms/accept` with `{ "version":"<current>", "accepted":true, "channel":"mobile" }`.
5. Backend writes immutable (user ID, Terms version, initial accepted timestamp, channel) to `user_terms_acceptances`. Duplicate acceptance is idempotent. Account deletion cascades to delete these rows.
6. Backend enforces accepted current version on UGC creation/upload endpoints and realtime chat/live-location sessions. Requests without current acceptance fail with `403 terms.acceptance_required` including `version` and `url`. Read-only browsing, reports, blocks, account deletion, login and support remain available.
7. When Terms version changes, old acceptance is **not** sufficient. Mobile rechecks status on foreground; users must accept new version before further UGC mutations.

## Backend configuration (do not enable until after legal approval and deployment)
- `NEXUS_REQUIRE_UGC_TERMS=true` — **OFF by default**. When enabled but missing valid configured Terms, publishing fails closed (503).
- `NEXUS_TERMS_VERSION=<immutable-counsel-approved-version>` — version uses 2–64 allowed ASCII characters (A–Z, 0–9, period, underscore, hyphen).
- `NEXUS_TERMS_URL=https://g88-legal.onrender.com/terms` — distinct HTTPS URL; must actually serve approved legal Terms.
- Never silently reuse an old version after changing the text. Archive an immutable copy of each issued version for dispute/audit handling.
- Rollback plan: disable enforcement if legal deployment breaks *only with incident approval*, while preventing new UGC until policy is restored if required by compliance. Do not turn off enforcement merely to bypass acceptance.

## Endpoints
`GET /api/v1/terms/status` (JWT) => `{configured,enforcementEnabled,version,url,accepted,required}`.
`POST /api/v1/terms/accept` (JWT) => `{accepted:true,version,acceptedAt}`; Body requires explicit `accepted:true`, exact `version` and `channel` (`mobile|web|api`).

The user ID **always** comes from the JWT, never from the request body. Acceptance timestamp originates in PostgreSQL.

## Staged legal publishing
The *review draft* is `docs/legal-review/NEXUS_TERMS_DRAFT_2026-11-07.md`.
A branded **unapproved preview** is `docs/legal-review/NEXUS_TERMS_PREVIEW_2026-11-07.html`.
Both are outside Render static site's `docs/legal` publish directory.
**Do not publish either as legally approved.** After qualified counsel reviews and signs off:
1. Replace placeholders, check service operator identity/contact, effective date, content license, community policies, appeals, deletion behavior, local trade disclaimers, dispute resolution, consumer rights, and bilingual wording if required.
2. Commit the final document as `docs/legal/terms/index.html`; ensure no draft labels or TODOs. CI should assert no unresolved placeholders.
3. Merge that specific legal-only change and wait for Render static site to deploy. Test `/terms` in a private, logged-out browser.
4. Update `apps/mobile/src/constants/app.ts`: `TERMS_OF_SERVICE_URL` must differ from `PRIVACY_POLICY_URL`; run production legal URL gate and Android build.
5. Check matching privacy claims, final UGC moderation procedures, Android app acceptance modal, accessibility, test accounts, OAuth and previous-account logins.
6. Apply migration 0072, confirm `/terms/status` for both new and existing accounts. Then explicitly set the three backend runtime flags and verify no bypass.
7. Capture evidence and resolve #592 only when product owner, QA and legal reviewer have signed off.

## November 8 hardening — publication and consent resilience
- UI now visibly offers a retry if the authenticated Terms status request fails, rather than silently treating the status as not required.
- Redux correlates status/acceptance requests with their IDs; late network responses after logout, account changes or a newer refresh can no longer overwrite the current consent state.
- Friend follow/request/accept and reordering published profile photos are gated by accepted current Terms; users can still decline/cancel/unfriend, delete photos or hide their profile without accepting an updated version.
- Existing safety exits remain available without acceptance: withdraw an existing marketplace listing, decline an offer or RSVP, and opt out of public-profile/dating visibility. Any attempt to add more fields or publish new UGC still requires acceptance.
- Tests cover state isolation across accounts, status ordering, consent acceptance and UGC metadata. CI must be green at the latest head; these changes alone are **not release approval**.
- Open risk for final device QA: foreground location presence and other non-UGC telemetry should honor independent visibility/privacy controls without silently treating Terms consent as location sharing consent.

## Tests
- Shared/backend/mobile typechecks and lint pass.
- On disposable PostgreSQL: apply 0072 twice, accept current version, reject absent/stale acceptance, test immutable first timestamp and cascade deletion.
- Server: authenticate user; direct `POST /stories`, story media presign, event create, listing upload, review, and chat send must fail `403 terms.acceptance_required` before acceptance when enabled.
- Socket.IO: `chat:send`, `location:share:start`, `location:share:update` enforce current acceptance; `location:share:stop` remains available.
- UI: review distinct Terms link, affirmative checkbox, explicit accept; decline => no further UGC publication; transient error => retry, never fake success.
- Test Google login and account from previous policy version. Confirm blocked users can still report abuse without Terms acceptance.
- Android physical device QA against **the exact signed candidate**; Play Console / Data Safety declarations must reflect actual deployed configuration.

**Remaining release risks:** Terms legal approval and public URL, full UGC route audit as product expands, device QA, the behavior of existing user sessions during a policy update, and ongoing moderation operations.

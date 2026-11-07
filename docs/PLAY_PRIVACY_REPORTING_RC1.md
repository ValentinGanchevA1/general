# NEXUS first Play release — privacy, billing and safety gates (2026-11-07)

This document records changes proposed in PR #1064. **Not a claim of live deployment or Play approval.**

## Public map location vs opt-in 1:1 live location
- Public nearby map: client GPS reaches backend over TLS; backend coarsens it for ordinary map presence. Other users see only the coarsened pin; the exact GPS sample is not stored as the normal public map presence.
- Optional live location sharing in one-to-one Chat: user explicitly starts a 15m / 60m / until-stopped session. Authorized chat peer sees precise updates until expiry/stop/block. These coordinates **are stored** in `chat_location_sessions.last_lat/last_lng`; the initial position is persisted in `messages.location` for the associated chat message. Ending live sharing stops further updates, **not necessarily retention** of those rows.
- Group chats cannot share precise live location. Public discovery must never leak chat-session coordinates.
- The current ~120m public map position is *not necessarily “approximate location” under Play Data Safety*; Play uses a 3km² threshold, and 120m coarsening remains finer. Audit the exact release AAB and declare the precise category where needed.
- Source policy in `docs/legal/privacy/index.html` must be legally reviewed and separately deployed to `https://g88-legal.onrender.com/privacy`, then verified anonymously. A repository change is not deployment.

## Free-first-release billing
- The mobile Premium screen is informational and exposes no prices, Stripe checkout buttons or purchase links.
- The checkout endpoint default-denies unless `ENABLE_PAID_SUBSCRIPTIONS=true`. **For the first Google Play release, ensure this is absent/false in the deployed backend.** The existing billing portal/webhook remain for servicing any pre-existing accounts.
- No paid digital goods or paid subscriptions should be reachable in the release app. Test deep links, legacy menus, themes, gifts, and API flags. Future purchases require a separate compliant rollout.

## Content reports and operational processing
- User/report UI -> Redux `submitContentReport` -> authenticated `POST /api/v1/reports`.
- Reason enum is bounded; target is validated; duplicate submit by same reporter+target is idempotent; HTTP throttle limits abuse; no raw UGC, location, or evidence media are copied into report rows.
- Migration: `0070_content_abuse_reports.sql`. Apply in a controlled backend release before distributing client actions. Do not point a release app at a backend missing this schema.
- Admin-only `GET /api/v1/admin/content-reports?status=open&offset=0&limit=20`, `POST /api/v1/admin/content-reports/:id/decide` (review/dismiss/hide_story) behind JWT and AdminGuard.
- Operator UI: NEXUS Admin -> Safety Reports. Open reports; inspect reported user or story material (may be sensitive); apply policy; mark reviewed/dismissed or hide story. Review actions are recorded. Reviewing a **user** does not automatically suspend that account.
- `hide_story` soft deletes the story in DB so normal discovery/read SQL excludes it. Already loaded clients might temporarily show stale content; live invalidation, cleanup of original media, and incident response need additional QA.
- **Known limits:** no automated moderation of chat messages, no automatic user suspension, and no guarantee of immediate deletion from upstream caches/S3. Do not claim otherwise in IARC.
- Privacy: limit operator access to admins, never log coordinates or private messages; report id and account ids are moderation-sensitive data.

## Acceptance checks prior to merge/deployment
1. CI mobile/backend/admin typecheck and lint passes; backend tests green.
2. DB migration prefix check; test migration on disposable Postgres 16 and verify report insert, unique constraint, moderation transaction, user deletion CASCADE.
3. Report a real profile and story from a non-admin test account. Verify one report row each, duplicate tap stays idempotent, offline case shows **failure**, not fake success.
4. Login as authorized admin; verify only admins can list/decide; view report in queue; dismiss or hide story; verify story disappears from normal GET/nearby and follow-up client refresh.
5. Verify blocked users can still report previous profile abuse from profile menu; unrelated inaccessible stories cannot be probed.
6. Confirm public URL / privacy statements and Play listing match build; audit user-visible About/Privacy/Help.
7. Test exact Play-signed AAB on device; ensure no paid checkout and release backend flag false. Complete IARC/Data Safety only against this tested candidate.

**Separate production blocker:** dedicated real Terms of Service (#592) must replace the Privacy URL; users must accept a UGC policy and the service must respond to reports under Google Play UGC rules.

# NEXUS first Google Play release — UGC / dating / privacy QA evidence

**Code candidate:** PR #1066 (draft, based on merged #1064). **Environment:** GitHub source only; no production deployments, private Play Console actions or mobile device execution performed by this document.

## P0: Report Content — operator/device acceptance

| Test | Steps | Pass criterion | Evidence |
|---|---|---|---|
| Existing Profile + Story (#1064) | From distinct verified test users: report profile and Story, select abuse reason | `POST /api/v1/reports` stores one durable row each; success only after server reply | **Pending** |
| Listing | On a public non-owned listing tap Report and select reason | Request uses `targetType: listing`; appears in authenticated admin queue | **Pending** |
| Event + question | Report event page and one other author's individual Q&A entry | Separate `event` and `event_question` targets; no cross-target report | **Pending** |
| Area alert + Pulse check-in | Flag visible authored Pulse activity | `alert` / `check_in` target persisted and reviewable, not a synthetic trending aggregate | **Pending** |
| DM / group text | Report a visible message from another sender, including active group membership | `message` target persisted, no sender/location spoofing or group cross-room visibility | **Pending** |
| Offline / 500 / duplicate | Disable network, retry and double-submit one report | No false success; one DB row for same `reporter/target`, errors visible | **Pending** |
| Self / private / strangers | Report self content, someone else's private listing or unrelated private DM message UUID | 4xx, no report row and no private text returned | **Pending** |
| Block + expiry | Report previously seen Story after author blocks viewer or it expires; flag expired Pulse check-in | Historical abuse report accepted by ID; no raw content surfaced in API response | **Pending** |
| Admin queue | Open Safety reports as authorized admin and non-admin | Only admin may list/decide; content reviewed case-by-case, audited | **Pending** |
| Soft hide | Hide story, listing, event, check-in, area alert and event Q&A item | `deleted_at` stored, fresh read/viewport no longer returns content; snapshots/realtime also rechecked | **Pending** |
| Chat review | Admin reviews reported DM / group message | Manual disposition only: **not** claiming automatic deletion of chat message | **Pending** |

**Required migrations:** `0070` and `0071` already introduced in #1064, followed by `0073_extend_content_report_targets.sql` and `0074_event_question_moderation.sql`. Apply in staging and verify repeat replay before any app distribution. The backend must be deployed before this mobile client is installed.

## P1: Dating adult eligibility

| Test | Steps | Pass criterion | Evidence |
|---|---|---|---|
| Unregistered DOB | Call dating endpoints with valid JWT and no DOB | Like/pass rejected, no likes or matches created | **Pending** |
| Age below 18 | Set an underage DOB; attempt opt-in, like, pass and dating discovery | Rejected server-side, including REST queries and websocket discovery resolver | **Pending** |
| Age exactly 18 | Use date exactly 18 years before backend `CURRENT_DATE` | Adult-eligible if opted into dating; correct boundary | **Pending** |
| DOB cleared after dating | Try PATCH `dateOfBirth:null` while opted in | Rejected; previously recorded DOB remains intact | **Pending** |
| Race / session change | Disable dating or modify age eligibility during discovery | Revalidation prevents subsequent dating matches/realtime candidate leak | **Pending** |
| Play target audience | Compare chosen Play age settings with actual release build | Compliant with target audience policy; self-declared DOB isn't identity verification | **Pending** |

## P1: Data Safety / Privacy

- [ ] Final uploaded Android AAB dependency SDK and merged manifest audited (FCM, Sentry, analytics, verification, media).
- [ ] Declare **Precise Location** for raw GPS processing + ~120m H3 positions; never claim it remains on-device.
- [ ] Confirm opt-in DM sharing retains exact `chat_location_sessions` and `messages.location` after session end; confirm deletion and retention behavior in staging.
- [ ] Declare optional sexual orientation, gender identity, DOB, user Stories/videos, ID documents/selfies, in-app messages and UGC according to real build collection/sharing choices.
- [ ] Validate https://g88-legal.onrender.com/privacy and https://g88-legal.onrender.com/delete-account/ from an anonymous non-authenticated browser; GitHub source changes do not update hosted legal pages.
- [ ] Compare form's `collected`, `shared`, `required/optional`, `ephemeral`, `purpose` individually with exact release and hosted policy.
- [ ] Dedicated Terms of Service and UGC acceptance (#592) deployed and audited.
- [ ] Operator moderation workflow with triage owner, incident response and abuse escalation.

## Execution commands (CI/disposable environments)

```bash
pnpm install --frozen-lockfile
pnpm --filter @g88/shared build
pnpm --filter @g88/backend typecheck
pnpm --filter @g88/backend exec eslint src --ext .ts --max-warnings 0
pnpm --filter @g88/backend exec jest --ci --runInBand
pnpm --filter @g88/mobile typecheck
pnpm --filter @g88/mobile exec eslint src --ext .ts,.tsx --max-warnings 0
node apps/backend/scripts/check-migration-prefixes.mjs
```

The Jest migration spec uses `EVENT_REVIEWS_TEST_DATABASE_URL` and creates a disposable schema. **Never set it to production or persistent databases.** GitHub Actions CI job uses a disposable PostgreSQL 16 service; the PostGIS smoke workflow tests full migration replay on disposable PostGIS.

**Sign-off state: NOT READY.** Update evidence column with run URLs, build SHA, screenshot/video and admin/db proof only after executed. Do not infer passing tests from mergeability.

## Child safety escalation (8 Nov 2026 — pending validation)
- New explicit `child_safety` report reason is selectable on all supported Report surfaces, in addition to `sexual`. **Do not treat routine sexual-content cases as automatically confirmed CSAM.**
- Migration `0076_child_safety_report_reason.sql` extends the DB reason enum and adds priority queue index. **Run only in staging after 0070/0073/0074/0075 as applicable; never assume production migration has run.**
- Admin `open` queue orders suspected child exploitation reports before ordinary reports; API deliberately suppresses the associated content text/media URL for those cases, and the admin UI displays an urgent escalation warning. This avoids accidental preview/download in the routine admin list; it is **not a staffed law-enforcement escalation mechanism**.
- QA: submit a child-safety report on a Story, confirm non-duplicate persisted row, high-priority order even when an ordinary report is newer, empty targetCaption/targetMediaUrl in admin response, and warning visible in dashboard. Negative/offline UI must not show false success.
- Owner must designate a child-safety contact, operational procedures, approved public CSAE standards and age-scope decisions before Play certification. See #1071 and draft PR #1076.
- **NO-GO:** CSAM case review/secure escalation, legal obligations, staffing, contact designation, child safety statement publication and real-device test evidence remain missing.

## FINAL owner override (8 November 2026): NEXUS 18+
- Public brand **NEXUS**; `com.g88` unchanged.
- The first launch is **adult-only for all Social**, not just Dating. Dating stays disabled.
- New registration must include DOB; existing and Google-login users need server-verified
  eligibility status before full app access; direct API and Socket.IO bypass blocked.
- API flag `NEXUS_REQUIRE_ADULT_AGE=true` on production is required for adult-only launch;
  default-OFF only for staged compatibility. No Android sign-off without this evidence.
- Age declaration is NOT a document-based independent age verification. Underage accounts
  must retain access to safe deletion, block/report and support paths.
- Target audience: only **18 and over**, enable **Restrict Minor Access**.
- All prior references to Dating-only 18+ in historical QA sections are superseded.

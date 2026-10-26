# Event reviews — #816

Implementation follows the approved host-confirmation and 24-hour editing policy.
Figma source: https://www.figma.com/design/RMlHX3o4P7tHraj0tIGeGv?node-id=3-276

## Flow and limits

1. During an event, its authenticated host opens EventDetail → Attendance and confirms
   existing Going participants. The separate paginated attendance list includes
   participants beyond the 50-person detail preview. Confirmations are idempotent;
   neither retries nor RSVP changes replace their original time/provenance.
2. Reviews open at `endsAt`, or after the host explicitly ends a started event.
   A missing end time never implies completion. Host self-review is forbidden.
3. Confirmed participants whose current RSVP is Going select 1–5 stars and publish.
   Optional fields: up to three distinct tags from the shared allow-list and a
   trimmed plain-text comment of up to 500 Unicode code points.
4. The author may edit until creation + 24 hours, using the database clock. The
   deadline and review identity are immutable. Hiding a review never permits another.

No user-location proof, public numeric trust score, or review analytics payload is
introduced. Public review visibility follows the existing event-access contract
(public events or their host; this does not introduce private-event invitations).
Blocks apply in both directions to event access, review content, reports and averages.
Host-mediated attendance remains susceptible to bias: Help/support is the dispute
route; confirmation is a factual assertion by the host, not independently verified proof.

## API

All event routes use JWT auth and rate limits. Request actors come from auth.

| Method | Route under `/api/v1` | Contract |
| --- | --- | --- |
| GET | `/events/:id/attendance?cursor=&limit=20` | Host-only Going participants and confirmation state |
| POST | `/events/:id/attendance/:userId/confirm` | Host, existing participant, during event; immutable provenance |
| POST | `/events/:id/end` | Host, started event; idempotent explicit completion |
| GET | `/events/:id/reviews/me` | Eligibility, own visible review, server clock |
| POST | `/events/:id/reviews` | `{rating,tags,comment}`; duplicate → `409 review.exists` |
| PATCH | `/events/:id/reviews/me` | Full replacement of editable fields; expiry/unavailable → `409 review.edit_window_closed` |
| GET | `/events/:id/reviews?cursor=&limit=20` | Bounded UUID-keyset page + viewer-visible count/average |
| POST | `/events/:id/reviews/:reviewId/report` | Shared reason allow-list; deduplicated per reporter |
| GET | `/admin/event-reviews/reports?cursor=&limit=20` | JWT + existing AdminGuard; pending visible-review reports |
| POST | `/admin/event-reviews/:eventId/:reviewId/hide` | JWT + AdminGuard; hidden from reads and averages |

Page size is at most 50. Reports use abuse/spam/privacy/attendance_dispute and remain
until review/account/event deletion. Account/event foreign-key cascades remove
associated content; deleting a confirming account clears its provenance FK if the
confirmation survives. An event lock serializes review writes, RSVP, confirmation
and completion; eligibility timing is read after acquiring it. Read-only review and
attendance requests use consistent snapshots without exclusive event-row locks. The SQL update and
trigger enforce the strict edit boundary even after waiting for a lock.

## Rollout and validation

- Apply migration `0051_event_reviews.sql` before deploying the backend; then deploy
  the mobile client. No production migration/deployment is performed by this PR.
- Existing RC3 remains unchanged. This feature needs a subsequent audited candidate.
- Shared/backend/mobile typechecks and focused tests cover field limits, eligibility,
  duplicate-submit prevention, draft recovery, expiry and session teardown.
- `event-reviews.integration.spec.ts` uses a temporary schema in the database named
  by `EVENT_REVIEWS_TEST_DATABASE_URL`; never point it at production. It checks
  concurrent requests, actual constraints/triggers, blocking, pagination, moderation
  and deletion. CI provisions disposable PostgreSQL 16 for these tests.
- Physical-device QA remains required: TalkBack selected/disabled states, large
  text, keyboard scroll/visibility, light/dark/PROTOS NEXUS, host confirmations,
  edit boundary, offline/retry and dismiss/back to the original map context.

The review form uses the current mobile semantic tokens and system typography.
Figma's Inter prototype font is not introduced as a new application font. The star
assets are exact local SVG exports; no temporary Figma URLs are used at runtime.

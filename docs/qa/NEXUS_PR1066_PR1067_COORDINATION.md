# NEXUS Google Play RC1 — PR #1066 ↔ PR #1067 integration handoff

**Coordination point:** 2026-11-07. Repository: `ValentinGanchevA1/general`.
This file documents dependencies between independent implementation streams. It is not an instruction to merge or deploy either draft PR.

## Verified integration graph

- **PR #1064** (merged) — privacy / initial Report User & Story persistence / free-first-release fixes. Keep historical Story abuse reporting (including after Story expiry or a block).
- **PR #1065** (merged) — NEXUS Terms for *legal review only*, not legally approved or published.
- **PR #1067** (open draft, owner: Terms workstream) — versioned Terms acceptance and optional backend UGC enforcement, 0072 migration, frontend gate, tests and legal preview. Do not edit its branch from the #1066 reporting workstream.
- **PR #1066** (open draft, owner: UGC / dating / Data Safety workstream) — additional UGC targets, admin moderation, backend 18+ guard for REST + realtime dating, source Privacy update, Play Data Safety audit. Keep it open and independent of Terms implementation.

## Resolved competing migration numbering

The two draft PRs both initially claimed the 0072 prefix. **PR #1067 owns 0072**. PR #1066 renames its unapplied migrations:

| Order | Filename | Owner |
| --- | --- | --- |
| 0070 | `0070_content_abuse_reports.sql` | merged #1064 |
| 0071 | `0071_coarsen_story_geography.sql` | merged #1064 |
| 0072 | `0072_ugc_terms_acceptance.sql` | pending #1067 |
| 0073 | `0073_extend_content_report_targets.sql` | pending #1066 |
| 0074 | `0074_event_question_moderation.sql` | pending #1066 |
| 0075 | `0075_dating_match_conversation_lookup.sql` | pending #1066 — additive index; supersedes draft 0073 name |

This order reserves 0072 for the main Terms PR and avoids duplicate-prefix CI failure after both PRs land. The newly added Dating conversation index is assigned 0075 so it does not conflict with the earlier #1066 report migration 0073. `scripts/migrate.js` maps its draft `0073_dating_match_conversation_lookup.sql` filename to 0075 if an earlier staging instance already recorded it. Because #1066 is still a draft, the originally named migrations must **never be applied** to staging/production. If either old filename was applied to any persistent database despite the draft state, stop and explicitly reconcile `schema_migrations` before renaming; do not silently replay a migration.

## Merge/deploy sequencing

1. Finish CI, PostgreSQL integration tests, Android build/QA and review for **#1067**; merge into `master` first *when ready*.
2. Let **#1066** target the now-updated `master`, verify diff/mergeability and rerun the full integration and code-quality checks. Resolve any newly introduced conflicts.
3. Merge **#1066** only after its independent CI, data-protection review, report UX device QA, content hiding/read-path checks and the 18+ dating tests pass.
4. Deploy backend/migrations on controlled staging before installing a mobile client with the new report targets. Run `node apps/backend/scripts/check-migration-prefixes.mjs` and disposable full-schema smoke, confirming applied migration order 0070→0071→0072→0073→0074→0075.
5. Publishing approved Terms at `/terms`, setting the version and activating `NEXUS_REQUIRE_UGC_TERMS=true` is a **separate production decision** after legal review and device QA. Default remains OFF. Never treat a merged PR or preview deployment as final legal approval.
6. Source Privacy Policy / Play Data Safety drafts from #1066 **do not publish themselves** to Render or mutate the Play Console form. Validate exact hosted text, production retention of 1:1 live location, AAB manifest/SDKs, and Play answers before sign-off.

## Cross-stream invariants to test

- **Safety reporting must not require Terms acceptance.** JWT-authenticated `POST /api/v1/reports` and administrative review must remain accessible to users even when UGC publishing is blocked by the Terms gate.
- New report targets are `story`, `listing`, `event`, `event_question`, `check_in`, `alert`, `message` and the separately implemented `user` flow. Report User remains owned by #1064.
- Terms gating of UGC mutations must not block reporting, blocking, account deletion, reading approved Terms, or withdrawing a live location session.
- Dating interactions and realtime discovery require both opted-in participants to have an adult-eligible DOB; a client-only age check cannot be sufficient.
- Moderation hiding must remove content from fresh reads and realtime/map surfaces, not just the administrative table.
- The Google Play Data Safety form must truthfully describe **precise location** (including H3 r10), optional **sexual orientation**, uploaded videos and ID documents, and stored live-location session/chat coordinates.

**Handoff status: dependency identified and filenames reserved. No merge, live deployment or Play Console writes authorized by this document.**

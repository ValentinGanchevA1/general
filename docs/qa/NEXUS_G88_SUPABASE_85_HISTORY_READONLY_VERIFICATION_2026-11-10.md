# G88 linked database: verified live read-only migration and privacy inventory

**Date:** 2026-11-10 · **STATUS: P0 NO-GO / not a database-target attestation / not a rollout authorization**.

## Source and identity

Read-only SQL queries were executed through the owner's linked Supabase account **g88** (project **G88**, ref `hmtwlkplyjbskljntdkl`). **This confirms the identity of the SQL-query destination, not the active target of Render `g88-api`'s `DATABASE_URL`.** Render's connector does not expose the production environment value. Do not copy or log database passwords.

- Supabase project reports PostgreSQL **17.6**, `db.hmtwlkplyjbskljntdkl.supabase.co`, database `postgres`, role `postgres`, port `5432`.
- `public.schema_migrations` and `public.users` both exist.
- `public.schema_migrations`: **85 rows, 85 distinct filenames**, earliest `2026-05-23 16:34:10.7304+00`, latest `2026-11-08 08:54:18.018611+00`.
- **All 15 exact missing master filenames are present** with historical timestamps matching the owner's previously supplied snapshot (including 0069 and the duplicate 0072/0073 variants).
- `master` still has **70 checkout SQL files** through `0071`. Render's 2026-11-10 deployment `dep-dbponns9v7es73f8i3s0`, commit `cd42f24987901843de0ae96a01c01bbff2c11d88`, failed because `migration:run` emitted `MIGRATION_HISTORY_DRIFT`, **15 applied filenames not in checkout**, exit 1. Read-only preflight correctly prevented writes. Logs showed shared TypeScript and NestJS webpack compilation **success** before this failure.
- Render `g88` workspace reported **no managed Postgres instances**; actual DB connection may point to the external Supabase project, but this is not yet independently proven. Render `g88-api` Auto Deploy is OFF and PR previews are manual.

## Schema postconditions seen via SELECT metadata

**All 19 queried named relations/indexes exist** in the linked Supabase G88 project. They include:
`realtime_room_revocations`, `realtime_room_revocations_pending`,
`event_attendance_confirmations`, `event_reviews`, `event_review_reports`,
`analytics_external_deletion_requests`, `user_terms_acceptances`,
`personal_labels`, `user_personal_labels`, `personal_label_proposals`,
and the named migration-specific indexes for report priority, personal labels,
dating conversation lookup, and event question visibility.

Additional confirmed metadata:
- `event_review_write` and `analytics_subjects_queue_posthog_delete` exist as **enabled** triggers.
- `enforce_event_review_update` and `queue_posthog_subject_deletion` exist, one overload each, neither `SECURITY DEFINER`.
- The expected `content_abuse_reports_target_type_check` includes `event_question`; reason CHECK includes `child_safety`.
- `user_terms_acceptances.user_terms_version_format` CHECK exists.

**Limit:** object existence is *not* a checksum, a proof of SQL contents at execution time, or an endorsement of the source branches. Some source names were renumbered; old `0051_event_reviews.sql` and current `0052_event_reviews.sql` are demonstrably not byte-identical. Do not replay any SQL from #1066, #1067, #1074, #1060 or 0051/0054.

## Privacy aggregate snapshot (non-PII)

| Metric (active / `deleted_at IS NULL`) | Count |
| --- | ---: |
| Active accounts | **2,440** |
| Accounts missing DOB | **2,395** |
| Missing DOB with visibility other than `private` | **0** |
| Self-declared under-18 and not private | **0** |
| Missing/underage DOB with Dating enabled | **0** |
| Accounts with visibility `public` | **41** |

`public.users.visibility` currently has **`DEFAULT 'public'::text`** (unsafe for omitted values); `date_of_birth` remains nullable. Draft [#1093](https://github.com/ValentinGanchevA1/general/pull/1093) proposes changing the default to private **without rewriting existing profiles**, but no production SQL was run. Existing non-private choice counts do not mean age is identity-verified; DOB is self-declared.

**Implication:** activating whole-Social 18+ for existing sessions without an eligible-account bootstrap will restrict many accounts. The code still requires safe legacy enrollment, OAuth and release/device QA (#1095, #1096, #1068). Dating OFF is separately unproven in deployed AAB.

## New controlled read-only Render-side check

New script `apps/backend/scripts/db-target-attestation.cjs` uses the **actual runtime `DATABASE_URL`** on the host where it is run, prints **nonsecret** host, port, database, user and a digest excluding password, opens a PostgreSQL **READ ONLY REPEATABLE READ** transaction, checks current database/role and all applied migration filenames against the 85-row fixture, and **ROLLBACKS**. The CLI **always exits 2**, even on matching evidence, because this is not deployment authorization. The script never prints raw URI/credentials or performs SQL DDL/DML.

Only from a **controlled, authorized shell** with correct environment (prefer isolated staging first):
```bash
node apps/backend/scripts/db-target-attestation.cjs
# exit code 2 is intentional; do NOT use this as a deploy-success test.
```

A matching snapshot from the same Render-side env will establish that the service connects to the *same history*, but it still will not prove original SQL content, consistent user permissions, or a valid restore. If shell is unavailable, owner must privately compare the Render environment's nonsecret host/port/db/user against the Supabase G88 project, accounting for connection-pooler host/user differences; **do not paste the full DATABASE_URL**.

## Immutable safety gates before repair

1. Obtain independent Render DB-target evidence and production snapshot; monitor for concurrent writes, because this is a live account database.
2. Obtain a verified **restorable backup**; restore onto a truly **isolated** Postgres staging instance; isolate Redis, storage, OAuth and outbound notifications too. Supabase reported only the `main` branch and no staging branch. **Creating a Supabase branch can incur hourly charges and does not carry production data by default**; do not confuse schema-only branch with a restored production backup.
3. Recover historical source SQL with reliable GitHub commit/hash proofs for all 15, especially 0051, 0054, 0069, 0077 and duplicate-numbered migrations. Compare catalog postconditions and data/constraint effects on restored staging.
4. Develop a reviewed **forward-only** reconciliation of the actual schema, rather than renaming/deleting/stamping tracker rows or adding blind filename aliases.
5. Preserve the 0077 adult privacy invariant and test new-default-private 0078 in staging; preserve valid existing opt-in public choices.
6. Prove two-node Socket.IO room revocation, mobile 18+ bootstrap, release APK/device QA and whole-app Dating OFF before a production deployment.
7. Get explicit approval for an exact deploy SHA, backup restore/rollback proof, maintenance window and owner sign-off.

**Actions in this audit:** read-only Supabase SQL, Render read-only logs, GitHub Draft audit PR scripts/tests/docs only. **No Supabase branch creation, production migration, history rewrite, secrets or Render environment changes.**

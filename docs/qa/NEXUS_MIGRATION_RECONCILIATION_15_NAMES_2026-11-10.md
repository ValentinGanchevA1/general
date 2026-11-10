# NEXUS — Migration history reconciliation: 85 rows / 15 unmatched

**Status: DRAFT / P0 NO-GO. No production SQL, no metadata updates, no migration bypass.**
This is an **offline evidence + tests** change only. It does not make Render deployable.

## Scope and trust boundary

- The user supplied 85 filename rows from `public.schema_migrations` on 2026-11-10. The full non-PII filenames are preserved in `apps/backend/scripts/fixtures/migration-history-owner-20261110.txt`.
- GitHub `master` at `3e533639488ab0fb81a1728f308e77242637eb9f` has 70 SQL migration files ending at `0071`. Exactly **15** applied names are absent from that checkout.
- The user-supplied database is **not independently proven to be the DATABASE_URL target of the live Render g88-api service**. The snapshot is evidence, not a production attestation.
- `migration-history-guard.js` intentionally rejects drift before writes. Keep it enabled and unchanged.
- `migration-reconciliation-report.cjs` reads **local files only**: repo migration filenames and this snapshot. It has no PostgreSQL client, environment-variable access, or network call. It **always exits 2** to keep release blocked even on an exact snapshot match; tests execute the pure helper and must succeed.

### Evidence categories (15)

| Count | Names | Assessment |
| --- | --- | --- |
| 3 | `0036_trade_offer_counter`, `0037_conversation_kind_members`, `0038_user_strikes` | Historical SQL bodies checked against current successors; only filename header differs. Still requires actual DB/provenance verification. |
| 2 | `0051_event_reviews`, `0054_posthog_deletion_queue` | Likely historical versions of current `0052` and `0062` respectively; exact historical SQL source **not verified**. |
| 1 | `0069_realtime_room_revocation_outbox` | Present in Draft #1060 (earlier #1055), absent from master, reported applied at 2026-11-06 09:06 UTC. Runtime activation/provenance unknown. |
| 9 | Three 0072, two 0073, one each 0074–0077 | Draft #1066/#1067/#1074 family; seven distinct candidate SQL bodies across nine tracker names, including identical source blobs under renamed filenames. No proof of exact DB execution. |

Historical source/evidence: `docs/qa/NEXUS_PRODUCTION_MIGRATION_DRIFT_READONLY_REHEARSAL_2026-11-10.md`.

**Important difference:** GitHub commit [`1ccacd9`](https://github.com/ValentinGanchevA1/general/commit/1ccacd9ea9d887c6ac698fffdc4be42bfb919b23) (PR #818) contains an older `0051_event_reviews.sql` with non-repeat-safe `CREATE TABLE` / `CREATE TRIGGER` statements. The current `0052_event_reviews.sql` (hardened in PR #823) uses `IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, and `CREATE OR REPLACE FUNCTION`. They are **not byte-identical**, and the DB tracker alone does not establish which SQL version was actually executed. Treat this as a required schema/provenance check, not an alias safe to auto-accept.

Renaming commits for first three: `b89e6b37`, `cf5858c5`, `12c672b4`; original commit `a3f8c2dd`.

## Local offline verification

From repository root:

```bash
node --test apps/backend/scripts/migration-reconciliation-report.test.cjs
node apps/backend/scripts/migration-reconciliation-report.cjs
# Second command intentionally returns code 2 (release BLOCKED).
```

The test requires 85/70/15, the **exact** 15 historical filenames, seven duplicate numeric-prefix groups, and no `master` file absent from the supplied history. An unlisted `0099_*.sql` must be classified `UNKNOWN_UNRECOGNIZED`, not accepted.
It also checks that the **actual existing migration guard** fails with `MIGRATION_HISTORY_DRIFT` before any write when given all 85 owner-supplied filenames.

**Do not** add these 15 filenames to an unconditional `legacyAliases` array or infer a migration was applied from a table name. This report is not a checksum oracle or permission to bypass the migration runner.

## Required read-only evidence before a repair that changes runtime behavior

1. Independently compare Render g88-api's actual PostgreSQL **host/port/database/user** against the SQL connection used for the owner snapshot, privately. Never share `DATABASE_URL`, passwords, access tokens or individual users' data.
2. Obtain verified production backup with a **tested restore** into isolated PostgreSQL staging. Confirm previews cannot reach production PostgreSQL, Redis, object storage or outbound accounts.
3. Re-run the 85-row history inventory in `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` using a read-only-capable connection. Compare timestamps and names. Check actual SQL postconditions and source hashes, especially the two older, unverified files.
4. For 0069, check the existence and definitions of `realtime_room_revocations` and `realtime_room_revocations_pending`. Confirm the outbox activation flag remains OFF until independently approved.
5. Preserve the 0077 adult-privacy effects; do **not** republish users without DOB or known ineligible users. The observed `users.visibility DEFAULT 'public'` is a separate P0 remediation that requires a verified, staged change.
6. Design a narrowly scoped **forward-only** resolution with an independently reviewable mapping and proof of already-applied effects. Run it on restored staging first. Do not erase, rename, or reinsert tracking rows merely to satisfy checks.
7. Require owner sign-off for a specific production deployment SHA, migration plan, rollback window and post-deployment REST/Socket.IO checks.

### Safe PostgreSQL read-only check for the 0069 outbox

**Only after independently confirming DB identity.** Execute in a SQL editor with read-only privileges:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('transaction_read_only') AS read_only;
SELECT filename, applied_at FROM public.schema_migrations
WHERE filename = '0069_realtime_room_revocation_outbox.sql';
SELECT to_regclass('public.realtime_room_revocations')::text AS outbox_table,
       to_regclass('public.realtime_room_revocations_pending')::text AS pending_index;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'realtime_room_revocations'
ORDER BY ordinal_position;
COMMIT;
```

## Merge / deployment decision

- **Do not merge this Draft PR until human review and CI are green.** This is an inventory improvement, not a deploy fix.
- Do not automatically run production migrations at build time or retry the failed Render deploy to test the guard.
- Do not remove the guard or make it accept these names solely based on matching the offline snapshot.
- **CI success does not certify staging or production compatibility**; keep release **NO-GO** pending verification and explicit authorization.

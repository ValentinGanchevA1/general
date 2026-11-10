# NEXUS — production migration drift: read-only audit and isolated rehearsal

**Status:** P0 / NO-GO. This runbook does **not** authorize production SQL writes, Render deployment, preview activation, or migration tracker edits.

## Grounded observations (2026-11-10)

- Production `g88-api` is on Render. Read-only Render inspection reports production `autoDeploy=no`, `autoDeployTrigger=off`; the configured build nevertheless includes `pnpm --filter @g88/backend migration:run`. The operator who disabled Auto Deploy is not established.
- The last confirmed *live* production deploy was `dep-dbp80rvavr4c73edbolg`, commit `411dd1538f389dcfe59bc68f6f20e1f24792df78`. GitHub master has subsequently advanced; a merged commit is **not** proof it is deployed.
- An owner-run read-only production Supabase audit reported **9 applied migration filenames in the 0072–0077 range**, including duplicate version-prefix families 0072 and 0073. The `master` migration directory ends at `0071`. This mismatch has NOT been repaired.
- Migration `0077_adult_only_rc1_visibility.sql` was applied to production on 2026-11-08. Its adult-privacy update must NOT be automatically reversed; restoring public visibility to DOB-null/underage users is unsafe.
- Fourteen existing Render PR preview services were last reported `suspended`, but all retained automatic deploy settings. Existing preview resource identity and isolation are **not** proven by suspension alone.
- [PR #1087](https://github.com/ValentinGanchevA1/general/pull/1087) merged into master at `eb946d09a172fee8116f63baca0774c73e7ec5d3`. Its migration runner rejects applied filenames absent from the checkout before issuing any SQL writes.

## Current Render workspace inventory (read-only verification)

On 2026-11-10, the connected Render workspace `tea-d87btoog4nts73domv40` returned **17 services**: production `g88-api` (`srv-d8d8ujojs32c73fb1gfg`), 14 suspended `g88-api PR #...` previews, the `g88-legal` static site and `nexa-web-pr-578`. All 14 existing PR preview services retained `autoDeploy=yes`. Production `g88-api` reports `autoDeploy=no`, `autoDeployTrigger=off`, and preview generation `manual`.

**No independently named backend staging service was visible in this workspace.** This is not evidence that separate staging infrastructure does not exist in another account or provider. The DB target, Redis target, storage target, secrets and actual backup/restore capability were not inspected and therefore remain unknown. The `nexa-web-pr-578` service must not be assumed to be an isolated backend staging environment.

**Critical separation:** The latest verified *live* Render deploy remains `dep-dbp80rvavr4c73edbolg` on commit `411dd153...`; the newer `master` SHA `eb946d09...` includes merged PR #1087 but has **not** been proven deployed. Disabling Auto Deploy reduces accidental release risk; a manual deployment still runs `migration:run` unless its build command is changed through an approved rollout plan.

## A. Read-only target identification

1. In Render, open production `g88-api` and the intended, separately provisioned **staging** service. Record only non-secret Postgres **host, port, database name and database user** and independently provisioned Redis/storage destinations. **Do not copy credentials, JWTs, OAuth secrets or connection strings into GitHub/issues/chat.**
2. In **each** target's authenticated SQL editor, run the following only if the environment and DB identity have first been confirmed. Do not substitute a preview's inherited production URL for staging.
3. Copy the returned non-secret metadata to the evidence checklist; keep server addresses internal if company policies require.

```sql
BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS database_name,
  current_user AS database_role,
  inet_server_addr() AS server_address,
  inet_server_port() AS server_port,
  current_setting('transaction_read_only') AS read_only;

SELECT
  filename,
  applied_at
FROM public.schema_migrations
ORDER BY filename;

SELECT
  COUNT(*) FILTER (WHERE filename >= '0072_') AS applied_from_0072,
  COUNT(DISTINCT substring(filename FROM '^[0-9]{4}')) FILTER
    (WHERE filename >= '0072_') AS distinct_prefixes_from_0072
FROM public.schema_migrations;

SELECT
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('date_of_birth', 'visibility', 'open_to_dating')
ORDER BY column_name;

COMMIT;
```

`SELECT` contains migration filenames and target metadata only. **Do not export users/IDs/DOB/photo/phone/email rows.** If the tracker table is absent, stop and record that; do not create it.

### Nine production tracker records — recovered from the owner's 2026-11-09 read-only output

These are the **original owner-supplied** `filename`/`applied_at` values (UTC), **not a new query** in this turn. Each Git blob below is a matched historical source candidate; the tracker does not itself certify SQL checksums or the exact deployed commit.

| Applied at (UTC) | Tracker filename | Git SQL blob SHA | Candidate source |
| --- | --- | --- | --- |
| 2026-11-07 16:47:19.261582 | `0072_ugc_terms_acceptance.sql` | `818af7aef1afb495dc496e85a38219977a99d422` | #1066 / #1067 |
| 2026-11-07 17:02:09.443726 | `0072_extend_content_report_targets.sql` | `b6cd7ba8fb740f65fa3a84ef42ff31205baa11a2` | #1066, old name at `fb79c8fe` |
| 2026-11-07 17:02:09.599954 | `0073_event_question_moderation.sql` | `92d66c3abe6b73a7ce779869d839d8c6e6752661` | #1066, old name at `fb79c8fe` |
| 2026-11-07 17:17:15.754453 | `0073_extend_content_report_targets.sql` | `b6cd7ba8fb740f65fa3a84ef42ff31205baa11a2` | #1066, renamed at `528e4bf4` |
| 2026-11-07 17:17:15.893573 | `0074_event_question_moderation.sql` | `92d66c3abe6b73a7ce779869d839d8c6e6752661` | #1066, renamed at `528e4bf4` |
| 2026-11-08 02:35:28.838706 | `0072_personal_labels.sql` | `dd08626c763b3b2b519a998938623e5423d5c522` | #1074, preview commit `7ba6777c` |
| 2026-11-08 06:56:36.794158 | `0075_dating_match_conversation_lookup.sql` | `9a2a4ce98d858724bf2be3014249824301a930c2` | #1066 |
| 2026-11-08 08:22:41.174796 | `0076_child_safety_report_reason.sql` | `e6618f99d54e5f15e5af7f63f112448c3a7a2b5d` | #1066 |
| 2026-11-08 08:54:18.018611 | `0077_adult_only_rc1_visibility.sql` | `17653579249598c4783212d0bdbc63dae8698be5` | #1066 |

**Rename evidence:** [Commit `fb79c8fe`](https://github.com/ValentinGanchevA1/general/commit/fb79c8feaa59062a9d4fd3bc786219344ce293d9) has `0072_extend_content_report_targets.sql` and `0073_event_question_moderation.sql`. [Commit `528e4bf4`](https://github.com/ValentinGanchevA1/general/commit/528e4bf4b15a2609331c50fc5766ab364c61a1e9) has `0073_extend_content_report_targets.sql` and `0074_event_question_moderation.sql` with **identical blob IDs**. One SQL body drops/recreates a reporting CHECK constraint; the other has `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. These statements allow reapplication in ordinary cases, **not a proof of no lock, data or state impact in production**.

#### Read-only schema inspection of the renamed operations

```sql
BEGIN TRANSACTION READ ONLY;
SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
JOIN pg_class AS t ON t.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'content_abuse_reports'
  AND c.conname = 'content_abuse_reports_target_type_check';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_questions'
  AND column_name = 'deleted_at';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_questions'
  AND indexname = 'event_questions_visible_event_idx';
COMMIT;
```

**Never delete, renumber or collapse those nine production `schema_migrations` rows.** Historical tracker identity, exact deploy-to-DB lineage and an isolated backup restoration still need independent evidence.

### GitHub SQL candidates

Read-only GitHub tree inspections identify these **candidate SQL files** on historical PR heads:

| PR | Exact source commit | Migration filename | Git blob SHA |
| --- | --- | --- | --- |
| [#1066](https://github.com/ValentinGanchevA1/general/pull/1066) | `d3b13a89ba68c536fd6d1c7266426632f7b5503f` | `0072_ugc_terms_acceptance.sql` | `818af7aef1afb495dc496e85a38219977a99d422` |
| #1066 | same | `0073_extend_content_report_targets.sql` | `b6cd7ba8fb740f65fa3a84ef42ff31205baa11a2` |
| #1066 | same | `0074_event_question_moderation.sql` | `92d66c3abe6b73a7ce779869d839d8c6e6752661` |
| #1066 | same | `0075_dating_match_conversation_lookup.sql` | `9a2a4ce98d858724bf2be3014249824301a930c2` |
| #1066 | same | `0076_child_safety_report_reason.sql` | `e6618f99d54e5f15e5af7f63f112448c3a7a2b5d` |
| #1066 | same | `0077_adult_only_rc1_visibility.sql` | `17653579249598c4783212d0bdbc63dae8698be5` |
| [#1074](https://github.com/ValentinGanchevA1/general/pull/1074) | `7ba6777c8b64ef7d78eebb23e947ccee636eea6b` | `0072_personal_labels.sql` | `dd08626c763b3b2b519a998938623e5423d5c522` |

The owner's earlier read-only production snapshot contains **nine named migration records**. They can now be mapped to **seven distinct historical Git SQL blobs**: two extra filename records came from renumbering (0072→0073 and 0073→0074) while preserving the SQL blob byte-for-byte. This reconstructs source candidates, **not** the exact deployed Git revision or current schema. Verify the tracker again and inspect schema postconditions read-only.

### Potential migration impacts, assessed from GitHub SQL text only

| Filename (candidate source) | Statement class | Main risk to verify before rehearsal |
| --- | --- | --- |
| `0072_ugc_terms_acceptance.sql` (#1066/#1067, identical blob) | CREATE TABLE, COMMENT | Versioned acceptance records, FK and uniqueness constraints |
| `0072_personal_labels.sql` (#1074) | CREATE TABLE/INDEX, INSERT | Catalog data inserted; possible prefix collision with 0072 UGC file |
| `0073_extend_content_report_targets.sql` (#1066) | ALTER TABLE constraint | Existing report rows must satisfy replacement constraint |
| `0074_event_question_moderation.sql` (#1066) | ALTER TABLE, CREATE INDEX | Moderation visibility semantics |
| `0075_dating_match_conversation_lookup.sql` (#1066) | CREATE INDEX | Lock/duration and partial index coverage |
| `0076_child_safety_report_reason.sql` (#1066) | ALTER TABLE, CREATE INDEX | Preserve/report sensitive child-safety categories |
| `0077_adult_only_rc1_visibility.sql` (#1066) | UPDATE users | **Potentially large irreversible history-loss of prior visibility state**; do not re-publicize DOB-null users |

The two earlier 0072/0073 names have now been found at PR #1066 commit `fb79c8feaa59062a9d4fd3bc786219344ce293d9`, and their Git blobs match the renamed versions at commit `528e4bf4b15a2609331c50fc5766ab364c61a1e9`. The matching #1066/#1067 `0072_ugc_terms_acceptance.sql` blob `818af7aef1afb495dc496e85a38219977a99d422` is one source version, not another migration. Source identity does not establish exact deployment provenance or a production schema postcondition.

## B. Compare the actual applied migration files

- From the exact GitHub SHA of the build/deployment being audited, enumerate `apps/backend/migrations/*.sql` and SHA-256 hash each version-controlled file. Compare the set of filenames against **the separate production tracker snapshot**, not a guessed current branch.
- For each of the 9 historical `0072`–`0077` filenames, locate the **exact SQL file content at the commit that ran the migration**, and record: originating PR, commit SHA, SQL blob SHA/hash, deploy ID/time, statement classification (DDL, DML, UPDATE users), row-count/lock impact, reversible/non-reversible effects and sensitive-data risks.
- If SQL cannot be retrieved or hashed reliably, mark it **unknown**. Do not invent a matching file or treat a renamed prefix as the same migration automatically.
- Never `DELETE`, `UPDATE` or `INSERT` rows in `schema_migrations` to make the tracker look clean. Never execute `migration:run` against production merely to test this guard.

### Preview execution evidence

The [Render build for #1074](https://dashboard.render.com/web/srv-dbntvje8bjmc73alecf0/deploys/dep-dbntvju8bjmc73aled60) built commit `7ba6777c8b64ef7d78eebb23e947ccee636eea6b`. Its build log records `Running migration: 0072_personal_labels.sql` at 02:35:28.827 UTC on 2026-11-08 and `Done.` at 02:35:29.086 UTC. The [SQL at the deployed revision](https://github.com/ValentinGanchevA1/general/blob/7ba6777c8b64ef7d78eebb23e947ccee636eea6b/apps/backend/migrations/0072_personal_labels.sql) has the same Git blob as the later PR head `b15a49ab938a42c4b35961007deb53d459c1407a`. The production tracker snapshot is required to tie the preview execution to the database that holds the nine reported entries.

The earliest visible source for `0077_adult_only_rc1_visibility.sql` is [commit `1794c415`](https://github.com/ValentinGanchevA1/general/commit/1794c415141018a54d57ce7448fd63754f0d0a06). Its blob matches the #1066 head listed above. The deployed revision for that migration is unverified.

### Local rehearsal (2026-11-10)

1. Applied 70 baseline migrations from [master at `eb946d09`](https://github.com/ValentinGanchevA1/general/commit/eb946d09a172fee8116f63baca0774c73e7ec5d3) through `0071` to disposable PostgreSQL 17.11 with PostGIS 3.5. Applied the seven candidate SQL files by verified Git blob in separate transactions with synthetic accounts.
2. Confirmed catalog, Terms, event moderation, Dating index and reporting schema postconditions. Migration `0077` matched all seven visibility and Dating fixtures, including a user exactly 18 years old. The `users.visibility` column default was `'public'::text` after the replay.
3. Ran the master migration runner on a read-only connection. It exited `1` with `MIGRATION_HISTORY_DRIFT` for the seven candidates. PostgreSQL recorded exactly two statements from the runner, both `SELECT`. Schema and tracker fingerprints matched before and after.
4. Ran the [Synthetic Monitor change from #1089](https://github.com/ValentinGanchevA1/general/pull/1089) against local NestJS and Redis with `NEXUS_REQUIRE_ADULT_AGE=true`. All five steps passed, including private-profile HTTP 404, explicit visibility opt-in HTTP 200 and Socket.IO reply promotion.

SQL SHA-256 from the exact bytes used in the local rehearsal

```text
d7db0f1a7e7fe99d52246519ec49de06ec5aacd93ef4d96440117443e2156129  0072_personal_labels.sql
e62888454e6f2eec3cdd1554b61c5598369d498f7636a85ab5ae381149035625  0072_ugc_terms_acceptance.sql
3a9d988ae31a8961856c623eee68c68525cdf9122e0868f0ee79b40dbec0d33c  0073_extend_content_report_targets.sql
4e00292888405cac9083d73bdfbed69717d81a6d68f185df1e1e40ccb1d07910  0074_event_question_moderation.sql
f31565f16844fd6f4ed3588b019a9ada8b530df4024acb9afc683e1f632db70b  0075_dating_match_conversation_lookup.sql
3d84d4b3d87df4881696c384e10799e23c7a3ed5bc6f007920403dc00c92ca1f  0076_child_safety_report_reason.sql
491d2685420220ce4e949f6bad0823e2b369b48f3af12c1d04de9f69828a4e3b  0077_adult_only_rc1_visibility.sql
```

The rehearsal covered seven unique SQL bodies and synthetic data. The nine tracker rows were recovered from earlier owner-supplied production output; the full gate still requires a refreshed read-only tracker result, deploy/DB lineage, sanitized restore and independently verified hosted staging.

### Local archive restore with the nine historical tracker entries

Two loopback PostgreSQL 17.11/PostGIS instances used distinct roles and synthetic profiles. The source ran 70 baseline migrations and all nine historical names in timestamp order, including both pre-rename pairs. The source files matched the seven distinct Git blobs above byte for byte. The restore used the migration runner from [#1090 at `5891078b`](https://github.com/ValentinGanchevA1/general/commit/5891078b58eafc2d172f44973a6b6406f6777a09).

| Restore case | Migration runner result | PostgreSQL and data checks |
| --- | --- | --- |
| Full custom archive | `MIGRATION_HISTORY_DRIFT` for nine filenames, exit 1 | Exactly two `SELECT` statements. All 79 tracker rows, seven visibility and Dating fixtures, and three reporting and moderation schema checks matched before and after restore and guard execution. |
| Schema-only restore of the same archive | `MIGRATION_HISTORY_UNTRACKED`, exit 1 | Exactly three `SELECT` statements. The restored tracker had zero rows before and after guard execution. |

The full restore changed how PostgreSQL serialized casts in `analytics_events_event_name_check`. Both databases accepted the same seven event names, rejected an invalid value, and retained `NOT NULL` on `event_name`. The rest of the schema dump matched. The synthetic tracker SHA-256 was `2a2757a391e0d3527e823a45c73d36dd9007a6cce741a0689d10e71d471fff59` before restore and after the guard.

The SQL inventory below also passed on the restored fixture. It reported `read_only=on`, the nine historical rows and zero violations in each of the three eligibility aggregates. The production tracker refresh and restore of a sanitized production backup in verified hosted staging remain pending.

### One-pass, non-PII production schema postcondition inventory

Use the [dedicated read-only SQL file](./NEXUS_PRODUCTION_SCHEMA_POSTCONDITIONS_READONLY_2026-11-10.sql) **only after verifying the production database identity independently**. It runs a repeatable-read, read-only transaction and returns:

1. All historical `0072`–`0077` `filename` / `applied_at` values (compare with the original nine-entry owner snapshot above).
2. Existence of Terms, Personal Labels and moderation tables and indexes; definitions of reporting CHECK constraints, age-related columns and partial indexes.
3. **Aggregate-only** privacy risks: DOB missing + non-private, declared-underage + non-private, ineligible dating-enabled, and total public profiles; no user row identifiers.
4. `users.visibility` DB default, which was previously confirmed as `'public'::text` and remains a separate P0 issue until proven changed.

**Interpretation:** all expected schema objects present is necessary but not proof of migration SQL version, deploy provenance, staging isolation, or identity verification. If an object is absent, do not run a migration to fix it without staged restore and owner approval. If DOB-null public profiles remain, prioritize privacy containment with an explicit approved change. Record only non-secret metadata and aggregate numbers.

## C. Isolated staging rehearsal — required evidence

1. **Back up production using the managed provider's documented backup/snapshot workflow.** A successful backup job is not evidence of restoration until tested. Use a separately controlled database and least-privilege role for restore.
2. Restore a sanitized copy into a **new isolated staging DB** (not a Render PR child whose DB identity matches production). Disable real outbound email, push, SMS, Stripe, OAuth callbacks, and customer notifications in staging. Provision separate Redis and storage buckets.
3. On the staging clone, verify DB identity using section A. Reproduce the **applied migration tracker state** and current schema faithfully; document differences. Use synthetic identities and redacted logs.
4. With the merged #1087 migration runner, run the **read-only drift preflight** on the isolated clone. Expected: `MIGRATION_HISTORY_DRIFT` and **zero SQL writes**. This must be supported by query evidence or an audited test harness.
5. Compare **actual** 0072–0077 migration effects and determine a controlled forward-only reconciliation plan; no replay or rollback of the adult-privacy update without explicitly tested privacy invariants.
6. Only after matching history and schema, run the reviewed migration runner in **staging**, verify all DDL/DML postconditions, 18+ privacy invariants, old accounts, email/Google auth, all REST and Socket.IO paths and multi-node revocation.
7. Record backup restore evidence, plan/rollback, resource isolation, GitHub SHA, CI run IDs and staging QA. Obtain explicit sign-off before considering any production rollout.

## D. Release and merge gate

| Condition | Required evidence |
| --- | --- |
| Production Auto Deploy | `no`/off verified at the point of merge and again before planned rollout |
| All existing PR previews | `suspended` and auto-build/restart behavior explicitly controlled; DB, Redis, storage and outbound isolation demonstrated |
| Schema history | Nine tracker records refreshed read-only; seven unique historical Git SQL blobs cross-checked against source and actual schema postconditions; executed deploy SHA/DB identity verified |
| Database safety | Production backup **and isolated restore** test completed; privacy-preserving forward plan |
| Staging | Independent PostgreSQL/Redis/storage, synthetic identities, migration and 18+ QA passes |
| #1087 | Guard CI successful; staging confirms drift rejection before any SQL mutation |
| Approval | Owner explicitly approves the production deployment and rollback window |

**If any required evidence is missing, release = NO-GO.** Keep `NEXUS_REQUIRE_ADULT_AGE` rollout OFF until app and backend checks are verified. In particular, the SQL column default `users.visibility='public'` remains a separate security issue, even if application registrations explicitly set `private`.

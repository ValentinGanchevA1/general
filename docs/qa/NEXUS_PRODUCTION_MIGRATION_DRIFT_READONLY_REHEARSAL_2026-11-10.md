# NEXUS — production migration drift: read-only audit and isolated rehearsal

**Status:** P0 / NO-GO. This runbook does **not** authorize production SQL writes, Render deployment, preview activation, or migration tracker edits.

## Grounded observations (2026-11-10)

- Production `g88-api` is on Render. Read-only Render inspection reports production `autoDeploy=no`, `autoDeployTrigger=off`; the configured build nevertheless includes `pnpm --filter @g88/backend migration:run`. The operator who disabled Auto Deploy is not established.
- The last confirmed *live* production deploy was `dep-dbp80rvavr4c73edbolg`, commit `411dd1538f389dcfe59bc68f6f20e1f24792df78`. GitHub master has subsequently advanced; a merged commit is **not** proof it is deployed.
- An owner-run read-only production Supabase audit reported **9 applied migration filenames in the 0072–0077 range**, including duplicate version-prefix families 0072 and 0073. The `master` migration directory ends at `0071`. This mismatch has NOT been repaired.
- Migration `0077_adult_only_rc1_visibility.sql` was applied to production on 2026-11-08. Its adult-privacy update must NOT be automatically reversed; restoring public visibility to DOB-null/underage users is unsafe.
- Fourteen existing Render PR preview services were last reported `suspended`, but all retained automatic deploy settings. Existing preview resource identity and isolation are **not** proven by suspension alone.
- [Draft PR #1087](https://github.com/ValentinGanchevA1/general/pull/1087) makes `migration:run` refuse a database containing applied filenames missing from the current checkout, before SQL writes. Successful CI is NOT a production rehearsal.

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

## B. Compare the actual applied migration files

- From the exact GitHub SHA of the build/deployment being audited, enumerate `apps/backend/migrations/*.sql` and SHA-256 hash each version-controlled file. Compare the set of filenames against **the separate production tracker snapshot**, not a guessed current branch.
- For each of the 9 unknown `0072`–`0077` filenames, locate the **exact SQL file content at the commit that ran the migration**, and record: originating PR, commit SHA, SQL blob SHA/hash, deploy ID/time, statement classification (DDL, DML, UPDATE users), row-count/lock impact, reversible/non-reversible effects and sensitive-data risks.
- If SQL cannot be retrieved or hashed reliably, mark it **unknown**. Do not invent a matching file or treat a renamed prefix as the same migration automatically.
- Never `DELETE`, `UPDATE` or `INSERT` rows in `schema_migrations` to make the tracker look clean. Never execute `migration:run` against production merely to test this guard.

## C. Isolated staging rehearsal — required evidence

1. **Back up production using the managed provider's documented backup/snapshot workflow.** A successful backup job is not evidence of restoration until tested. Use a separately controlled database and least-privilege role for restore.
2. Restore a sanitized copy into a **new isolated staging DB** (not a Render PR child whose DB identity matches production). Disable real outbound email, push, SMS, Stripe, OAuth callbacks, and customer notifications in staging. Provision separate Redis and storage buckets.
3. On the staging clone, verify DB identity using section A. Reproduce the **applied migration tracker state** and current schema faithfully; document differences. Use synthetic identities and redacted logs.
4. With the draft #1087 code, run the **read-only drift preflight** on the isolated clone. Expected: `MIGRATION_HISTORY_DRIFT` and **zero SQL writes**. This must be supported by query evidence or an audited test harness.
5. Compare **actual** 0072–0077 migration effects and determine a controlled forward-only reconciliation plan; no replay or rollback of the adult-privacy update without explicitly tested privacy invariants.
6. Only after matching history and schema, run the reviewed migration runner in **staging**, verify all DDL/DML postconditions, 18+ privacy invariants, old accounts, email/Google auth, all REST and Socket.IO paths and multi-node revocation.
7. Record backup restore evidence, plan/rollback, resource isolation, GitHub SHA, CI run IDs and staging QA. Obtain explicit sign-off before considering any production rollout.

## D. Release and merge gate

| Condition | Required evidence |
| --- | --- |
| Production Auto Deploy | `no`/off verified at the point of merge and again before planned rollout |
| All existing PR previews | `suspended` and auto-build/restart behavior explicitly controlled; DB, Redis, storage and outbound isolation demonstrated |
| Schema history | All 9 unknown migration files identified and reviewed with their original code revisions |
| Database safety | Production backup **and isolated restore** test completed; privacy-preserving forward plan |
| Staging | Independent PostgreSQL/Redis/storage, synthetic identities, migration and 18+ QA passes |
| #1087 | Guard CI successful; staging confirms drift rejection before any SQL mutation |
| Approval | Owner explicitly approves the production deployment and rollback window |

**If any required evidence is missing, release = NO-GO.** Keep `NEXUS_REQUIRE_ADULT_AGE` rollout OFF until app and backend checks are verified. In particular, the SQL column default `users.visibility='public'` remains a separate security issue, even if application registrations explicitly set `private`.

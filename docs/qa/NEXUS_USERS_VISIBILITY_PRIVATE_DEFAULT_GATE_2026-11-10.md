# NEXUS RC1 — users.visibility default private (P0, staging-only proposal)

**DRAFT / NO-GO for merge or production migration.** Owner approval, verified DB identity, backup+restore and migration-history reconciliation are required first.

## Evidence and scope
- The initial schema in `apps/backend/migrations/0001_initial.sql` declares `users.visibility DEFAULT 'public'`.
- The linked Supabase G88 SQL inspection on 2026-11-10 likewise reported `users.visibility DEFAULT 'public'::text`. The 85-row history matches the failed Render drift count, but Render `DATABASE_URL` target identity is **not independently attested**.
- Current application registration paths explicitly create accounts with `visibility='private'`, but this cannot guarantee safety for other SQL writers, imports, seed jobs or future features that omit the column.
- Verified G88 read-only aggregate of 2,440 active users had **zero** missing-DOB profiles with non-private visibility, but did include 41 active public profiles. These are snapshot aggregates, not proof of production scope or ongoing compliance.

## Proposed change
One forward-only SQL migration, `0078_users_visibility_private_default.sql`:

```sql
ALTER TABLE public.users ALTER COLUMN visibility SET DEFAULT 'private';
```

- Changes only the **default for future inserts**; does **not** overwrite any existing user's choice or state, alter adult eligibility, grant access or change historical migration metadata.
- Setting the default again is repeat-safe; it does not authorize executing the migration twice against production.
- PostgreSQL `ALTER TABLE` briefly takes a relation lock: schedule a controlled window and inspect lock contention in staging first.
- The filename `0078` is **provisional**; coordinate with draft 0072–0077 workstreams (#1066, #1067, #1074) before using it in any approved deployment.

## Isolated integration coverage
`migration-history-guard.pg.test.cjs` uses an ephemeral PostgreSQL database in GitHub Actions only:
1. Create synthetic users with a historical public default.
2. Insert one public opt-in and one private profile.
3. Execute new `0078` SQL, repeat it to verify idempotent metadata change.
4. Insert a user without specifying visibility → private.
5. Verify existing public/private rows remain unchanged; `information_schema` default is private; migration tracker was not created.

## Explicitly unresolved blockers
- **15 applied migration names not in master**. `migration-history-guard.js` must continue to fail closed; do **not** add aliases, manually stamp, delete or rename tracker rows to get this DDL executed.
- Independent Render `DATABASE_URL` DB-host/database/user identity verification against the owner SQL editor is outstanding. Do not print secrets.
- Restore a genuine backup to **isolated** staging, re-run the 85-row inventory, verify source SQL hashes/postconditions (especially legacy 0051/0054, 0069 and adult safety 0077).
- Parent Render `autoDeploy=no`, but build command still invokes `migration:run`. Manual deploy/merge is NOT authorized by this PR.
- Adult-only first-release requirement (#1068) is **whole-Social 18+**, Dating OFF. This database default fix does not substitute for REST/Socket/Auth age gates, verified AAB QA, moderation, or approved legal policies.
- #903 master SonarCloud Quality Gate blocker is resolved; retain the original security thresholds. All PR CI must still pass.

## Required sign-off
- [ ] Isolated staging restores verified and has no connections to production Redis, push, OAuth, storage or outgoing notifications.
- [ ] Forward-only reconciliation of all 15 historical migration names reviewed and staged.
- [ ] New `0078` SQL accepted as non-conflicting and verified on restored staging.
- [ ] Privacy invariant: missing/under-18 accounts cannot be publicly discoverable and new accounts default private; existing opt-in public choices remain unchanged where eligible.
- [ ] PR CI, SonarCloud and integration tests green for final SHA.
- [ ] Explicit owner approval, controlled deploy SHA, rollback procedure and post-deploy queries documented.

**No production deployment or SQL is performed by this PR.**

## 2026-11-11 update
- Read-only inventory tooling merged as #1092; this did NOT reconcile or change the migration runner's fail-closed guard.
- Supabase Data API is disabled by owner decision. Broad anon/authenticated table/sequence SQL grants were revoked and checked in #1098, independently of this private-default migration.
- This PR has been reconciled with latest master via merge ancestry, preserving the latest disposable Postgres guard tests and without deploying its 0078 SQL to the live database.
- Production default remains **public** until an approved, isolated-staging-tested, forward-only deployment plan is ready.

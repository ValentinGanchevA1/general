# NEXUS — Safe PostgreSQL 17 staging restore preflight (2026-11-11)

**Status:** NO-GO. This is an operator runbook, not evidence that backup or restore already occurred.

## Known state

- Production-candidate linked Supabase G88 project ref: `hmtwlkplyjbskljntdkl`. Direct endpoint has format `db.<ref>.supabase.co:5432/postgres`; Supabase session pooler uses `postgres.<ref>` as username. Neither endpoint is safe to disclose with credentials.
- G88 has **85 applied names** in `public.schema_migrations`; current checkout has 70 baseline migrations and **15 unknown historical names**. Draft #1093 stages a separate `0078` file; it is **not applied**.
- Render g88-api runtime `DATABASE_URL` remains **unattested**. Render Auto Deploy is OFF; current live code predates backend GET /auth/age-eligibility.
- Supabase Data API is **OFF** per owner's dashboard; SQL table/sequence rights were hardened through #1098. Neither is a substitute for backup or private data isolation.
- Historical source candidates are available for 14/15 names (#1101); `0054_posthog_deletion_queue.sql` remains without original Git SQL proof.

## Order of operations — no skips

1. **Verify actual Render database identity.** Use the read-only `apps/backend/scripts/db-target-attestation.cjs` with the same runtime `DATABASE_URL` on a controlled service shell, or privately inspect non-secret host, port, DB and role in Render Environment. Never post the full URL, password or database dump. Connection pooler host can differ; use project ref as well as the database identity.
2. **Choose a truly separate target.** Prefer a new PostgreSQL 17 or separately provisioned Supabase project with a **different project ref**, isolated access credentials, distinct Redis, no OAuth callbacks, no prod Webhooks, no push/mail/SMS delivery and disabled outbound cron/jobs. A basic Supabase development branch does **not** provide an actual production-data restore.
3. **Obtain a restorable encrypted, access-controlled backup** before any DDL. Follow the current official [Supabase CLI logical backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). For logical export, the guide separates roles, schema and `--use-copy --data-only`; its defaults and managed auth/storage schema caveats must be reviewed. Keep credentials in interactive environment/secrets manager, never shell history, workflow logs, PR comments or repository.
4. **Run the offline target preflight (this PR)** from a trusted operator machine, without executing any restore:
   ```bash
   # Supply these six variables privately (do not paste their values in GitHub):
   # NEXUS_SOURCE_DATABASE_URL
   # NEXUS_STAGING_DATABASE_URL
   # NEXUS_SOURCE_PROJECT_REF=hmtwlkplyjbskljntdkl
   # NEXUS_STAGING_PROJECT_REF=<DIFFERENT_20_CHARACTER_REF>
   # NEXUS_STAGING_ISOLATION_ACK=YES  (only after actual isolation review)
   # NEXUS_RESTORABLE_BACKUP_ACK=YES (only after verified backup recovery test)
   node apps/backend/scripts/staging-target-preflight.cjs
   ```
   The tool does **not** connect, dump or restore. It compares URL destinations (including Supabase direct/session-pooler aliases), checks explicit source/staging refs and reports identity hashes without secrets. **Exit code 2 is intentional even when checks pass**; `checksPassed=true` means only the offline identity precheck passed, **NOT** that a restore is authorized. Environment acknowledgements are operator assertions, not independent proof.
5. **Perform the actual restore only with separate staging credentials and approved safeguards.** Preserve original encrypted backup offline. Confirm Docker and Supabase CLI/PostgreSQL 17 client versions. First restore into empty isolated staging; capture success/error output without PII. Never run `psql` or `pg_restore` with a production target. Do not copy external production integration secrets into staging. Supabase's documented restore flow has explicit managed schema, extensions, publication and Vault/key caveats — validate each relevant one.
6. **Attest the restored result using READ ONLY queries**, not manual edits to migration history:
   ```sql
   BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
   SELECT current_database(), current_user;
   SELECT COUNT(*), COUNT(DISTINCT filename) FROM public.schema_migrations;
   SELECT filename FROM public.schema_migrations ORDER BY filename;
   SELECT column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='visibility';
   ROLLBACK;
   ```
   Compare all 85 exact names with `apps/backend/scripts/fixtures/migration-history-owner-20261110.txt`; verify 15 unmatched names and the expected table/constraint/trigger catalog. **No real-user rows should be printed or attached.** Run the existing `db-target-attestation.cjs` against staging for independent evidence.
7. **Before any code-backed migration replay**, explicitly authorize a forward-only reconciliation preserving account privacy, review original SQL provenance and test the staged `0078` private visibility default, 18+ age bootstrap and legacy accounts. Do **not** stamp/delete/rename tracker rows, assume duplicate names executed twice or disable migration drift checks.

## Acceptance evidence (all required)

- [ ] Independently confirmed Render `DATABASE_URL` target; source project matches linked G88.
- [ ] Staging target different project, URL/role and resources; no production webhooks/jobs/push.
- [ ] Backup encrypted and restorable; restore logs and tested staging snapshot retained privately.
- [ ] Staging tracker has 85 distinct filenames and matches the source snapshot; table/constraint/trigger metadata compared.
- [ ] Privacy, child-safety, authentication and chat revocation tests on staging pass with sanitized/synthetic QA accounts.
- [ ] New SQL/rollout is reviewed and separately approved with rollback and monitoring plan.

**Never treat GitHub green CI, an offline target check or the existence of a Supabase branch as evidence of a restored production backup.** Release remains **NO-GO** until the above is met.

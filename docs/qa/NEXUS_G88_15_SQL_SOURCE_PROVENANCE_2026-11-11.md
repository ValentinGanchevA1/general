# NEXUS G88 — 15 historical migration names: source provenance audit

Date: **2026-11-11**. Classification: **P0 / NO-GO**. This audit is source-code research, **NOT** database migration reconciliation, an allowlist or a certificate of which SQL actually ran.

## Verified facts

- In the linked **Supabase G88** database, `public.schema_migrations` contains **85 unique filenames**, all 15 names absent from the baseline current GitHub checkout. Its only columns are `filename` and `applied_at`. **No checksum or immutable executed-SQL evidence is stored in this tracker.**
- The real PostgreSQL integration test merged via [#1100](https://github.com/ValentinGanchevA1/general/pull/1100) recreates the exact 85-name fixture in a local ephemeral database and verifies that `migrate.run` fails **before writing** with 15 unknown filenames.
- A search through historical commits and existing Draft PR trees found source-code **candidates for all 15 of the 15 names**. Original `0054_posthog_deletion_queue.sql` is now recovered from an archived pre-force-push workflow commit, even though later merged migrations `0052_event_reviews.sql` and `0062_posthog_deletion_queue.sql` exist.
- A Git blob SHA authenticates the file **stored in the stated Git tree**, not the bytes executed in G88. Current schema objects/constraints being present also do not prove execution of any given source candidate.

## High-confidence Git source facts (not DB-execution proof)

1. The original `0036_trade_offer_counter.sql`, `0037_conversation_kind_members.sql`, and `0038_user_strikes.sql` are retrievable at [commit `a3f8c2dd`](https://github.com/ValentinGanchevA1/general/commit/a3f8c2dd471a4ab7ef5aad4df75fce0658453174). Their SQL **excluding comment lines** was compared with current `0040_trade_offer_counter.sql`, `0038_conversation_kind_members.sql`, and `0039_user_strikes.sql`, respectively, and matched; Git blobs differ due to filename comments. Subsequent deletion commits are `b89e6b37`, `cf5858c5`, and `12c672b4`.
2. `0072_extend_content_report_targets.sql` and `0073_event_question_moderation.sql` are retrievable at immutable [commit `fb79c8fe`](https://github.com/ValentinGanchevA1/general/commit/fb79c8feaa59062a9d4fd3bc786219344ce293d9). Their **exact Git blob SHAs** match `0073_extend_content_report_targets.sql` and `0074_event_question_moderation.sql` respectively at Draft PR #1066's inspected head. The tracker records both old and new filenames; do **not** assume they were run twice or merely stamped.
3. Original `0051_event_reviews.sql` was recovered from [early PR #818 commit `1ccacd9e`](https://github.com/ValentinGanchevA1/general/commit/1ccacd9ea9d887c6ac698fffdc4be42bfb919b23), with Git blob `0f17246ac3db1a20e1687e91f066be2a5c1e3f9d`. Later merged `0052_event_reviews.sql` was made repeat-safe following a partially applied migration; **do not claim byte-equivalence or reapply 0051**.
4. Original `0054_posthog_deletion_queue.sql` was retrieved from the archived pre-force-push PR #829 Actions head [`bfae85de`](https://github.com/ValentinGanchevA1/general/commit/bfae85de887eab8917e8db0eeaf780e3e448791b) on 2026-10-27 (workflow [40443005780](https://github.com/ValentinGanchevA1/general/actions/runs/40443005780)). Its Git blob `f094ca033680ec799b099741e5bf2be409398ee4` is **byte-for-byte identical** to the present `0062_posthog_deletion_queue.sql` blob. This proves historical source identity, **not** actual DB execution.
5. `0069_realtime_room_revocation_outbox.sql` is present in Draft [#1060](https://github.com/ValentinGanchevA1/general/pull/1060).
6. `0072_personal_labels.sql` is present in Draft [#1074](https://github.com/ValentinGanchevA1/general/pull/1074).
7. `0072_ugc_terms_acceptance.sql` is present in Draft [#1067](https://github.com/ValentinGanchevA1/general/pull/1067).
8. `0073_extend_content_report_targets.sql`, `0074_event_question_moderation.sql`, `0075_dating_match_conversation_lookup.sql`, `0076_child_safety_report_reason.sql`, and `0077_adult_only_rc1_visibility.sql` are present in Draft [#1066](https://github.com/ValentinGanchevA1/general/pull/1066).

The companion [source-candidate manifest](./NEXUS_G88_15_SQL_SOURCE_CANDIDATES_2026-11-11.json) records **all 15 exact filenames and immutable Git commit/blob SHAs; no source file remains missing**. CI validates the manifest against the 85-name fixture, and prevents any status field from asserting execution or a migration allowlist. GitHub source candidates are not automatically trusted application migrations; several affected draft branches carry additional release security/legal concerns.

## Safest next step

**Do not** merge unreviewed 0069/0072–0077 SQL into `master` as a shortcut or delete/rename/insert into `public.schema_migrations`. Do not turn off `MIGRATION_HISTORY_DRIFT`.

1. Independently attest actual Render `g88-api` `DATABASE_URL` target against the linked G88 database, without printing secrets or exposing connection strings.
2. Produce a **verified recoverable backup** and restore to a **truly isolated** Postgres 17 staging environment; sanitize PII and disable external OAuth, push, Redis, webhooks, cron and Storage integrations before connecting applications.
3. Supabase's official [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) requires a paid plan and physical backups and incurs additional resource cost; a standard Supabase development branch **does not copy production data**. For a Free plan, Supabase's [CLI dump/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) is a potential manual path; it still requires Docker/CLI, secure credentials, and **actual restore evidence**, not just exported files. Supabase CLI's dump defaults exclude managed schemas and need careful coverage verification for a full recovery.
4. Verify original 0054-versus-0062 identical Git blobs and 0051-versus-0052 divergent postconditions, and compare application data invariants, constraints, triggers, canonical function/index definitions and private-by-default eligibility on the restored database.
5. Produce a reviewed **forward-only** history/schema reconciliation and staged rollout. Only after that consider #1093 `0078` and Render backend rollout required by #1096.

**What this PR does:** versioned evidence/CI assertions only; no production SQL, no Redis/Render secrets, no env modifications or deployments. **Release remains NO-GO**.

# NEXUS G88 — v15 offline migration and isolation evidence gate

**Date:** 17 Nov 2026
**Scope:** evidence-only audit; **not** a production migration patch, an approved legacy alias map, or a deployment authorization.
**Decision:** **PRODUCTION NO-GO**.

## What changed

Two **new** JS files provide an offline evidence classifier and an 8-test regression suite:

- `apps/backend/scripts/migration-v15-evidence-gate.cjs`
- `apps/backend/scripts/migration-v15-evidence-gate.test.cjs`

Two minimal evidence fixtures are included under `apps/backend/scripts/fixtures/`. They intentionally **omit all per-table row counts, personal data, URLs, credentials, S3 object keys, and account identifiers**.

**Production-critical files remain unchanged:** `migration-history-guard.js`, `migrate.js`, `preview-db-guard.js`, `schema_migrations`, SQL migrations, and the backend deployment configuration.

## Evidence and current result

The user-reported Render config comparison established that PR #1055 and PR #1074 shared production `DATABASE_URL` configuration. Read-only Render service queries made after the user's containment actions showed:

| Control | Read-only result |
|---|---|
| Production `g88-api` preview generation | `off` |
| Preview #1055 suspended | `true` |
| Preview #1074 suspended | `true` |
| Preview #1055 autoDeploy | `yes` (conflicts with owner UI action) |
| Preview #1074 autoDeploy | `yes` (conflicts with owner UI action) |
| Production DB configuration shared | `true` (owner confirmed; credentials not rotated in evidence) |

This is not a reason to resume either preview. **Suspension is containment, not database isolation.** Disabling auto-deploy does not revoke credentials inherited by previews.

Offline v14 baseline: archive `1D15E6909163D27F35EE087587F64231FAA2E46A9D6319FC25630A3C571C3D65`, `master=ee1bcbc790704d53b3586148c56066ae72baeb97`, 85 migration names = 70 master + 15 historical. v13 markers 43/43, semantic 7/7, current 0077 predicate 0. These validate **archive-local state**, not executed SQL provenance or full Supabase/S3 recovery.

## Apply the patch to a LOCAL clone only

Open PowerShell in your existing local Git clone of `ValentinGanchevA1/general`. Before applying, ensure there are no uncommitted modifications that could be overwritten; this patch contains only new files. Do not run this against Render.

```powershell
cd "$HOME\nexus-g88-migration-audit"
git status --short
# Use the path where you saved the downloaded v15 patch.
git apply --check "F:\Users\VGANCHEV88\Downloads\NEXUS_G88_v15_offline_evidence_gate.patch"
git apply "F:\Users\VGANCHEV88\Downloads\NEXUS_G88_v15_offline_evidence_gate.patch"
node --test apps/backend/scripts/migration-v15-evidence-gate.test.cjs
```

If your clone is not at the pinned `ee1bcbc` commit or the backend migration directory no longer contains exactly 70 files, the evidence gate deliberately fails rather than silently authorizing a new state. The test suite is explicitly scoped to the pinned historical snapshot.

## Run against your actual v14 report (offline, NO database connection)

Run from the repository root:

```powershell
node apps/backend/scripts/migration-v15-evidence-gate.cjs `
  "X:\NEXUS-G88-BACKUP\G88-isolated-migration-chronology-v14-20261117-212637.json" `
  "apps\backend\scripts\fixtures\v15-containment-observed.json"

# Exit code 2 is INTENTIONAL: this classifier cannot authorize production.
```

Input path 2 is a **sanitized historical observation** of Render controls, not a live API check. Confirm the live `Auto-Deploy` state with Render before treating those fields as current. To update it, change only the local evidence file; do not store secrets or connection strings.

Expected key fields:

```json
{
  "baselineEvidenceMatches": true,
  "sourceExecutionAttested": false,
  "previewControlsVerified": false,
  "databaseIsolationProven": false,
  "productionCredentialsStillShared": true,
  "guardMustRemainFailClosed": true,
  "migrationRunnerAuthorization": false,
  "releaseDecision": "NO-GO"
}
```

## Security acceptance gates still outstanding

1. **Verify preview Auto-Deploy**: compare actual Render service settings with API results. Resolve discrepant `yes` values. Keep PR #1055 and #1074 suspended.
2. **Credential isolation**: remove inherited production DB credentials from previews and other affected services, provision distinct staging DB and credentials, then plan a controlled production credential rotation after impact review. Never paste DB URLs or passwords into logs or chat.
3. **Build-time migration hazard**: before resuming any preview, verify its build command cannot execute migrations against production, including older branches without the updated `preview-db-guard.js`. Re-test with nonproduction credentials only.
4. **Historical provenance**: v14 tracker timestamps and Git file blobs do not authenticate executed SQL bytes. Independently reconcile draft branch data effects and runtime flags; review the 2 `NOT VALID` CHECK constraints and existing RLS/ACL issues.
5. **Approval**: only after (1)–(4), propose a forward-only, reviewed compatibility change and isolated integration tests. Unknown 16th migration must always remain blocked.

## Regression tests

- Baseline 85/70/15 is recognized but never authorizes migration.
- Shared production credentials and preview settings prevent isolation sign-off.
- Even simulated correct containment does not authorize unknown executed-SQL provenance.
- Unknown `0099_unknown_draft.sql` breaks baseline.
- Tampering with timestamp keys / 43 schema markers breaks baseline.
- **Unmodified production guard** rejects the 15 known legacy filenames with zero SQL writes.
- Guard also rejects an unknown 16th filename with zero SQL writes.
- CLI intentionally exits 2 (NO-GO) on valid baseline.

**No GitHub PR, merge, live database query, SQL migration, or Render configuration change was performed by this patch.**

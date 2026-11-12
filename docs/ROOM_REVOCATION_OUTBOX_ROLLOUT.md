# Group-room revocation outbox — staged rollout (security #869)

**Status:** code in PR #1055. This document is an operations checklist, **not authorization** to change Render settings or production DB.

## Confirmed Render behavior — 2026-11-06

Read-only inspection of the owner-confirmed Render workspace `g88` (`tea-d87btoog4nts73domv40`) verified:

- `g88-api` service `srv-d8d8ujojs32c73fb1gfg` is configured for branch `master`, `autoDeploy=yes`, trigger `checksPass`.
- The current **build command runs `pnpm --filter @g88/backend migration:run`**. Thus *merging a migration file to master may automatically execute it on the production DB*. A default-off runtime flag cannot prevent that build-time migration.
- Last observed Render live deploy was `7fb28d27a09acb835ca1c6e42c04adc6878ffb93` (as inspected during this review); do not assume this SHA remains current.
- Render returned no managed PostgreSQL instances in this workspace. The actual production `DATABASE_URL` and applied schema migration list **have not been inspected**, and no secret should be added to GitHub.
- No connector action in this review exposed a safe read-only listing of environment variables. The effective production value of `ROOM_REVOCATION_OUTBOX_ENABLED` therefore remains **unverified**.

For that reason the rollout has been split:

- **PR #1055 — code only**, with `ROOM_REVOCATION_OUTBOX_ENABLED=false` by default; contains no migration file.
- **Draft PR #1060 — migration 0069 only**. **Do not merge** #1060 until the owner explicitly approves a production schema change, checks the target database and rollback plan, and accepts the automatic Render migration behavior.

Even the code-only PR #1055 may trigger an automatic production build/redeploy. It must not be merged solely based on this read-only workspace confirmation.

## Why two phases are required

The outbox worker depends on migration `0069_realtime_room_revocation_outbox.sql`. Deploying enabled code that queries a nonexistent table would break group membership removal. A green migration smoke check on a disposable CI database does not prove the production schema is migrated.

## Phase A — safe code merge (no activation)

- `ROOM_REVOCATION_OUTBOX_ENABLED` defaults to **false**, including when unset.
- In this state, group kick/self-leave/block keeps pre-existing backend behavior: no `realtime_room_revocations` SQL writes or sweeps, and a synchronous failed immediate eviction is **not** silently hidden as a queued retry.
- Do not activate the flag based on green PR CI alone. Confirm exact deployed backend SHA and migration tracking.
- PR integration tests opt into the new feature explicitly, using disposable localhost PostgreSQL and Redis only.

## Phase B — owner-approved activation

1. Verify the target production Render workspace/service and current deploy SHA using an authorized operator. Do not infer its present state from stale runbooks.
2. Obtain explicit production change approval and a rollback plan.
3. After explicit schema-change approval, merge **draft migration PR #1060** following the approved release procedure. Since Render's build command already runs `migration:run`, **do not manually run the same migration in parallel**. First confirm the target database's migration history and verify the resulting Render deploy applied `0069` exactly once.
4. Verify migration **0069** is recorded and the table/index exist. Confirm no failure in existing group removal, block, chat and GPS authorization tests.
5. Only after step 4, merge/deploy the **code-only PR #1055** (if not already safely deployed), and set `ROOM_REVOCATION_OUTBOX_ENABLED=true` on the correct backend service with explicit approval. Record the deployment SHA and restart through the approved process.
6. Monitor pending/leased/failed revocations (without logging user IDs or room IDs), Redis connectivity, worker errors, retry volume and old socket subscriptions. Capture a two-device/Android revocation and reconnect privacy QA record.

## Rollback and limitations

- In an incident, disable the flag to stop outbox queries and sweeps; this **also disables automatic retries**. Do not treat this as closing any pending privacy work. Re-enable only after migration/Redis state is corrected, or execute an approved manual reconciliation.
- Do not delete or truncate pending outbox tasks during rollback. Never log coordinates, tokens, users' identities, message contents or raw room IDs.
- `fetchSockets()` observes reachable nodes only. It is **not** durable delivery acknowledgment during a Redis partition. Verify recovered nodes/reconnect and maintain current-recipient authorization for every private chat/GPS/push delivery.
- The first slice covers group kick, self-leave and shared-group removal on block. **Legacy DM block room revocations remain outside this slice.**

**Production security sign-off remains NO-GO:** leave #869 and #903 open until the applicable security QA gates are completed.

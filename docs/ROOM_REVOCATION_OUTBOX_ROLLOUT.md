# Group-room revocation outbox — staged rollout (security #869)

**Status:** code in PR #1055. This document is an operations checklist, **not authorization** to change Render settings or production DB.

## Why two phases are required

The Render release documentation records `g88-api` as tracking `master` with automatic `checksPass` deploy. The new worker depends on migration `0069_realtime_room_revocation_outbox.sql`. Deploying code that queries a nonexistent table would break group membership removal; migration-only PR validation does not prove the live database has been migrated.

## Phase A — safe code merge (no activation)

- `ROOM_REVOCATION_OUTBOX_ENABLED` defaults to **false**, including when unset.
- In this state, group kick/self-leave/block keeps pre-existing backend behavior: no `realtime_room_revocations` SQL writes or sweeps, and a synchronous failed immediate eviction is **not** silently hidden as a queued retry.
- Do not activate the flag based on green PR CI alone. Confirm exact deployed backend SHA and migration tracking.
- PR integration tests opt into the new feature explicitly, using disposable localhost PostgreSQL and Redis only.

## Phase B — owner-approved activation

1. Verify the target production Render workspace/service and current deploy SHA using an authorized operator. Do not infer its present state from stale runbooks.
2. Obtain explicit production change approval and a rollback plan.
3. Apply the existing migration runner on the intended database using approved credentials: `pnpm --filter @g88/backend migration:run`. First confirm `schema_migrations` state; do not point the runner at the wrong database.
4. Verify migration **0069** is recorded and the table/index exist. Confirm no failure in existing group removal, block, chat and GPS authorization tests.
5. Set `ROOM_REVOCATION_OUTBOX_ENABLED=true` on the correct backend service only after step 4. Restart/deploy through the approved process.
6. Monitor pending/leased/failed revocations (without logging user IDs or room IDs), Redis connectivity, worker errors, retry volume and old socket subscriptions. Capture a two-device/Android revocation and reconnect privacy QA record.

## Rollback and limitations

- In an incident, disable the flag to stop outbox queries and sweeps; this **also disables automatic retries**. Do not treat this as closing any pending privacy work. Re-enable only after migration/Redis state is corrected, or execute an approved manual reconciliation.
- Do not delete or truncate pending outbox tasks during rollback. Never log coordinates, tokens, users' identities, message contents or raw room IDs.
- `fetchSockets()` observes reachable nodes only. It is **not** durable delivery acknowledgment during a Redis partition. Verify recovered nodes/reconnect and maintain current-recipient authorization for every private chat/GPS/push delivery.
- The first slice covers group kick, self-leave and shared-group removal on block. **Legacy DM block room revocations remain outside this slice.**

**Production security sign-off remains NO-GO:** leave #869 and #903 open until the applicable security QA gates are completed.

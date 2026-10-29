# NEXA Render production cutover runbook

Status: preparation / execution checklist for #906.

This runbook exists to make the production move off Render Free tiers explicit, reversible and independently verifiable. It does **not** authorize a paid-plan purchase, a network-policy change or a production deploy by itself.

## Current verified baseline — 2026-10-29

Render workspace: `g88` (`tea-d87btoog4nts73domv40`).

### API

- service: `g88-api`
- resource id: `srv-d8d8ujojs32c73fb1gfg`
- type: Node web service
- region: Frankfurt
- plan: `free`
- instances: `1`
- branch: `master`
- auto deploy: enabled
- auto-deploy trigger: `checksPass`
- health check: `/health`
- public URL: `https://g88-api.onrender.com`
- service IP allow-list currently reports `0.0.0.0/0`
- latest verified live deploy at the time of this record: `dep-dbh859nb9u1s73e8gp50`
- live commit at the time of this record: `014ef9413a95611797bed2219cfc32c76fc03421`

Current master after #920 is `0708e042aa83771b2ef41f937ce319ea597355ff`, so production is behind source control.

### Redis / Render Key Value

- name: `g88-redis`
- resource id: `red-d8d8u977f7vs73bulhh0`
- region: Frankfurt
- plan: `free`
- Redis version: 8.1.4
- persistence: `off`
- max-memory policy: `allkeys_lru`
- IP allow-list currently reports `0.0.0.0/0`

`docs/REDIS_DURABILITY.md` is the authoritative key-class contract. Persistence must not be enabled wholesale merely to make the mixed keyspace survive restarts: OTP, OAuth PKCE and Story presign bindings are intentionally short-lived/fail-closed state.

## Completed prerequisites

The restart-sensitive A1 abuse controls are no longer Redis-only:

- #919: password-reset request cooldown/hourly budget moved to shared short-retention Postgres state (`password_reset_rate_limits`); limiter identity is an HMAC digest, not raw email.
- #920: push-notification frequency caps moved to shared short-retention Postgres state (`notification_frequency_caps`); existing per-channel limits and preference ordering remain unchanged.

Therefore total Redis loss no longer resets the two abuse-control budgets identified in #918.

## Blocking gates before infrastructure mutation

Do not start the paid-plan/network cutover until every applicable gate below is explicitly recorded in #906.

### Gate A — release automation (#847)

`g88-api` uses `checksPass`. The external check
`google-cloud-build-github-general (general-497910)` still fails current master because no Cloud Build file/root Dockerfile exists.

Verified metadata:

- Google Cloud project number: `689098029576`
- trigger UUID: `bd2118a1-575a-4fcc-ad99-6d5b142eb59a`

Required remediation is to disable the stale trigger first (reversible) or scope it to a real workload. Do **not** add a fake `cloudbuild.yaml` and do not switch Render to `On Commit` merely to bypass the gate.

Cutover gate is green only when a harmless validated master commit proves:

1. intended NEXA checks are green;
2. the stale Google Cloud Build failure is absent/non-blocking;
3. Render creates the `g88-api` deploy automatically through the checks-pass path.

### Gate B — memory/reliability (#846)

The API currently has a 512 MiB limit and has experienced cgroup OOM kills. The latest confirmed OOM in the current observation record is `2026-10-28T05:46:34Z`.

Do not treat a paid plan as the fix for #846. Keep the privacy-safe runtime diagnostics enabled through the cutover and retain the existing evidence discipline:

- no user/session/conversation IDs;
- no coordinates or precise-location payloads;
- no message/free-text bodies;
- no tokens, OTPs or auth material.

The cutover may increase capacity only after the code-level investigation is preserved and the reason for the selected plan is documented.

### Gate C — explicit cost/plan approval

Before a paid Render change, record the exact target plans and obtain explicit owner approval for the recurring-cost change.

Minimum properties, regardless of SKU name:

- API: non-Free, always-on compute in Frankfurt; keep one instance initially unless scaling evidence requires more.
- Redis/Key Value: non-Free in Frankfurt; keep the mixed keyspace ephemeral (`persistenceMode=off`) unless a later architecture decision splits roles.
- Keep `allkeys_lru` unless measured behavior justifies another eviction policy.

Do not select a larger API memory class solely to mask #846.

### Gate D — least-privilege connectivity

Current Render metadata reports `0.0.0.0/0` on both resources. Before sign-off:

- verify the application uses the intended Render internal/private Redis path;
- restrict Redis public access to the smallest supported scope, ideally no public ingress;
- do not copy Redis credentials into source, issue comments or test logs;
- after changing connectivity, prove API startup still fails closed if Redis is unavailable and succeeds through the intended private path.

## Pre-cutover evidence record

Copy this block to #906 and fill every field before changing plans:

```text
Cutover timestamp (UTC):
Operator:
Source master SHA:
Current live API deploy/SHA:
Target API plan:
Target API instances:
Target Redis plan:
Redis persistence mode:
Redis eviction policy:
Redis network-access model:
#847 checksPass evidence:
#846 observation-window evidence:
Rollback API plan/deploy:
Rollback Redis configuration:
Rollback trigger(s):
```

## Execution sequence

Use this order so each mutation has a bounded blast radius.

### 1. Establish source/release baseline

1. Confirm `master` SHA and all intended release checks.
2. Confirm #847 is fixed; do not proceed if the stale GCB failure is still blocking `checksPass`.
3. Confirm current live Render deploy/SHA and capture it as the rollback target.
4. Confirm DB migrations on master are forward-safe and include `0064_password_reset_rate_limits.sql` and `0065_notification_frequency_caps.sql` before restart testing.

### 2. Change API compute plan

1. Apply only the explicitly approved non-Free API plan.
2. Keep Frankfurt and one instance for the first cutover unless separately approved.
3. Do not alter build/start commands, branch or `checksPass` policy as part of the capacity change.
4. Wait for `/health` to become healthy.
5. Record the Render plan-change/deploy event and exact live commit.
6. Check runtime diagnostics for startup RSS/heap/external/ArrayBuffer/socket-count sanity.

Stop and roll back if health fails, memory jumps abnormally at idle, DB migrations fail or startup loses its fail-closed Redis/auth behavior.

### 3. Change Redis/Key Value plan

1. Apply only the explicitly approved non-Free Redis plan.
2. Keep Frankfurt.
3. Keep `persistenceMode=off` for the current mixed keyspace.
4. Preserve the intended eviction policy unless separately justified.
5. Apply least-privilege/private connectivity restrictions.
6. Confirm the API reconnects through the intended internal path.

Do not import/restore transient OTP, PKCE, presign, presence, cache or Pub/Sub keys from a persistence snapshot.

### 4. Intentional restart / loss QA

Run the restart matrix from `docs/REDIS_DURABILITY.md` and record sanitized pass/fail evidence.

Minimum checks:

- API process restart: REST/auth correctness preserved; clients reconnect.
- Redis restart/loss: service reconnects without authorization bypass.
- Presence: users rebuild presence only after heartbeat/reconnect.
- Discovery/trending: first request recomputes from authoritative state.
- Socket conversation: room/rejoin is reauthorized from current DB membership/block state.
- Live location: blocked/removed peer receives no precise payload before or after reconnect.
- Password reset: already-issued challenge remains valid until normal expiry; request budget remains enforced via Postgres.
- Verification OTP: missing Redis OTP fails closed and requires a new flow.
- OAuth linking: missing PKCE marker fails closed.
- Story presign: lost binding invalidates create and requires reissue.
- Wave/idempotency and event/listing lifecycle: Redis coordination loss may repeat work but must not duplicate authoritative durable state.
- Notification caps: preferences and frequency budgets remain enforced via Postgres.

### 5. Release-path verification

After the infrastructure changes are stable:

1. merge/push a harmless validated commit;
2. verify all intended GitHub checks complete successfully;
3. verify no stale GCB failure is attached;
4. verify Render automatically creates the API deploy under `checksPass`;
5. verify the deploy reaches `live` on the exact expected commit;
6. verify `/health` and core authenticated flows.

## Rollback

Rollback is required if any of the following occurs:

- health check does not recover;
- DB migration/startup fails;
- Redis cannot be reached through the intended private path;
- authentication/authorization becomes fail-open;
- precise-location revocation/reconnect QA fails;
- password-reset or notification cap budgets reset unexpectedly;
- new repeated OOM/restart behavior appears with no understood cause;
- release automation deploys an unexpected SHA.

Rollback procedure:

1. restore the last known-good API deploy/configuration recorded before cutover;
2. restore the last known-good Redis connectivity/plan configuration without enabling persistence for transient secrets;
3. verify `/health` and authenticated core flows;
4. record the rollback event IDs, deployed SHA and failure trigger in #906;
5. keep #906 open until the failed acceptance item is corrected and re-tested.

## Closure evidence for #906

#906 can close only when the issue contains evidence for all of the following:

- Redis durability inventory and safe-loss decision (#918);
- durable password-reset request limits (#919);
- durable notification frequency caps (#920);
- API moved off Free with target plan recorded;
- Redis moved off Free with topology/persistence decision recorded;
- Redis connectivity restricted to the intended least-privilege/private model;
- #847 normal `checksPass` deployment verified;
- #846 diagnostics preserved and capacity choice justified independently from the OOM investigation;
- intentional API + Redis restart/failover matrix passed;
- exact final plans/configuration/live SHA and rollback path recorded.

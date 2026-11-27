# NEXUS Staging — External Upstash Redis

Status: operational runbook; no provider credentials are stored in this repository.

## Target

- Render service: `nexus-staging-api`
- Service URL: https://nexus-staging-api-mp3g.onrender.com
- Render region: Frankfurt
- Redis provider: Upstash Redis, regional database in AWS Frankfurt (`eu-central-1`)
- Database name: `nexus-staging-redis`
- Isolation: this database is dedicated to staging. Never point staging at `g88-redis` or any production Redis URL.

Upstash documents native Redis TCP connectivity for Render. Use the TCP connection string, not the REST URL. The `rediss://` scheme enables TLS and is accepted by the existing `ioredis` client.

## 1. Provision the Redis database

1. Sign in to https://console.upstash.com/.
2. Create a Redis database named `nexus-staging-redis`.
3. Select the **regional** database option and AWS region **Frankfurt / eu-central-1**. Do not enable global replicas for this single-region staging service.
4. Keep the database private to the project/account. Do not enable public sharing.
5. Open **Connect → TCP** and copy the Redis connection string. It should have this shape:

   ```text
   rediss://default:<TOKEN>@<ENDPOINT>:6379
   ```

6. Do not copy the REST URL/token. Do not commit or paste the Redis URL into GitHub, an issue, a chat, or a log.

The currently published Free plan lists 250 MB data, 10 GB monthly bandwidth and 500,000 monthly commands. Re-check current quotas and billing in the Upstash console before provisioning. This is a staging/test allowance, not a production SLA.

## 2. Add the secret to Render staging

Open the [nexus-staging-api Render service](https://dashboard.render.com/web/srv-dc3ccde8bjmc73f9jieg), then **Environment → Add Environment Variable**:

| Key | Value | Handling |
|---|---|---|
| `REDIS_URL` | Full `rediss://...` TCP URL copied from Upstash | Secret |
| `SOCKET_IO_REDIS_ADAPTER` | `enabled` | Plain configuration |

Do not set `REDIS_HOST` or `REDIS_PORT` when using `REDIS_URL`. The code creates both the normal Redis client and the Socket.IO publisher/subscriber clients from `REDIS_URL`. The Socket.IO channel prefix already includes `RENDER_SERVICE_ID`, so this Render service is namespace-isolated.

Save the variables, but do not trigger a deployment yet unless the remaining startup prerequisites in section 4 are satisfied.

## 3. Redis capability checks

The backend uses Redis for more than caching:

- Socket.IO Redis adapter: Pub/Sub across backend instances.
- Discovery mutation bus and Pulse activity: Pub/Sub.
- Presence: `GET`, `SET EX`, `MGET`, pipelines, `ZADD`, `ZREM`, `ZREVRANGE`, expiry.
- Movement history and distributed lock release: Lua `EVAL`.
- Wave idempotency, listing/event lifecycle: `SET NX EX`, `GET`, `EXISTS`, `DEL`, `EVAL`.
- OAuth linking: expiring state secret via `SET EX`, `GET`, `DEL`.

Use the Upstash native TCP protocol because these paths use the existing `ioredis` API and long-lived Pub/Sub connections. The HTTP REST client is not a drop-in replacement for the Socket.IO Redis adapter.

After a successful staging start, verify application logs contain both:

- `Socket.IO Redis Pub/Sub connected`
- `Socket.IO Redis adapter enabled`

Then exercise a staging login/social-link flow, Wave idempotency, discovery/presence updates, and an event/listing expiry path using test data only. Do not run expiry tests against production records.

The existing multi-node Socket.IO integration test is in `apps/backend/src/realtime/realtime.redis-adapter.integration.spec.ts` and is gated by `REDIS_ADAPTER_TEST=true`. Use a dedicated test Redis database or unique test key namespace when running it; do not run destructive test cleanup against a shared production database.

## 4. Existing startup blockers — separate from Redis

The last recorded staging deployment built successfully but exited during startup because the required HTTPS CORS origin was absent. The bootstrap currently validates CORS before importing the Nest application module. After fixing CORS, the next production-mode checks require:

- `CORS_ORIGINS` or `PUBLIC_WEB_ORIGIN`: a real, explicit HTTPS **frontend/browser origin**. Use a bare origin only (no path, query or trailing route). Do not invent one and do not use the API origin unless it is actually the frontend origin.
- `JWT_SECRET`: a staging-only secret, at least 64 characters in production mode. Never reuse the production secret.
- `DATABASE_URL`: the dedicated `nexus-staging-db` connection string, never the production database.
- `REDIS_URL`: the dedicated Upstash staging connection string described above.

The Postgres migration reconciliation gate remains separate and unresolved. Do not run migrations, stamp migration history, replay SQL, or seed data until the staging database's migration provenance and reconciliation plan are approved.

The `/health` endpoint is a **liveness-only** probe; it returns 200 without checking Redis or PostgreSQL. Do not treat it as proof that dependencies are ready.

## 5. Isolation and release gate

- Confirm the Render service still has exactly one instance for this staging phase.
- Confirm staging Redis and staging Postgres are separate from production.
- Confirm no production Redis hostname, URL, password, or token is present in staging configuration.
- Confirm Redis TLS is enabled (`rediss://`).
- Confirm no secret appears in logs or repository contents.
- Confirm Socket.IO Pub/Sub and the Redis-backed service paths listed above succeed.
- Keep automatic deployment disabled until this gate is passed and the intended staging branch is selected.

## References

- Upstash + Render: https://upstash.com/docs/redis/quickstarts/render
- Upstash TCP vs REST: https://upstash.com/docs/redis/features/restapi
- Upstash Redis command compatibility: https://upstash.com/docs/redis/overall/compatibility
- Upstash pricing: https://upstash.com/pricing/redis

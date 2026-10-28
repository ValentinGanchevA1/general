# NEXA PostHog Analytics v1.1

## Decision

PostHog is an analysis and visualization mirror, not the canonical analytics store.

Canonical flow:

`mobile -> /api/v1/analytics/events -> backend allow-list -> Postgres -> PostHog mirror`

The mobile app does not include a PostHog SDK in v1.1. Autocapture and session replay remain outside the product analytics path.

## Why backend-only

NEXA already has a privacy boundary for product analytics:

- shared allow-listed event names
- mobile property allow-list
- backend property allow-list
- HMAC-derived pseudonymous subject IDs
- first-party retention and deletion semantics

Sending directly from React Native would create a second telemetry egress path that could bypass the backend privacy boundary. The PostHog mirror therefore receives only the event name, pseudonymous subject hash, and already-sanitized properties produced by `AnalyticsService`.

## Delivery semantics

Postgres is canonical and is written first.

Only after a successful canonical insert does the backend attempt a PostHog capture. PostHog delivery is best-effort and never changes product success semantics.

A failed PostHog request:

- does not fail `/analytics/events`
- does not roll back the canonical event
- does not affect the user action that produced the event

A failed canonical Postgres write does not produce a PostHog event.

## Identity

PostHog `distinct_id` is the existing analytics `subject_hash`:

`HMAC-SHA256(ANALYTICS_HMAC_KEY, users.id)`

Raw user IDs, email addresses, phone numbers, usernames, entity IDs, conversation IDs, offer IDs, coordinates, message text, verification media/results, and auth tokens are not sent to PostHog.

The mirror forces:

`$process_person_profile = false`

This keeps v1.1 focused on pseudonymous event analysis rather than creating a second person-profile database.

### HMAC rotation

`ANALYTICS_HMAC_KEY` is part of the external deletion handle. Rotating it while mirrored PostHog events still exist would strand historical `distinct_id` values because the same user would produce a new hash.

Production rule: do not rotate `ANALYTICS_HMAC_KEY` while the PostHog mirror contains retained events unless the old mirrored dataset is purged first. Emergency rotation therefore requires a PostHog purge plus a new staging verification before capture is re-enabled.

## Retention and deletion

PostHog Cloud retention is plan-controlled and cannot be shortened to NEXA's 90-day product analytics contract. NEXA therefore maintains its own durable external deletion queue in Postgres.

Migration `0062_posthog_deletion_queue.sql` adds `analytics_external_deletion_requests` and a `BEFORE DELETE` trigger on `analytics_subjects`.

The trigger preserves the pseudonymous `subject_hash` as a deletion intent before the local identity bridge disappears. It covers both:

- account deletion through the existing `DELETE /users/me` cascade
- first-party analytics subject pruning after the retention window

The analytics retention sweep also queues a cutoff-based PostHog deletion request before pruning canonical Postgres events and can trigger immediate queue processing after enqueue.

The PostHog privacy worker:

- receives only `subject_hash` or a retention cutoff
- never receives raw `users.id`, email, phone, coordinates, message content, or verification data
- starts independently of the six-hour analytics retention sweep after a one-minute initial delay and polls every 15 minutes, so account-deletion propagation and one-hour retry eligibility are not gated by the retention cadence
- uses a single-flight guard within each API replica
- atomically claims due queue rows with `FOR UPDATE SKIP LOCKED` plus a short database lease so multiple API replicas cannot submit the same due row concurrently
- increments the durable attempt counter in the same atomic claim, before any external request, so a crash after provider acceptance cannot erase evidence that reconciliation is required on the next claim
- persists retries and provider request IDs for auditability
- reconciles ambiguous retries against PostHog by `submission_id` or the exact one-column query before any repeat destructive POST
- accepts both paginated `results` and raw-array list responses; an unknown response envelope or unavailable reconciliation fails closed and defers the retry rather than risking a duplicate submission
- polls submitted deletion requests until PostHog reports completion
- remains disabled unless explicit private-API configuration is present

PostHog event deletion is asynchronous, so a locally completed account deletion does not imply immediate physical removal from PostHog. The durable queue preserves the request and retry state independently of the deleted account.

Current PostHog Data Deletion API documentation explicitly defines the create endpoint as a one-column HogQL event-deletion query and documents `query`, `variables`, and `submission_id` request fields. This removes the earlier API-shape ambiguity, but it does not replace NEXA's staging validation gate: preview scope, controlled deletion completion, status behavior, retention cutoff behavior, and environment separation must still be verified against a dedicated staging project before production capture is enabled.

Read-only parser/schema checks against the connected EU PostHog project confirm that the live `events` schema exposes `uuid`, `distinct_id`, `timestamp`, and `event`, and that the subject-query shape plus the retention query's `toDateTime(...)` and canonical event allow-list compile successfully. This is parser compatibility evidence only; it is not a destructive deletion preview and does not satisfy the staging rollout gate.

## Configuration

Backend environment variables:

```env
POSTHOG_ENABLED=false
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://eu.i.posthog.com

POSTHOG_PRIVACY_ENABLED=false
POSTHOG_PERSONAL_API_KEY=
POSTHOG_PROJECT_ID=
POSTHOG_APP_HOST=https://eu.posthog.com
POSTHOG_DELETION_QUERY_VERIFIED=false
```

`POSTHOG_PROJECT_TOKEN` is a PostHog project token used only by the backend capture path. Do not expose it through the React Native configuration.

`POSTHOG_PERSONAL_API_KEY` is server-only and must use least privilege with `data_deletion:read` and `data_deletion:write`. It must never be shipped to mobile or web clients.

Use separate PostHog projects, project tokens, project IDs, and private deletion credentials for staging and production. An unlabeled/default project is not sufficient evidence of staging/production separation.

The capture mirror and privacy worker are independently disabled by default. Production capture must not be enabled unless the privacy worker configuration is complete and the staging deletion query has been verified.

## Event contract

v1.1 does not add new product events. The canonical v1 event set remains:

- `app.session_started`
- `entity.opened`
- `interaction.wave_sent`
- `event.rsvp_confirmed`
- `marketplace.offer_sent`
- `connection.created`
- `chat.message_sent`

PostHog dashboards and funnels must use these canonical events rather than inventing alternate activation or retention definitions.

## Rollout gate

Before enabling in production or closed testing:

1. Apply migrations `0050_product_analytics.sql` and `0062_posthog_deletion_queue.sql`.
2. Configure a stable `ANALYTICS_HMAC_KEY` independent from JWT secrets.
3. Create a dedicated staging PostHog project and configure its capture token.
4. Configure a server-only PostHog private API key with `data_deletion:read` and `data_deletion:write`.
5. Keep `POSTHOG_HOST=https://eu.i.posthog.com` and `POSTHOG_APP_HOST=https://eu.posthog.com` for EU Cloud.
6. With `POSTHOG_DELETION_QUERY_VERIFIED=false`, preview/verify the one-column deletion query against staging and confirm it targets only expected NEXA events.
7. Set `POSTHOG_DELETION_QUERY_VERIFIED=true` only after that staging verification is recorded.
8. Enable `POSTHOG_PRIVACY_ENABLED=true` and verify a controlled subject deletion reaches the provider terminal-success state and `completed` in the local audit queue.
9. Verify a cutoff deletion removes only canonical NEXA event names older than the configured retention window.
10. Produce one controlled capture event and verify PostHog receives the canonical event name and HMAC subject only.
11. Confirm no raw IDs, coordinates, free text, contact data, prices, verification data, or tokens are present in the captured event.
12. Verify the staging and production project IDs/tokens/credentials are distinct.
13. Only then enable `POSTHOG_ENABLED=true` for the matching environment.
14. Keep session replay and mobile autocapture disabled until a separate privacy review explicitly approves them.

Until steps 1–13 pass, `POSTHOG_ENABLED=false` remains the production-safe setting.

## Future reliability upgrade

The direct HTTP capture mirror remains intentionally small. If guaranteed external delivery becomes important, introduce an analytics outbox written in the same database transaction as the canonical event and deliver to PostHog from a worker. Do not make PostHog availability part of the product request transaction.

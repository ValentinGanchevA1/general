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

## Configuration

Backend environment variables:

```env
POSTHOG_ENABLED=false
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://eu.i.posthog.com
```

`POSTHOG_PROJECT_TOKEN` is a PostHog project token used only by the backend capture path. Do not expose it through the React Native configuration.

The mirror is disabled unless `POSTHOG_ENABLED=true`. If enabled without a project token, the backend logs a warning and skips delivery.

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

1. Ensure migration `0050_product_analytics.sql` is applied.
2. Configure a stable `ANALYTICS_HMAC_KEY` independent from JWT secrets.
3. Configure `POSTHOG_PROJECT_TOKEN` on the backend only.
4. Keep `POSTHOG_HOST=https://eu.i.posthog.com` for the current EU PostHog project.
5. Enable `POSTHOG_ENABLED=true` only after backend analytics tests pass.
6. Produce one controlled test event and verify PostHog receives the canonical event name and HMAC subject only.
7. Confirm no raw IDs, coordinates, free text, contact data, prices, verification data, or tokens are present in the captured event.
8. Keep session replay and mobile autocapture disabled until a separate privacy review explicitly approves them.

## Future reliability upgrade

The direct HTTP mirror is intentionally small for v1.1. If guaranteed external delivery becomes important, introduce an analytics outbox written in the same database transaction as the canonical event and deliver to PostHog from a worker. Do not make PostHog availability part of the product request transaction.

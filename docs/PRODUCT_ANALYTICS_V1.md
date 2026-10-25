# NEXA Product Analytics v1

## Purpose

Measure the map-first activation loop and D1/D7 retention without turning telemetry into a second PII/logging system.

Primary product loop:

`session -> entity detail -> meaningful interaction -> connection/chat`

The analytics stream is intentionally smaller than the application's diagnostic telemetry. Existing `track()` calls remain Sentry breadcrumbs unless they map to an explicitly allow-listed product event.

## Privacy contract

`analytics_events` never stores raw `user_id`.

Identity is isolated in `analytics_subjects`:

`users.id -> HMAC-SHA256(ANALYTICS_HMAC_KEY) -> analytics_events.subject_hash`

Rules:

- `ANALYTICS_HMAC_KEY` is independent from JWT/session secrets and must be at least 32 characters.
- Entity/user/conversation/offer IDs are never copied into event properties.
- Exact coordinates are forbidden.
- Message text, profile text, contact details, prices and verification media/results are forbidden.
- Client properties are allow-listed; backend applies the same boundary again before persistence.
- Account deletion cascades through `analytics_subjects` into `analytics_events`.
- Product events are retained 90 days by default; `ANALYTICS_RETENTION_DAYS` is clamped to 30–365 days.
- Analytics delivery is best-effort and may never fail a product action.

Privacy consequence: deleted accounts disappear from historical cohort denominators. This is intentional; deletion semantics take precedence over perfectly stable historical metrics.

## Event dictionary

| Event | Trigger | Allowed properties | Notes |
| --- | --- | --- | --- |
| `app.session_started` | authenticated NEXA launch completes | `path: map | non_map` | D1/D7 activity signal |
| `entity.opened` | successful exact person/event/listing detail resource load | `entityType: person | event | listing`, optional `surface` | v1 uses detail-load as the operational proxy for entity open |
| `interaction.wave_sent` | `/interactions/wave` returns 2xx | optional `mutual`, optional `surface` | recipient ID is discarded |
| `event.rsvp_confirmed` | RSVP mutation returns 2xx | `status: going | maybe | declined` | event ID is discarded |
| `marketplace.offer_sent` | offer creation returns 2xx | none | listing/offer IDs and amount are discarded |
| `connection.created` | mutual Wave, friend request acceptance, or dating match | `mechanism: wave | friend | dating` | relationship ID is not stored |
| `chat.message_sent` | backend text-message transaction commits | none | body and conversation ID never enter analytics |

### Entity-open caveat

`entity.opened` is currently generated from exact detail-resource requests, not a navigation impression callback. A background detail fetch can therefore add an extra event. Use this event as a **binary activation step / distinct-user metric**, not as a precise impression counter, until a UI-impression contract replaces the v1 proxy.

## Activation v1

A newly created account is **activated** when, within 24 hours of `users.created_at`, it has:

1. at least one `entity.opened`; and
2. at least one meaningful action from:
   - `interaction.wave_sent`
   - `event.rsvp_confirmed`
   - `marketplace.offer_sent`
   - `connection.created`
   - `chat.message_sent`

This deliberately avoids defining activation as app launch or map pan alone.

### Activation SQL

Replace the rollout date before operational use.

```sql
WITH params AS (
  SELECT DATE '2026-10-25' AS rollout_date
),
cohort AS (
  SELECT
    u.id AS user_id,
    u.created_at,
    s.subject_hash
  FROM users u
  CROSS JOIN params p
  LEFT JOIN analytics_subjects s ON s.user_id = u.id
  WHERE u.created_at >= p.rollout_date
    AND u.deleted_at IS NULL
),
flags AS (
  SELECT
    c.user_id,
    bool_or(e.event_name = 'entity.opened') FILTER (
      WHERE e.occurred_at < c.created_at + INTERVAL '24 hours'
    ) AS opened_entity,
    bool_or(e.event_name IN (
      'interaction.wave_sent',
      'event.rsvp_confirmed',
      'marketplace.offer_sent',
      'connection.created',
      'chat.message_sent'
    )) FILTER (
      WHERE e.occurred_at < c.created_at + INTERVAL '24 hours'
    ) AS meaningful_action
  FROM cohort c
  LEFT JOIN analytics_events e ON e.subject_hash = c.subject_hash
  GROUP BY c.user_id
)
SELECT
  COUNT(*) AS eligible_users,
  COUNT(*) FILTER (WHERE opened_entity AND meaningful_action) AS activated_users,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE opened_entity AND meaningful_action)
    / NULLIF(COUNT(*), 0),
    2
  ) AS activation_rate_pct
FROM flags;
```

## D1 / D7 retention

Retention is based on distinct authenticated launch days, not background push receipt or socket reconnect.

- D1: account has `app.session_started` on `created_at::date + 1`.
- D7: account has `app.session_started` on `created_at::date + 7`.

### Cohort SQL

```sql
WITH params AS (
  SELECT DATE '2026-10-25' AS rollout_date
),
cohort AS (
  SELECT
    u.id AS user_id,
    u.created_at::date AS cohort_date,
    s.subject_hash
  FROM users u
  CROSS JOIN params p
  LEFT JOIN analytics_subjects s ON s.user_id = u.id
  WHERE u.created_at >= p.rollout_date
    AND u.deleted_at IS NULL
),
sessions AS (
  SELECT DISTINCT subject_hash, occurred_at::date AS activity_date
  FROM analytics_events
  WHERE event_name = 'app.session_started'
)
SELECT
  c.cohort_date,
  COUNT(*) AS cohort_users,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.subject_hash = c.subject_hash
        AND s.activity_date = c.cohort_date + 1
    )
  ) AS d1_users,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.subject_hash = c.subject_hash
        AND s.activity_date = c.cohort_date + 7
    )
  ) AS d7_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.subject_hash = c.subject_hash
        AND s.activity_date = c.cohort_date + 1
    )
  ) / NULLIF(COUNT(*), 0), 2) AS d1_pct,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.subject_hash = c.subject_hash
        AND s.activity_date = c.cohort_date + 7
    )
  ) / NULLIF(COUNT(*), 0), 2) AS d7_pct
FROM cohort c
GROUP BY c.cohort_date
ORDER BY c.cohort_date DESC;
```

Only evaluate a cohort's D1/D7 after the corresponding day has fully elapsed; otherwise the metric is right-censored.

## Operational rollout

1. Apply migration `0050_product_analytics.sql`.
2. Generate a dedicated stable `ANALYTICS_HMAC_KEY` (for example `openssl rand -hex 32`).
3. Configure it on the backend deployment; do not expose it to mobile or web clients.
4. Keep `ANALYTICS_RETENTION_DAYS=90` unless there is a documented product/legal reason to change it.
5. Verify an authenticated launch creates only the coarse session event.
6. Verify Wave / RSVP / Offer failures create no product event.
7. Verify successful chat persistence produces `chat.message_sent` without message/conversation fields.
8. Delete a test account and confirm its `analytics_subjects` and `analytics_events` rows disappear via cascade.
9. Build KPI reporting from the SQL definitions above; do not redefine activation/D1/D7 independently in dashboards.

## Not in v1

- advertising attribution
- cross-device fingerprinting
- exact location analytics
- raw navigation/session replay
- message/content analytics
- trust/verification score analytics
- arbitrary dynamic event names/properties
- third-party analytics SDK

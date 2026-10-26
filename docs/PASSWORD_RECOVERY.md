# NEXA password recovery

From login, tap **Forgot password?**, enter the account email, then enter the
8-digit email code and a matching new password. Success returns to sign-in;
recovery never signs the user in automatically. Google-only accounts continue
with Google and receive the same generic request response.

## API

| Endpoint | Request | Result |
| --- | --- | --- |
| `POST /api/v1/auth/forgot-password` | `{ email }` | Generic `{ message, retryAfterSeconds: 60 }` for eligible, unknown, deleted, Google-only and email-limited accounts |
| `POST /api/v1/auth/reset-password` | `{ email, resetCode, newPassword }` | `{ message }` on success; `400 auth.invalid_reset_code` for incorrect, expired, consumed or locked challenges |

DTOs and response types are in `packages/shared/src/passwordReset.ts`. Passwords
require at least 8 characters and at most 72 UTF-8 bytes (bcrypt limit). Codes
contain exactly 8 digits. Both endpoints are unauthenticated and IP-throttled.
Provider configuration failures produce the same `503 auth.recovery_unavailable`
for all accounts. Code delivery failures do not reveal account existence.

## Deployment prerequisites

1. Apply `0051_password_reset.sql` using the normal migration runner before
   deploying the API changes. It adds the challenge/outbox table and version
   columns on users and refresh tokens; existing rows default to version 0.
2. Configure `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (verified sender), and
   `PASSWORD_RESET_SECRET` (independent random secret, at least 32 characters).
   Generate the secret locally with `openssl rand -hex 32`. Use the same value
   on every API replica. Never paste it into issues, logs or client configuration.
3. Run the normal API and Redis. Each API instance polls the durable outbox every
   5 seconds; leases coordinate instances and recover after process failure.
4. With a controlled account, verify actual inbox delivery, resend, expiration,
   reset, old-password rejection, revoked refresh rejection and new login on a
   physical device. Do not mark delivery verified from mocked transport tests.

The code does not configure production secrets, apply live migrations or send
real QA email automatically. Missing configuration disables recovery without a
fixed-code or log-code fallback. Keep the secret stable while challenges are
live; rotating it invalidates outstanding codes/outbox payloads.

## Security and lifecycle

- Cryptographically random 8-digit codes, 15-minute lifetime from request.
- Verification uses a purpose-bound HMAC; mail outbox content is AES-256-GCM
  encrypted and authenticated against the random challenge ID. No raw code in
  database rows, responses, application logs or diagnostic payloads.
- Shared Redis Lua limits: 60-second resend cooldown and 5 requests/hour per
  normalized email HMAC; identical limits for nonexistent accounts.
- At most 5 failed code checks per challenge. Failed attempts commit even though
  the endpoint returns an error; resend replaces the old challenge.
- Password update, session-version increment, refresh revocation and challenge
  consumption share one transaction with row locks. Pre-reset in-flight login
  or refresh cannot issue a refresh token against a new user version.
- Already-issued access JWTs, including established realtime sessions, retain
  the pre-existing lifetime/connection policy. This change does not implement
  immediate access-token or active-socket eviction. Access JWT TTL is 15 minutes.
- Delivery is at-least-once: a crash after provider acceptance may duplicate an
  email containing the same code. Only the latest challenge works. A claim has a
  60-second lease; failed sends retry after 30 seconds, at most 3 claims total.
  Encrypted payload is cleared on acceptance or retry exhaustion; expired rows
  are purged by the worker. No provider response body is logged.
- Mobile shows generic request confirmation, a resend countdown, inline
  validation/errors and success. Returning to login clears recovery state;
  request IDs prevent late responses from reopening a dismissed flow. Passwords
  and reset codes are not stored in Redux state or persistent storage.

## Verification

- Backend service/DTO tests cover generic responses, limits, configuration,
  attempts, expiry predicates, transactional consumption/revocation, authenticated
  encryption, outbox claims, delivery failures and refresh-version rejection.
- Mobile reducer and UI tests cover request → code → success, confirmation,
  unavailable delivery, duplicate requests and dismissed-request races.
- `apps/backend/scripts/test-password-reset-sql.cjs` exercises the real SQL and
  services against isolated PostgreSQL WASM, including migration reapplication,
  outbox delivery, lockout, resend, replay, expiry, old password/refresh rejection
  and login with the new password. To run without changing app dependencies:

```sh
RESET_QA_DIR=$(mktemp -d)
npm install --prefix "$RESET_QA_DIR" --ignore-scripts --no-audit --no-fund @electric-sql/pglite
RESET_SQL_QA_MODULE="$RESET_QA_DIR/node_modules/@electric-sql/pglite" node apps/backend/scripts/test-password-reset-sql.cjs
```

SendGrid transport follows its official Mail Send API:
https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send

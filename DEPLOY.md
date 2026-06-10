# DEPLOY — G88 production configuration

Operational reference for the `g88-api` Render service + `g88-redis`. `g88-api`
currently serves **both** REST and the in-process Socket.IO realtime gateway
(single `main.ts`; see `ARCHITECTURE.md §3.5`). A separate `g88-realtime` service
is planned but **not deployed** — there is no `main.realtime.ts` yet.
Tracks the migrations and environment variables each feature needs to go live.
**Secrets are never committed** — values shown as `…` are set in the Render
dashboard (or via the Render MCP when it's healthy). Non-secret config (price
IDs, URLs) may carry real values.

> Most env vars degrade gracefully: the feature ships inert and only activates
> once its vars are set (same pattern as FCM/Sentry). Missing secrets in
> production hard-fail only where noted.

## Migrations

Run on every deploy via `pnpm --filter @g88/backend migration:run` (idempotent;
tracked in `schema_migrations` by filename). **All migrations `0001`–`0021` are
applied to prod Supabase** (`0001`–`0019` verified 2026-06-05; `0020`/`0021`
applied 2026-06-09, verified 2026-06-10). Nothing pending.

> The former `0012` prefix collision (`achievements` + `profile_expansion`) is
> resolved: achievements moved to `0015_achievements.sql` (it has no deps and is
> the latest feature; `profile_expansion` stays `0012` ahead of `0013`/`0014`).
> `0016` = drop VIP tier, `0017` = message requests, `0018` = gifts,
> `0019` = drop Apple OAuth, `0020` = ID-verification schema (enum/column +
> `user_id_verifications`), `0021` = discovery view `verifiedBadge`.
> **Next free number is `0022`.** ⚠️ `0020` is not idempotent (raw `CREATE TYPE`/
> `ADD COLUMN`, no guards) — already applied, do not re-run.

## Environment variables (`g88-api`)

### Core (already set)
| Var                    | Notes                                                                                            |
|------------------------|--------------------------------------------------------------------------------------------------|
| `DATABASE_URL`         | Supabase managed Postgres (pooler, eu-west-1). Required in prod.                                 |
| `JWT_SECRET`           | ≥64 chars in prod. Also signs social-link OAuth `state`.                                         |
| `SENTRY_DSN`           | Both apps.                                                                                       |
| `CORS_ORIGINS`, `PORT` | Standard.                                                                                        |
| `API_PUBLIC_URL`       | Public base, e.g. `https://g88-api.onrender.com`. Used to build the social OAuth `redirect_uri`. |

### G2 — Verification (Twilio Verify) — secrets
| Var                         | Value                      |
|-----------------------------|----------------------------|
| `TWILIO_ACCOUNT_SID`        | `…`                        |
| `TWILIO_AUTH_TOKEN`         | `…`                        |
| `TWILIO_VERIFY_SERVICE_SID` | `…` (Verify service `VA…`) |

Without these in non-prod, phone verification accepts dev code `000000`; in prod it hard-fails.

### G3 — Subscriptions (Stripe)
| Var                        | Value                                               | Secret?                                                  |
|----------------------------|-----------------------------------------------------|----------------------------------------------------------|
| `STRIPE_SECRET_KEY`        | `sk_test_…` / `sk_live_…`                           | **yes** — API keys page                                  |
| `STRIPE_WEBHOOK_SECRET`    | `whsec_…`                                           | **yes** — generated when the webhook endpoint is created |
| `STRIPE_PRICE_BASIC`       | `price_…` (test, **`acct_1SgYZq`**) — ✅ wired       | no                                                       |
| `STRIPE_PRICE_PREMIUM`     | `price_…` (test, **`acct_1SgYZq`**) — ✅ wired       | no                                                       |
| `STRIPE_SUCCESS_URL`       | optional; default `https://g88.app/billing/success` | no                                                       |
| `STRIPE_CANCEL_URL`        | optional; default `https://g88.app/billing/cancel`  | no                                                       |
| `STRIPE_PORTAL_RETURN_URL` | optional; default `https://g88.app/billing`         | no                                                       |

**Webhook** (Stripe dashboard → Developers → Webhooks → Add endpoint):
- URL: `https://g88-api.onrender.com/api/v1/subscriptions/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

> ✅ **Creds landed (2026-06-05, test mode).** `STRIPE_SECRET_KEY` (`sk_test_`),
> `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC` (`price_1TdFbRQrMz3BrdsUdNVcUPHm`)
> and `STRIPE_PRICE_PREMIUM` (`price_1TdFceQrMz3BrdsUvK1RsKTo`) are set on `g88-api`.
> A **test** webhook (`we_1TewGyQrMz3BrdsU1vKbM2JL`) points at
> `/api/v1/subscriptions/webhook` for the 4 events above. The **VIP tier was removed**
> (migration `0016`) — `STRIPE_PRICE_VIP` is unused. ⏳ **Pending live verify:** the
> checkout → webhook → `subscription_tier` flip has not yet been exercised against the
> deploy. Stays **test mode** (no real charges) until explicitly taken live: swap to a
> live key + live prices before launch. Tier is set **only** by the verified webhook,
> never by the client.

### G4 — Social linking (OAuth) — per provider, secrets
A provider is inert until both its id+secret are set. Register each provider's
OAuth **redirect URI** as `https://g88-api.onrender.com/api/v1/social/callback`.

| Provider    | Vars                                                                         |
|-------------|------------------------------------------------------------------------------|
| Instagram   | `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`                             |
| X / Twitter | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` — ⚠️ needs PKCE before it works |
| TikTok      | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`                                   |
| Facebook    | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`                               |
| LinkedIn    | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`                               |
| Spotify     | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`                                 |

| Var                      | Notes                                                                                 |
|--------------------------|---------------------------------------------------------------------------------------|
| `SOCIAL_LINK_RETURN_URL` | Where the callback bounces back, e.g. a deep link or `https://g88.app/social/linked`. |

Several providers (Instagram/TikTok/Facebook) require app review before
non-test users can link.

## Status (2026-06-05)
- **Migrations**: `0001`–`0019` applied to prod Supabase (verified live 2026-06-05).
- **G2 Twilio**: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID` set on `g88-api`.
  ⏳ Phone OTP SMS not yet run-verified against the deploy.
- **G3 Stripe** (test mode): secret key, webhook secret, both price IDs, and the test
  webhook (`we_1TewGyQrMz3BrdsU1vKbM2JL`) set on `g88-api`. ⏳ checkout → webhook →
  `subscription_tier` flip not yet run-verified.
- **S3** (avatar + photo gallery): configured & verified end-to-end 2026-06-05 —
  `AWS_S3_BUCKET=g88-uploads-dev`, `AWS_REGION=eu-north-1`, access keys set on `g88-api`
  (presign → PUT → public GET round-trip passed).
- **G4 Social**: deferred — no provider creds landed.
- Env vars were set via the **Render dashboard** (the Render MCP was unreachable across
  the session). Service: `g88-api` (`srv-d8d8ujojs32c73fb1gfg`).

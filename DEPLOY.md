# DEPLOY — G88 production configuration

Operational reference for the `g88-api` (REST) and `g88-realtime` Render services.
Tracks the migrations and environment variables each feature needs to go live.
**Secrets are never committed** — values shown as `…` are set in the Render
dashboard (or via the Render MCP when it's healthy). Non-secret config (price
IDs, URLs) may carry real values.

> Most env vars degrade gracefully: the feature ships inert and only activates
> once its vars are set (same pattern as FCM/Sentry). Missing secrets in
> production hard-fail only where noted.

## Migrations

Run on every deploy via `pnpm --filter @g88/backend migration:run` (idempotent;
tracked in `schema_migrations` by filename). Pending as of P4: `0012`–`0014`.

> Numbering wart: `0012_achievements.sql` and `0012_profile_expansion.sql` share
> the `0012` prefix. Harmless (runner keys on filename + sorts so profile_expansion
> applies before 0013/0014 depend on it). **Next free number is `0015`.**

## Environment variables (`g88-api`)

### Core (already set)
| Var | Notes |
|---|---|
| `DATABASE_URL` | Managed Postgres. Required in prod. |
| `JWT_SECRET` | ≥64 chars in prod. Also signs social-link OAuth `state`. |
| `SENTRY_DSN` | Both apps. |
| `CORS_ORIGINS`, `PORT` | Standard. |
| `API_PUBLIC_URL` | Public base, e.g. `https://g88-api.onrender.com`. Used to build the social OAuth `redirect_uri`. |

### G2 — Verification (Twilio Verify) — secrets
| Var | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | `…` |
| `TWILIO_AUTH_TOKEN` | `…` |
| `TWILIO_VERIFY_SERVICE_SID` | `…` (Verify service `VA…`) |

Without these in non-prod, phone verification accepts dev code `000000`; in prod it hard-fails.

### G3 — Subscriptions (Stripe)
| Var | Value | Secret? |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` | **yes** — API keys page |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | **yes** — generated when the webhook endpoint is created |
| `STRIPE_PRICE_BASIC` | `price_1TdAg4LBDaEFgrIHwbpFJMBH` | no (test mode) |
| `STRIPE_PRICE_PREMIUM` | `price_1TdAg5LBDaEFgrIHsoCaz1wb` | no (test mode) |
| `STRIPE_PRICE_VIP` | `price_1TdAg5LBDaEFgrIHe1ZFmH2A` | no (test mode) |
| `STRIPE_SUCCESS_URL` | optional; default `https://g88.app/billing/success` | no |
| `STRIPE_CANCEL_URL` | optional; default `https://g88.app/billing/cancel` | no |
| `STRIPE_PORTAL_RETURN_URL` | optional; default `https://g88.app/billing` | no |

**Webhook** (Stripe dashboard → Developers → Webhooks → Add endpoint):
- URL: `https://g88-api.onrender.com/api/v1/subscriptions/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

> Test-mode products/prices created 2026-05-31 in account `acct_1SgCQLLBDaEFgrIH`
> (`G88 Basic/Premium/VIP`). Recreate in live mode before launch — live price IDs
> differ. Tier is set **only** by the verified webhook, never by the client.

### G4 — Social linking (OAuth) — per provider, secrets
A provider is inert until both its id+secret are set. Register each provider's
OAuth **redirect URI** as `https://g88-api.onrender.com/api/v1/social/callback`.

| Provider | Vars |
|---|---|
| Instagram | `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` |
| X / Twitter | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` — ⚠️ needs PKCE before it works |
| TikTok | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |

| Var | Notes |
|---|---|
| `SOCIAL_LINK_RETURN_URL` | Where the callback bounces back, e.g. a deep link or `https://g88.app/social/linked`. |

Several providers (Instagram/TikTok/Facebook) require app review before
non-test users can link.

## Status (2026-05-31)
- Stripe **products + prices**: created via MCP (test mode) — IDs above.
- Stripe **webhook + secret key**: dashboard-only (MCP has no webhook op; key not exposed).
- **Render env vars**: pending — Render MCP list/update operations returning
  "unknown error"; set the above in the dashboard, or retry the MCP later.

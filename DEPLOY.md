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

Applied with `pnpm --filter @g88/backend migration:run` (idempotent; tracked in
`schema_migrations` by filename). **All migrations `0001`–`0022` are applied to
prod Supabase** (`0001`–`0019` verified 2026-06-05; `0020`/`0021` applied
2026-06-09, verified 2026-06-10; `0022_events.sql` applied 2026-06-12). Nothing
pending.

> ⚠️ **Migrations are NOT auto-run on deploy** (corrected 2026-06-12). Despite
> the prior wording here, `g88-api` is on Render's **free** plan, whose build
> command (`…npx nest build`) and start command (`node …/main.js`) do not invoke
> `migration:run`, and free plans have no pre-deploy command. `main.ts` does not
> migrate on boot either. Migrations have always been applied **manually**, and
> `0022` shipped live (PR #35) without its tables until applied by hand — the
> `/events` RSVP/poll/Q&A endpoints 500'd in the interim.
>
> **Fix (apply once, in the Render dashboard → Settings → Build Command):** append
> the runner so a deploy applies migrations and fails fast (a failed migration
> fails the build and leaves the previous version serving):
> ```
> npm install -g pnpm && pnpm install --frozen-lockfile --filter @g88/shared --filter @g88/backend && cd apps/backend && npx nest build && pnpm --filter @g88/backend migration:run
> ```
> Until that change lands, **run `migration:run` against the prod `DATABASE_URL`
> by hand for every new migration** before/after merging to `master`.

> The former `0012` prefix collision (`achievements` + `profile_expansion`) is
> resolved: achievements moved to `0015_achievements.sql` (it has no deps and is
> the latest feature; `profile_expansion` stays `0012` ahead of `0013`/`0014`).
> `0016` = drop VIP tier, `0017` = message requests, `0018` = gifts,
> `0019` = drop Apple OAuth, `0020` = ID-verification schema (enum/column +
> `user_id_verifications`), `0021` = discovery view `verifiedBadge`,
> `0022` = events (RSVP/polls/Q&A tables).
> **Next free number is `0023`.** ⚠️ `0020` is not idempotent (raw `CREATE TYPE`/
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
| `NOTIFICATIONS_DIGEST_SECRET` | **Optional.** Shared secret for `POST /notifications/digest/run` (P3.3 daily digest). Set the same value on `g88-api` **and** as the `NOTIFICATIONS_DIGEST_SECRET` GitHub repo secret (used by `.github/workflows/notification-digest.yml`, daily 17:00 UTC). Unset ⇒ digest endpoint 403s and the workflow skips — push digests simply don't send. |

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
> (migration `0016`) — `STRIPE_PRICE_VIP` is unused. ✅ **Webhook path verified
> end-to-end (2026-06-12, test mode):** real hosted Checkout (card `4242…`) →
> `checkout.session.completed` + `customer.subscription.created` delivered to the prod
> onrender endpoint → signature verified against `STRIPE_WEBHOOK_SECRET` → price matched
> `STRIPE_PRICE_BASIC` → `subscription_tier` flipped `free → basic`; cancel →
> `customer.subscription.deleted` flipped it back to `free`. Confirms webhook receipt,
> signature verification, and DB reconciliation in prod. Stays **test mode** (no real
> charges) until explicitly taken live: swap to a live key + live prices before launch,
> then re-verify once against the live endpoint. Tier is set **only** by the verified
> webhook, never by the client.
> ⚠️ **Found during verify:** `STRIPE_SUCCESS_URL`/`STRIPE_CANCEL_URL`/`STRIPE_PORTAL_RETURN_URL`
> default to `https://g88.app/…`, but the apex `g88.app` is **not owned** (parked/for-sale
> on GoDaddy) — the post-checkout redirect lands on a domain-for-sale page. Set these env
> vars to an owned destination (a `g88-api.onrender.com` route or app deep link) before
> real users hit checkout. Cosmetic only — the webhook fires server-to-server regardless.

#### Going live (test → live mode)

Stripe scopes **keys, products/prices, and webhook endpoints per mode** — the test
price IDs and webhook `we_1TewGy…` do **not** exist in live mode. Recreate the live-side
objects, then flip all four env vars **together** (a live key with test price IDs →
checkout fails `No such price`; a test webhook secret with live events → every event
fails signature). Steps:

1. **Activate the account** — live keys don't exist until business details + bank account
   are submitted (Dashboard → Activate payments). Test mode needed none of this.
2. **Recreate products + prices in live mode** (toggle Test mode off): €4.99 basic,
   €9.99 premium → **new** `price_…` IDs (won't match the test ones). Record them.
3. **Live secret key**: Developers → API keys → `sk_live_…`. *(Hardening: use a restricted
   key with write access to only Customers, Checkout Sessions, Billing Portal,
   Subscriptions, Webhooks — all `subscriptions.service.ts` touches.)*
4. **Live webhook endpoint**: Developers → Webhooks → Add endpoint (live mode), URL
   `https://g88-api.onrender.com/api/v1/subscriptions/webhook`, same 4 events
   (`checkout.session.completed`, `customer.subscription.{created,updated,deleted}`).
   Copy its new `whsec_…`.
5. **Flip all four env vars on `g88-api` in one shot**, then redeploy:
   `STRIPE_SECRET_KEY` → `sk_live_…` · `STRIPE_WEBHOOK_SECRET` → live endpoint's `whsec_…`
   · `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PREMIUM` → new live price IDs. Also set
   `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` / `STRIPE_PORTAL_RETURN_URL` to an owned
   destination (see ⚠️ above — don't ship the `g88.app` parked-domain default).
6. **Redeploy** — the Stripe client is memoized at module level (`subscriptions.service.ts:16`),
   so the key only takes effect in a fresh process. A Render env-var change auto-triggers a
   redeploy, which suffices.
7. **Re-verify once with a real card** (live = real money): subscribe on a low tier, confirm
   the `free → basic` flip in Supabase, then **cancel** (billing portal or dashboard → `→ free`
   flip) and **refund** the charge from the dashboard. One real cycle proves live key +
   live webhook secret + live price mapping line up.

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
- **Migrations**: `0001`–`0022` applied to prod Supabase (`0001`–`0019` verified live 2026-06-05; `0020`–`0022` applied 2026-06-09 / 06-12). See the Migrations section above — **migrations are applied manually, not on deploy.**
- **G2 Twilio**: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID` set on `g88-api`.
  ⏳ Phone OTP SMS not yet run-verified against the deploy.
- **G3 Stripe** (test mode): secret key, webhook secret, both price IDs, and the test
  webhook (`we_1TewGyQrMz3BrdsU1vKbM2JL`) set on `g88-api`. ✅ checkout → webhook →
  `subscription_tier` flip **run-verified end-to-end 2026-06-12** (basic subscribe + cancel,
  test mode). See G3 note above; one follow-up filed — fix `STRIPE_*_URL` defaults (`g88.app`
  apex unowned).
- **S3** (avatar + photo gallery): configured & verified end-to-end 2026-06-05 —
  `AWS_S3_BUCKET=g88-uploads-dev`, `AWS_REGION=eu-north-1`, access keys set on `g88-api`
  (presign → PUT → public GET round-trip passed).
- **G4 Social**: deferred — no provider creds landed.
- Env vars were set via the **Render dashboard** (the Render MCP was unreachable across
  the session). Service: `g88-api` (`srv-d8d8ujojs32c73fb1gfg`).

## Mobile release — Google Play closed testing (Android-first)

> Decided 2026-06-11: **iOS/TestFlight is deferred** — the `ios/` native project does
> not exist (only `Podfile` + `.xcode.env`), and archiving requires macOS. Android is
> build-ready, so the beta path is **Google Play closed testing**. See `STATUS.md`.

### What's in-repo (done)
- `apps/mobile/android/app/build.gradle`: a **release signing config** reads the upload key
  from `local.properties` (`RELEASE_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD`);
  falls back to the debug key only when unset. `versionCode` auto-bumps via
  `-PversionCodeOverride=<n>`.
- `.github/workflows/android-release.yml`: builds a **signed AAB** (`bundleRelease`) on
  manual dispatch or a `v*` tag, fails if the bundle is debug-signed, and uploads
  `g88-release-aab`. `versionCode = github.run_number`.

### One-time setup (manual — owner action)
1. **Generate the upload keystore** (keep it safe + backed up — losing it requires a Play
   key reset):
   ```
   keytool -genkeypair -v -keystore upload.keystore -alias g88-upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Set GitHub repo secrets** (Settings → Secrets → Actions):
   - `ANDROID_UPLOAD_KEYSTORE_BASE64` — `base64 -w0 upload.keystore` (the file, base64'd)
   - `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS` (`g88-upload`),
     `ANDROID_UPLOAD_KEY_PASSWORD`
   - (Reuses existing `GOOGLE_MAPS_API_KEY_RELEASE` + `GOOGLE_SERVICES_JSON` secrets.)
3. **Play Console** ($25 one-time): create app `com.g88`, opt into **Play App Signing**
   (Google holds the signing key; the keystore above is only the *upload* key), create a
   **Closed testing** track + tester list.
4. **Restrict the Maps release key to the Play App Signing SHA-1** (else testers get a
   **blank/grey map**). A Maps Android key is keyed on *package name + the SHA-1 of the cert
   that signed the **installed** app*. Play **re-signs** every download with its own **App
   signing key**, so the cert testers run is *not* your upload key or debug key.
   - **Get the SHA-1:** Play Console → app `com.g88` → *Test and release → Setup → App
     integrity → App signing* → copy the **App signing key certificate** SHA-1. (You can't
     compute this locally — Google holds that key.)
   - **Apply it:** Google Cloud Console → *APIs & Services → Credentials* → open the key
     behind `GOOGLE_MAPS_API_KEY_RELEASE` → **Application restrictions = Android apps**,
     **API restrictions = Maps SDK for Android** → add row: package `com.g88` + the App
     signing SHA-1. Recommended: add a **second** row with the *upload key* SHA-1 too (same
     page in Play Console), so a sideloaded upload-signed AAB also renders.
   - `GOOGLE_MAPS_API_KEY_DEBUG` is a separate key for local/emulator builds (restricted to
     your debug cert) — leave it alone; it never ships.
   - **Confirm:** install from the closed track and open the map. If still grey,
     `adb logcat | grep -i "Authorization"` echoes the SHA-1 + `com.g88` the device
     presented — compare it to the key's restriction.
5. **Store listing minimums**: app name, short + full description, icon, feature graphic,
   **privacy policy URL** (required — app collects location), and the **Data Safety form**
   (declare: precise/approximate **location**, account info; note location is fuzzed to
   ~120m server-side per `ARCHITECTURE.md §3.3`).
6. **First upload is manual**: run `android-release.yml` (Actions → Run workflow), download
   the `g88-release-aab` artifact, upload it to the closed track in the Console. Play
   requires the first release to be created by hand.

### After first upload — automated publishing (wired)
`android-release.yml` has a **Publish to Google Play** step (`r0adkll/upload-google-play`)
that uploads the signed AAB to a Play track. It **auto-skips** until the service-account
secret exists (the build still produces the artifact), so it's safe before setup.

**Prerequisites (Play API rules):** the app `com.g88` must already exist in the Console
**and** have had at least one **manual** release on the target track — the API cannot
create the app or seed an empty track.

**One-time setup:**
1. **Google Cloud Console** (the project linked to Play): create a **service account**,
   no roles needed in GCP. Create a **JSON key** for it.
2. **Play Console → Users and permissions → Invite new user**: add the service-account
   email; grant **app access** to `com.g88` with **Release → Manage testing track releases**
   (and "Create and publish" as needed). Wait a few minutes for propagation.
3. **GitHub secret:** `gh secret set PLAY_SERVICE_ACCOUNT_JSON < service-account.json`
   (paste the whole JSON). Once present, the publish step activates automatically.

**Running it:**
- **Manual:** Actions → *Android Release (AAB)* → Run workflow. Inputs: `track` (your
  closed-track name, or `alpha`/`internal`), `publish` (default true), `status`
  (`completed` to go live to testers, or `draft`).
- **On tag:** pushing a `v*` tag builds and publishes with the defaults
  (`track=alpha`, `status=completed`).
- **Release notes:** pulled from `apps/mobile/distribution/whatsnew/whatsnew-en-US`
  (keep ≤ 500 chars; add `whatsnew-<lang>` files to localize).

> ⚠️ Confirm your closed track's **track name** matches the `track` input. Internal
> testing = `internal`; the default closed track = `alpha`; a custom closed track uses
> the name you gave it. A wrong track name makes the API call fail.

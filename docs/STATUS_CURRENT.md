# G88 — current status (authoritative snapshot)

> Synced 2026-08-27. Full historical log remains in root `STATUS.md`.

# STATUS — G88 Reconciliation & P1

> **Last updated:** 2026-08-27
> **HEAD:** master · **Next free migration:** `0035`
>
> ### ✅ Where we are / ⏭️ What's next (read this first)
>
> **Shipped (code on master):**
> - **P1–P3** complete (auth, map, presence, wave, chat, gamification, gifts, push/geofences, verification UI, events, trending, trading).
> - **Friends** (migrations `0032`/`0033`): requests, presence privacy, mutual list, suggestions, request notifications + badge, interactions inbox.
> - **Stories (P4.S)** + email OTP soft gate; Pulse strip placement.
> - **Profile origin** (DOB 18+, hometown) — migration `0031` after dual-`0030` resolution.
> - **ID verification (manual review):** submit → S3 → `pending`; admin queue (`apps/admin` @ `127.0.0.1:5173`); **atomic decide** (`WHERE status='pending'`); **partial UNIQUE** one pending per user (`0034`); **live** `verification:updated` on `/admin` WS; **assist-only Rekognition** (no auto-approve).
> - **Admin approve path:** UI queue **or** `pnpm --filter @g88/backend id:approve` (`scripts/approve-id-verification.mjs`) — requires `ADMIN_USER_IDS` + `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
> - Android sideload APK + signed AAB pipelines; privacy policy live.
>
> **Ops gaps (not code blockers):**
> 1. **Rekognition on Render** — set `REKOGNITION_ENABLED=true`, matching `AWS_REGION`/S3, IAM `DetectFaces`+`CompareFaces` on `g88-dev` (see `.env.example`). Until then status stays `skipped`/`error`; human decide still works.
> 2. **Twilio email OTP** — often fails; Redis/dev fallback logs codes. Wire real email channel for prod.
> 3. **Play Console** — owner-side closed testing still open (`DEPLOY.md`).
> 4. **G2/G3 live exercise** — Twilio SMS + Stripe test checkout not fully run-verified on deploy.
>
> **Next, in order:**
> 1. Enable Rekognition in prod env + one E2E submit → admin score visible.
> 2. Ensure at least one user UUID in `ADMIN_USER_IDS` on Render; approve pending via UI or `id:approve`.
> 3. Play closed testing (owner).
> 4. Live-verify phone OTP + Stripe test webhook path.
>
> Update this file as work progresses. It's the single source of truth for "where are we?".

## Rekognition (next ops step)

1. IAM on `g88-dev`: `rekognition:DetectFaces`, `rekognition:CompareFaces`, `s3:GetObject` on `verifications/*`.
2. Render env: `REKOGNITION_ENABLED=true`, `AWS_REGION=eu-north-1`, keys, `AWS_S3_BUCKET`.
3. Redeploy → mobile ID submit → admin detail shows similarity (or `no_face_*` / `error`).
4. Human still decides via UI or `pnpm --filter @g88/backend id:approve`.

See `docs/ID_VERIFICATION_OPS.md`.

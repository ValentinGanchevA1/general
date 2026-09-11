# G88 — current status (authoritative snapshot)

> **Synced:** 2026-09-11  
> **HEAD:** master · **Next free migration:** `0041`  
> Full historical log: root `STATUS.md`.

## Where we are

### Shipped on master (code)

| Area | Notes |
|---|---|
| **P1–P3 core** | Auth, map, presence, wave, chat, gamification, gifts, push/geofences, verification UI, events, trading |
| **Friends** | Migrations `0032`/`0033`; requests, presence privacy, mutual, suggestions, notifications + badge, interactions inbox |
| **Stories (P4.S)** | Migration `0029+`; create (photo/video ≤15s), Pulse strip, viewer with `react-native-video`, progress, mute, hold, reactions |
| **Profile** | Origin (DOB 18+, hometown), cover photo, storyline, follow/friend CTAs, strike standing surfaces |
| **Map chrome** | City-scale GPS center, listing mode + friendsOnly filters, entity sheet (Message → `/conversations`), empty/nudge de-stack, discovery cell-cap (≤5k) |
| **Marketplace** | Listings sell/wanted, offers + counter, map focus post-create |
| **ID verification** | Submit → S3 → pending; admin queue; atomic decide; partial UNIQUE pending; WS `verification:updated`; Rekognition **assist-only** |
| **Admin** | Vite @ `127.0.0.1:5173`; `ADMIN_USER_IDS`; `pnpm id:approve` / `id:review` |
| **Migrations** | Through `0040` (conversation kind, strikes, trade counter). **Next free: `0041`** |

### Recent hard fixes (2026-09-11)

- Discovery OOM: `MAX_CELLS_PER_VIEWPORT=5000` + estimate margin before `polygonToCells`
- Map: `hasCenteredOnUserRef` (don’t gate on continent default region); empty only city-scale Δ≤0.25
- Entity sheet Message path aligned to `POST /conversations`
- Discovery specs: city VIEWPORT + antimeridian lat scale + mockClear

## Ops gaps (not code blockers)

1. **Rekognition on Render** — `REKOGNITION_ENABLED=true`, matching `AWS_REGION`/S3, IAM `DetectFaces` + `CompareFaces` on `g88-dev`. Until then assist status stays `skipped`/`error`; human decide still works. See `docs/ID_VERIFICATION_OPS.md`.
2. **Twilio email OTP** — often fails in prod; Redis/dev fallback logs codes. Wire real email channel for prod.
3. **Play Console** — owner closed testing still open (`DEPLOY.md`).
4. **G2/G3 live exercise** — Twilio SMS + Stripe test checkout not fully run-verified on deploy.

## Next (priority order)

1. **Device smoke** — cold start city map · sheet Message → chat · story photo+video post/view · listing photo upload.
2. **Ops** — Rekognition env + one E2E submit → admin score; ensure `ADMIN_USER_IDS` on Render; approve via UI or `id:approve`.
3. **Twilio email** — prod OTP path without DEV code.
4. **Play closed testing** (owner).
5. **Product** — activation residual (trust card), strike appeal copy, map chrome declutter vs EventsRail.

## Rekognition checklist

1. IAM on `g88-dev`: `rekognition:DetectFaces`, `rekognition:CompareFaces`, `s3:GetObject` on `verifications/*`.
2. Render: `REKOGNITION_ENABLED=true`, `AWS_REGION=eu-north-1` (match S3), keys, `AWS_S3_BUCKET`.
3. Redeploy → mobile ID submit → admin detail shows similarity (or `no_face_*` / `error`).
4. Human still decides via UI or `pnpm --filter @g88/backend id:approve`.

Update this file when migrations or product state change. Single source of truth for “where are we?”.

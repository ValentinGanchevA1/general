# G88 — current status (authoritative snapshot)

> **Synced:** 2026-09-24  
> **HEAD:** master · **Next free migration:** `0044`  
> Full historical log: root `STATUS.md`.

## Where we are

### Shipped on master (code)

| Area | Notes |
|---|---|
| **P1–P3 core** | Auth, map, presence, wave, chat, gamification, gifts, push/geofences, verification UI, events, trading |
| **Friends** | Migrations `0032`/`0033`; requests, presence privacy, mutual, suggestions (rank C + dismiss `0043`), notifications + badge, interactions inbox |
| **Stories (P4.S)** | Create (photo/video ≤15s), Pulse strip, viewer (`react-native-video`), reactions; soft post gate (email + 24h); strike thresholds enforced |
| **Profile** | Origin (DOB 18+, hometown), cover photo, storyline, follow/friend CTAs, strike standing surfaces |
| **Map discovery** | City-scale GPS center, rankBy relevance/distance/newest, PostGIS KNN distance, listing mode + friendsOnly, cell-cap ≤5k, content-aware diff |
| **Map chrome (calm v1)** | People/Events/Listings labels · More sheet (Friends + listing mode) · GPS recenter · pan-dismiss daily challenge · `+` create chip in filter row · coach v2 (pin → create → wave → pulse) |
| **Map empty / create** | Context empty copy · one-shot create nudge after coach v1|v2 · Tap + / long-press copy |
| **Map online dots** | Green pip on user markers when `meta.online` (server-gated: friendship + `friends_see_online_status`) |
| **EntityBottomSheet** | Above-fold listing price·distance · event time·distance · Message seller/host · mutual · stats |
| **Marketplace** | Listings sell/wanted, offers + counter, ListingDetail Message seller, map focus post-create |
| **Presence / ranking** | Redis `presence:last_seen`; discovery `lastSeenAt` for allowlisted friends; scoring activityScore |
| **Push** | FCM multicast + invalid-token prune |
| **ID verification** | Submit → S3 → pending; admin queue; atomic decide; partial UNIQUE pending; WS `verification:updated`; Rekognition **assist-only** |
| **Admin** | Vite @ `127.0.0.1:5173`; `ADMIN_USER_IDS`; `pnpm id:approve` / `id:review` |
| **Migrations** | Through **`0043`** (`friend_suggestion_dismissals`). **Next free: `0044`** |

### Closed since STATUS_CURRENT 2026-09-19

| PR / area | What |
|-----------|------|
| #394 | Map cold-start city-scale (`useMapFocus` setRegion + animate retries) |
| #401 / #403 | Friends suggestions rank C + migration `0043` (immutable index fix) |
| #404–#405 | Map layers Dating/Events/Trading → discovery kinds; Interactions badge under filter |
| #408 | FCM soft-fail when no default Firebase app |
| #409 | Map calm v1 — labels, More sheet, recenter, pan-dismiss challenge |
| #410 | `+` create chip + coach v2 |
| #411 | EntityBottomSheet above-fold price/time + distance |
| #412 | Empty create nudge after coach v2 + map online dots; MapCoachMarks set-state-in-effect defer |

### Offer → chat handoff

- ListingDetail: Message → `POST /conversations` → Chat (on master).
- EntityBottomSheet Message aligned to `/conversations` (seller/host after 0041/0042).

## Ops gaps (not code blockers)

1. **Rekognition on Render** — set `REKOGNITION_ENABLED=true`, matching `AWS_REGION`/S3, IAM `DetectFaces` + `CompareFaces` on upload user. Until then assist stays `skipped`/`error`; human decide still works. See `docs/ID_VERIFICATION_OPS.md`.
2. **`ADMIN_USER_IDS` on Render** — production admin cannot queue-decide without it.
3. **Twilio email OTP** — often fails in prod; Redis/dev fallback logs codes. Wire real email channel for prod.
4. **Play Console** — owner closed testing still open (`DEPLOY.md`).
5. **G2/G3 live exercise** — Twilio SMS + Stripe test checkout not fully run-verified on deploy.

## Next (priority order)

1. **Trust ops (Render)** — env + one E2E: ID submit → admin score/similarity → approve via UI or `id:approve`.
2. **Device smoke** — cold start city map · create banner after coach v2 · online pip · sheet Message → chat · ListingDetail Message seller · story photo+video · listing photo upload.
3. **Twilio email** — prod OTP without DEV code.
4. **Play closed testing** (owner).
5. **Product** — friends density / suggestions quality surfaces; push delivery metrics beyond token prune.

## Rekognition checklist (do this now)

1. IAM on upload/`g88-dev` user: `rekognition:DetectFaces`, `rekognition:CompareFaces`, `s3:GetObject` on `verifications/*`.
2. Render backend env: `REKOGNITION_ENABLED=true`, `AWS_REGION=eu-north-1` (must match S3), keys, `AWS_S3_BUCKET`.
3. Ensure `ADMIN_USER_IDS` includes at least one real admin UUID (comma-separated).
4. Redeploy → mobile ID submit → admin detail shows similarity (or `no_face_*` / `error`).
5. Human decides via admin UI (`127.0.0.1:5173`) or:
   ```bash
   pnpm --filter @g88/backend id:approve -- --user <uuid>
   pnpm --filter @g88/backend id:review
   ```

Update this file when migrations or product state change. Single source of truth for “where are we?”.

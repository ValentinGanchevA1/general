# G88 — current status (authoritative snapshot)

> **Synced:** 2026-09-29 (evening)  
> **HEAD:** master · **Next free migration:** `0047`  
> Full historical log: root `STATUS.md`.

## Where we are

### Shipped on master (code)

| Area | Notes |
|---|---|
| **P1–P3 core** | Auth, map, presence, wave, chat, gamification, gifts, push/geofences, verification UI, events, trading |
| **Friends** | Migrations `0032`/`0033`; requests, presence privacy, mutual, suggestions (rank C + dismiss `0043`), density UI + dismiss metrics (`#453`–`#458`), notifications + badge, interactions inbox |
| **Stories (P4.S)** | Create (photo/video ≤15s), Pulse strip, viewer (`react-native-video`), reactions; soft post gate (email + 24h); strike thresholds enforced |
| **Profile** | Origin (DOB 18+, hometown), cover, storyline, identity (gender/orientation/nationality `0045`), ProfileView self+other, follow/friend CTAs, strike standing, `resolveUserPrimaryCta` |
| **Dating prefs** | Migration `0046` `open_to_dating` + seeking; discovery `datingOnly`; Map Dating filter; empty → ProfileEdit `focus=dating` (`#452`/`#457`) |
| **Map discovery** | City-scale GPS center, rankBy relevance/distance/newest, PostGIS KNN, listing mode + friendsOnly + datingOnly, cell-cap ≤5k |
| **Map chrome** | People/Events/Listings · More sheet · GPS recenter · pan-dismiss challenge · `+` create · coach v2 |
| **EntityBottomSheet** | Listing/event above-fold meta · Message seller/host · mutual · ProfileTrustBlock + ProfileStatsRow · identity via ProfileIdentityLine |
| **Marketplace** | Listings sell/wanted, offers + counter, urgency (`0044` expires/bump), ListingDetail Message seller, post-create map focus |
| **Presence / ranking** | Redis `presence:last_seen`; discovery `lastSeenAt` for allowlisted friends |
| **Push** | FCM multicast + invalid-token prune |
| **ID verification** | Submit → S3 → pending; admin queue; atomic decide; partial UNIQUE pending; WS `verification:updated`; Rekognition **assist-only** |
| **Admin** | Vite @ `127.0.0.1:5173`; `ADMIN_USER_IDS`; `pnpm id:approve` / `id:review` |
| **Migrations** | Through **`0046`** (`dating_preferences`). **Next free: `0047`** |

### Closed recently (code)

| Area | What |
|---|---|
| ProfileView A–D | Shared presentational body; ProfileScreen + UserProfile thin data wrappers (`#445`–`#448`) |
| #449–#451 | EntityBottomSheet trust/stats + identity line + CTA styles restore |
| Listing urgency | `0044` expires_at/bumped_at + bump API + mobile surfaces |
| Profile identity public | `0045` + formatPublicIdentityParts on profile + sheet |
| Dating prefs + activation | `0046` + Map Dating filter; empty CTA → ProfileEdit (`#452`); `focus=dating` scroll (`#457`) |
| Friends suggestions density | MutualPreviewStack, rail dismiss, Suggestions feedback (`#453`–`#455`); MapScreen typecheck (`#456`) |
| Suggestions metrics | `track('suggestions.dismiss'|'add')` rail+list; session empty copy (`#458`) |

## Ops gaps (not code blockers)

1. **Rekognition on Render** — `REKOGNITION_ENABLED=true`, matching `AWS_REGION`/S3, IAM `DetectFaces` + `CompareFaces`. See `docs/ID_VERIFICATION_OPS.md`.
2. **`ADMIN_USER_IDS` on Render** — required for production queue-decide.
3. **Twilio email OTP** — prod channel; Redis/dev fallback still logs codes.
4. **Play Console** — closed testing (`DEPLOY.md`).
5. **Migrations on Render** — ensure **0044–0046** applied on prod.
6. **G2/G3 live exercise** — Twilio SMS + Stripe test checkout not fully run-verified.

## Next (priority order)

1. **Trust ops (Render)** — env + E2E: ID submit → admin score → approve.
2. **Device smoke** — cold-start city map · Dating filter + ProfileEdit focus · sheet identity/trust · ListingDetail Message · story photo+video · suggestions dismiss.
3. **Twilio email** — prod OTP without DEV code.
4. **Play closed testing** (owner).
5. **Product** — push delivery metrics; optional block-by-author on events/listings; next slice TBD.

## Rekognition checklist

1. IAM: `rekognition:DetectFaces`, `rekognition:CompareFaces`, `s3:GetObject` on `verifications/*`.
2. Render: `REKOGNITION_ENABLED=true`, `AWS_REGION=eu-north-1`, keys, `AWS_S3_BUCKET`.
3. `ADMIN_USER_IDS` includes at least one admin UUID.
4. Redeploy → mobile ID submit → admin similarity (or `no_face_*` / `error`).
5. Decide via admin UI or `pnpm --filter @g88/backend id:approve -- --user <uuid>`.

Update this file when migrations or product state change.

<!-- C:\Users\vganc\g88\SPECIFICATION.md -->

# G88 — Feature Specifications

> **Authoritative source for per-feature contracts: user story, API, data model, WS events, UI surface, acceptance.**
> Sibling docs: `PRODUCT.md` (what/why), `ROADMAP.md` (when), `ARCHITECTURE.md` (how the system is wired).
> Last revised: 2026-08-13 (added §2.8–§2.11 for shipped-but-undocumented features; §2.7 and §3.2 status corrected; §4 outlines marked shipped; original body dated 2026-05-23).

---

## How to read this doc

- **§1 Conventions** — read once. Applies to every feature below.
- **§2 P1 (shipped)** — retroactive documentation. Source of truth for what's deployed; reference when modifying.
- **§3 P2 (forward specs)** — contract before code. Implementing these.
- **§4 P3 (outlines)** — placeholder. Full spec lands at sprint start.
- **§5 Shared types** — domain enums and shapes referenced throughout.

---

## §1 — Conventions

### Base URLs
- **Production:** `https://api.g88.app/api/v1`
- **Local (Android emulator):** `http://10.0.2.2:3001/api/v1`
- **Local (iOS sim / desktop):** `http://localhost:3001/api/v1`
- **WebSocket:** same host, namespaces `/chat` and `/events`

### Auth
- All non-public routes require `Authorization: Bearer <accessToken>`
- WS handshake: `socket.handshake.auth.token`
- Token TTLs: access **15m**, refresh **7d** (opaque, DB-rotated)
- On 401, client must `POST /auth/refresh { refreshToken }` and retry

### Error response envelope
All errors normalized by `AllExceptionsFilter`:
```json
{ "statusCode": 400, "timestamp": "2026-05-23T12:00:00.000Z", "path": "/api/v1/...", "message": "human-readable" }
```

### Pagination
Cursor-based by default: `?limit=20&cursor=<opaque>`. Response includes `nextCursor` (null on last page).

### Rate limiting
Three tiers via `ThrottlerGuard`: 10/1s · 40/10s · 120/60s. Per-endpoint overrides via `@Throttle({...})` or `@SkipThrottle()`.

### Common WS events (outbound from server)

| Event           | Payload                    | Trigger           |
|-----------------|----------------------------|-------------------|
| `user:online`   | `{ userId, at }`           | User comes online |
| `user:offline`  | `{ userId, at }`           | Heartbeat lapses  |
| `nearby:update` | `{ userId, lat, lng, at }` | Nearby user moves |

### Shared response shapes
```typescript
// packages/shared/src/api.ts
type ApiOk<T>     = { data: T; meta?: Record<string, unknown> };
type ApiError    = { statusCode: number; timestamp: string; path: string; message: string };
type Cursor      = string | null;
type Paginated<T>= { items: T[]; nextCursor: Cursor };
```

---

## §2 — P1 features (shipped, retroactive documentation)

### §2.1 — Auth (A1 + A2)

**User story.** As a new user, I can create an account with email/password or Google. Returning users stay signed in across app restarts and survive token expiry without re-login.

**Status.** ✅ Shipped. Opaque rotating refresh tokens (A1). Google OAuth (A2). Apple Sign-In = P2 (see §3.3) — **note:** A3's prior migration (`0009_apple_oauth.sql`) was reverted by `0019_drop_apple_oauth.sql`; there is currently no Apple OAuth schema or route. A3 is a from-scratch build, not a resume.

**API**

| Method | Path             | Auth | Body / Notes                                                           |
|--------|------------------|------|------------------------------------------------------------------------|
| POST   | `/auth/register` | No   | `{ email, password, name? }` → token pair                              |
| POST   | `/auth/login`    | No   | `{ email, password }` → token pair                                     |
| POST   | `/auth/google`   | No   | `{ idToken }` → verifies via google-auth-library → upsert → token pair |
| POST   | `/auth/refresh`  | No   | `{ refreshToken }` → rotates and returns new pair                      |
| POST   | `/auth/logout`   | JWT  | Revokes the refresh token (DB row deleted)                             |
| GET    | `/auth/me`       | JWT  | Returns full `User` with `profile`, `badges`, `settings`               |

**Data model**
- `User` (see §5.1)
- `RefreshToken { id, userId, tokenHash, expiresAt, revokedAt? }` — server-side rotation, never returned in plaintext after issue

**Token rotation rules**
- Every successful `/auth/refresh` issues a new refresh token AND revokes the old one (single-use).
- If a revoked token is re-presented → all refresh tokens for that user revoked (replay defense) → user forced to log in.

**Acceptance** (regression checklist)
- Register, then immediately `/auth/me` returns the user.
- Tokens expire at exactly 15m / 7d.
- Old refresh token after rotation returns 401.
- Replay of an already-revoked refresh token logs the user out everywhere.
- Google sign-in with a brand-new email creates a user with `passwordHash = NULL`.

### §2.2 — Profile

**User story.** After signup, I complete a multi-step profile (basics → photos → interests → goals → location prefs). I can edit any field later. My profile completion is the gate to entering the main app.

**Status.** ✅ Shipped.

**API**

| Method | Path                    | Auth | Notes                                        |
|--------|-------------------------|------|----------------------------------------------|
| GET    | `/users/me`             | JWT  | Current user                                 |
| PATCH  | `/users/me`             | JWT  | Partial update of profile fields             |
| POST   | `/users/profile`        | JWT  | Create or update structured profile blob     |
| POST   | `/users/me/photos`      | JWT  | Returns S3 presigned PUT url; client uploads |
| DELETE | `/users/me/photos/:idx` | JWT  | Remove photo at slot                         |
| PATCH  | `/users/me/visibility`  | JWT  | `{ isVisible: boolean }`                     |
| DELETE | `/users/me`             | JWT  | Account deletion (cascades)                  |

**Data model**
- `User.profile` is JSONB. Shape (`UserProfile`, see §5.2):
```typescript
{
  displayName: string;
  bio?: string;
  dateOfBirth?: ISODate;
  gender?: Gender;
  interestedIn?: Gender[];
  interests: string[];   // free-form tags from INTEREST_OPTIONS
  goals: Goal[];         // dating | friends | events | trading | networking
  photos: PhotoSlot[];   // ordered, slot 0 = primary
  completedAt?: ISODate; // gate value for entering main app
}
```

**UI**
- Mobile: `ProfileCreationScreen` (multi-step), `ProfileScreen` (view own), `ProfileEditScreen` (edit), `UserProfileScreen` (view other, modal presentation).
- Completion gate enforced in `AppNavigator.tsx`: if `!user.profile.completedAt` → only `ProfileCreation` screen accessible.

**Acceptance**
- A user without `profile.completedAt` cannot navigate to `Main`.
- Photos upload directly to S3 via presigned URL; backend stores S3 key only.
- Visibility toggle is honored within 5s — the user disappears from other users' map views.

### §2.3 — Map Discovery

**User story.** Open app → see a real-time map of nearby people, events, and listings. Filter by category (dating / trading / events). Tap a dot → see preview → wave or chat.

**Status.** ✅ Shipped. Performance optimization = M1 (P2 §3.5).

**API**

| Method | Path                  | Auth | Notes                                                                                                                                                                                                                               |
|--------|-----------------------|------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| POST   | `/locations/update`   | JWT  | `{ latitude, longitude }` → writes PostGIS + Redis GEO                                                                                                                                                                              |
| POST   | `/discovery/nearby`   | JWT  | Viewport body → `{ users[], events[], listings[] }`. **Corrected 2026-07-04:** this replaces `GET /locations/map-data` below, which does not exist — there is no `locations` module; nearby/geo logic lives in `modules/discovery`. |
| GET    | `/discovery/profiles` | JWT  | Swipe deck (proximity + interests + filters)                                                                                                                                                                                        |

**Geo writes (per `/locations/update`)**
1. PostGIS: `UPDATE users SET location = ST_SetSRID(ST_MakePoint($lng,$lat),4326), last_seen=NOW() WHERE id=$uid`
2. Redis: `GEOADD user:locations $lng $lat $uid`
3. WS broadcast: `nearby:update` to all users with `$uid` in their viewport
4. Location is fuzzed to H3 r10 cell centroid at write time — no raw coordinates persisted or logged (privacy hard invariant)

**Geo reads (per `POST /discovery/nearby`)**
- Primary: `RedisService.geoRadius('user:locations', lng, lat, radiusKm)` → user IDs + distances
- Hydrate from Postgres for `displayName`, primary photo, verification badges
- Fallback to PostGIS `ST_DWithin` if Redis miss
- Excludes blocked users in both directions (see §2.7 Blocks)
- Bounded by an OOM guard before H3 `polygonToCells` enumeration (pre-enumeration area estimate cap `200_000`; separate UX display cap `5_000` — these two caps serve different purposes and must not be conflated)

**UI**
- `MapScreen` — single map, three overlay layers (users · events · listings), top filter bar.
- Tap dot → bottom sheet preview → "View profile" or "Wave".
- Category colors: dating `#FF69B4` · trading `#4CAF50` · events `#FF9800` · current user `#007AFF`.

**Acceptance**
- Map renders within 1s median on cold start.
- Moving the map triggers a new fetch only after a 300ms pan-debounce.
- Users with both `dating` and `trading` goals show as two semi-transparent dots (primary + `-secondary` suffix at 0.5 opacity).
- `isVisible: false` users do not appear, ever.

### §2.4 — Presence

**User story.** Other users see me as "online" when I'm in the app. I see who's online nearby. Presence updates within 5s.

**Status.** ✅ Shipped.

**Mechanism**
- `lastSeenAt` on user updated on every authenticated REST hit and every WS heartbeat.
- "Online" = `lastSeenAt > now - 5 minutes`.
- WS events `user:online` / `user:offline` broadcast to viewport peers.

**API**

| Method | Path                   | Auth | Notes                                 |
|--------|------------------------|------|---------------------------------------|
| GET    | `/users/online/nearby` | JWT  | `?lat&lng&radiusKm` → online user IDs |

**Acceptance**
- Closing the app → user shows offline to peers within 5 minutes (worst case).
- Re-opening the app → user shows online within 5s.

### §2.5 — Wave

**User story.** I can "wave" at someone with one tap — a no-commitment outreach lighter than a like or a message. They get a notification. They can wave back or ignore.

**Status.** ✅ Shipped.

**API**

| Method | Path                               | Auth | Notes           |
|--------|------------------------------------|------|-----------------|
| POST   | `/interactions/wave`               | JWT  | `{ toUserId }`  |
| GET    | `/interactions/waves/received`     | JWT  | `?cursor&limit` |
| GET    | `/interactions/waves/sent`         | JWT  |                 |
| GET    | `/interactions/waves/unread/count` | JWT  |                 |
| POST   | `/interactions/waves/:id/read`     | JWT  | Mark read       |

**Data model**
```typescript
Wave {
  id: uuid;
  fromUserId: uuid;
  toUserId: uuid;
  createdAt: timestamp;
  readAt?: timestamp;
}
// Unique constraint: (fromUserId, toUserId) within 24h — prevents spam
```

**WS event**
- Outbound: `wave:receive` → `{ id, fromUserId, fromUserPreview, at }` to `user:{toUserId}` room
- Client dispatches `interactionsSlice.addReceivedWave`

**Acceptance**
- Sender cannot wave at same user > once / 24h (409 if attempted).
- Wave appears for recipient in real time if online; via FCM push if not (P3).

### §2.6 — Chat (1:1)

**User story.** I can open a 1:1 chat with anyone I've waved at, matched with, or messaged before. Messages arrive in real time. History persists across devices.

**Status.** ✅ Shipped. Outbox reliability = C6 (P2 §3.4).

**API**

| Method | Path                               | Auth | Notes                                                                    |
|--------|------------------------------------|------|--------------------------------------------------------------------------|
| GET    | `/chat/conversations`              | JWT  | `?cursor&limit` — sorted by `lastMessageAt` desc                         |
| GET    | `/chat/conversations/:id/messages` | JWT  | `?cursor&limit` — historical messages                                    |
| POST   | `/chat/messages`                   | JWT  | `{ recipientId, content, type? }` — fallback to REST when WS unavailable |
| POST   | `/chat/conversations/:id/read`     | JWT  | Marks all messages read up to now                                        |

**Data model**
```typescript
Conversation {
  id: uuid;
  participantIds: uuid[2];      // exactly 2, sorted lexicographically
  lastMessageAt: timestamp;
  lastMessageId?: uuid;
}

Message {
  id: uuid;
  conversationId: uuid;
  senderId: uuid;
  type: 'text' | 'image' | 'system';
  content: string;              // for image type: S3 key
  createdAt: timestamp;
  readAt?: timestamp;
  clientMessageId?: string;     // idempotency key for outbox retries (P2.C6)
}
// Unique: (senderId, clientMessageId) — prevents double-send on retry
```

**WS namespace `/chat`**

| Direction | Event             | Payload                                                                  |
|-----------|-------------------|--------------------------------------------------------------------------|
| in        | `message:send`    | `{ recipientId, content, type, clientMessageId }`                        |
| out       | `message:receive` | full `Message` (to both sender + recipient rooms)                        |
| out       | `message:ack`     | `{ clientMessageId, serverId }` (echoed back to sender for outbox state) |
| out       | `message:typing`  | `{ conversationId, userId }`                                             |

**Acceptance**
- Message sent over WS is delivered to recipient within 1s when both online.
- REST fallback (`POST /chat/messages`) emits the same `message:receive` event server-side.
- Read receipts: recipient calling `/read` triggers `message:read` WS event back to sender.

---

### §2.7 — Blocks (added 2026-07-04, undocumented until now)

**User story.** I can block another user. Once blocked, we disappear from each other's map/discovery, can't message each other, and my waves to them are prevented.

**Status.** 🟡 Mostly shipped (backend + mobile UI live since PR #78/#79, 2026-06-28). Confirmed enforced in code as of 2026-08-13: discovery, messaging, `gifts.service.ts` (send-time guard, PR #89), `users.service.ts`. **Not confirmed enforced:** no `isBlocked` call found in `interactions.service.ts` (waves) — `ROADMAP.md` P2.B1 marks this item fully closed, which this doesn't match; verify waves before trusting that closure.

**API**

| Method | Path              | Auth | Notes                        |
|--------|-------------------|------|------------------------------|
| POST   | `/blocks`         | JWT  | `{ blockedUserId }`          |
| DELETE | `/blocks/:userId` | JWT  | Unblock                      |
| GET    | `/blocks`         | JWT  | List currently blocked users |

**Data model**
- `0026_blocks.sql` — `user_blocks` table, symmetric indexed (fast lookup from either direction)

**Enforcement**
- `discovery.service.ts` — excludes blocked users in both directions from nearby/viewport queries
- `messaging.service.ts` — `isBlocked()` helper + early-return in `permissionFor()`
- **Not yet enforced (unchanged as of 2026-08-13):** events/listings visibility (needs `authorId` in view meta), waves (`interactions.service.ts`)

**Acceptance**
- Blocking is bidirectional — neither party sees the other in discovery.
- Blocked users cannot open new message threads with each other.
- `BlocksModule` must be registered in `app.module.ts` for any of this to take effect (as of this writing it is implemented but not confirmed registered — verify before relying on it).

### §2.8 — Chat live location share (added 2026-08-13, shipped ahead of the spec doc's own status line)

**User story.** From an open 1:1 chat, I can share my live location for 15 minutes, 1 hour, or until I turn it off. My chat partner sees it update in near-real-time and can open it in Maps. Either of us can stop it; it also auto-ends on timeout or if we block each other.

**Status.** ✅ Shipped (migration `0030_chat_location_share.sql`, PRs #109/#110). **Full design doc:** `docs/SPEC_CHAT_LIVE_LOCATION.md` — note its own header still reads "Status: Design locked · Implementation not started"; that line is now stale and should be updated to Shipped alongside this entry (this script does that — see below).

**Key departure from generic chat:** coordinates are **exact**, not H3-fuzzed — this is a deliberate exception to the location-fuzzing invariant in `ARCHITECTURE.md` §3.3, scoped to an explicit, consensual, time-boxed share between two participants who are already in a 1:1 conversation. Does not touch `users.visibility` / the public map.

**API**

| Method | Path                                    | Auth | Notes                                    |
|--------|------------------------------------------|------|-------------------------------------------|
| GET    | `/chat/conversations/:id/location-session` | JWT | Active session (if any) — cold-open hydrate |

**WS `/realtime`** — `location:share:start` / `:update` / `:stop` (client→server, ack-based) and `location:share:started` / `:update` / `:ended` (server→client). Full payload shapes in `docs/SPEC_CHAT_LIVE_LOCATION.md` §3.

**Data model** — `chat_location_sessions` (status `active|ended`, duration `15m|60m|until_off`, `last_lat`/`last_lng`, `end_reason`); `messages.type` gains `'location' | 'location_session'` alongside `'text'`, plus `messages.location_session_id`. At most one active session per `(conversation_id, sharer_id)` — starting a new one ends the previous.

**Enforcement** — `LocationShareService` (`apps/backend/src/modules/chat/location-share.service.ts`) plus a sweep job (`location-share.sweep.ts`) that ends sessions past `ends_at` or with a stale (>90s) `last_updated_at`, emitting `location:share:ended`.

---

### §2.9 — Stories / ephemeral content (P4.S — shipped 2026-08, ahead of its horizon placement)

**User story.** I can post a photo or short video that's visible to nearby users for 24 hours, then disappears. I can view stories from people near me, react, and see who's viewed mine.

**Status.** ✅ Shipped end-to-end. Backend: `StoriesModule` (`apps/backend/src/modules/stories/`), migration `0029_stories.sql`. Mobile: `PulseStrip`, `StoryViewer`, `StoryCreateSheet`, `ProfileStoryRing`, `ProfileStoryline` (Pulse tab only — briefly surfaced on `MapScreen`, pulled back per commit `da690ff`).

**API**

| Method | Path                     | Auth | Notes                                                    |
|--------|--------------------------|------|------------------------------------------------------------|
| POST   | `/stories/presign`       | JWT  | `{ contentType }` → S3 presigned upload URL                |
| POST   | `/stories`               | JWT  | `{ mediaUrl, mediaType, caption? }` → gated by `canPostStory` |
| POST   | `/stories/nearby`        | JWT  | Viewport body → nearby, non-expired, non-blocked stories   |
| GET    | `/stories/author/:userId`| JWT  | A user's active stories (for `ProfileStoryline`)            |
| GET    | `/stories/:id`           | JWT  | Single story detail                                        |
| POST   | `/stories/:id/view`      | JWT  | Records a view receipt                                     |
| POST   | `/stories/:id/react`     | JWT  | Heart/wave-style reaction                                   |
| DELETE | `/stories/:id`           | JWT  | Author-only soft delete                                    |

**Data model** — `stories` table: exact write-time `location geography(Point,4326)` + H3 cells r4–r10 (server-trusted, never returned as-is), plus `approx_lat`/`approx_lng` (centroid of the r10 cell — the only coordinates clients ever see, per the §3.3 fuzzing invariant). `expires_at = created_at + 24h`; `deleted_at` for soft delete. `story_views` for unique view receipts. Limits (`packages/shared/src/story.ts`, `STORY_LIMITS`): 200-char caption, 15s max video, 10 max concurrent active stories/user, 50-row nearby-query cap.

**Post gate — softer than the original 24h-account-age design.** `canPostStory({ verification, createdAt })`: email-verified is the floor; email-only accounts also need ≥24h account age (`minAccountAgeMs`) and are capped at 3 posts/24h (`softerGateMaxPer24h`); phone-verified+ accounts skip the age floor entirely and get a 20-post/24h cap. Ladder: `none < email < phone < selfie < id` (`VerificationLevel`, see §5.7 below). Mirrors the `StoryEligibilityGuard` design.

**Cleanup** — `stories-cleanup.service.ts` sweeps expired rows (S3 object deletion via `deleteObjectsByKeys`). **WS** — `story:new` / `story:expired` on `ServerToClientEvents`.

---

### §2.10 — ID verification: admin review + Rekognition assist (added 2026-08-13)

**User story (operator).** As an admin, I can see the queue of pending ID-verification submissions, open one to see the document + a face-match assist score, and approve or reject it — the decision can't be double-processed by two admins racing each other.

**Status.** ✅ Shipped. `AdminIdVerificationController` (`apps/backend/src/modules/id-verification/`), guarded by `AdminGuard`. Consumed by the new `apps/admin` Vite dashboard — see `ARCHITECTURE.md` §2 tier map / §3.14.

**API** (all under `admin/verifications`, `AdminGuard`)

| Method | Path                          | Notes                                              |
|--------|--------------------------------|------------------------------------------------------|
| GET    | `/admin/verifications/pending`         | Paginated queue                            |
| GET    | `/admin/verifications/pending/:userId` | Detail — presigned doc URLs + Rekognition assist score |
| POST   | `/admin/verifications/pending/:userId/decide` | `{ decision, reason? }` — approve/reject |

**Rekognition — assist-only, never auto-decides.** `RekognitionService.analyzeVerification` runs AWS Rekognition face-compare between the ID document and the account's selfie/photo, surfacing a similarity score in the admin detail view. The score is advisory; the admin makes the call. Wired into the detail response, not into the decide endpoint's logic.

**Concurrency safety.** `decideVerification()` is wrapped in a DB transaction with an atomic conditional `UPDATE ... WHERE status = 'pending' RETURNING id` — two admins deciding the same submission concurrently, only one wins; the second gets a clean already-decided error instead of a double-write. Matches the transaction-boundary convention (notification call fires outside the transaction).

---

### §2.11 — Email verification (added 2026-08-13, new — not in original A1/A2/A3 scope)

**User story.** I can verify my email with a one-time code, both as a standalone step and automatically (Google OAuth sign-in promotes me to `email`-level verification without a separate step). Built specifically to support the Stories soft-gate (§2.9).

**Status.** ✅ Shipped. `VerificationController` (`/verification`), Redis-backed OTP store, delivered via Twilio's email channel. Mobile: `EmailVerificationScreen`.

**API**

| Method | Path                     | Auth | Notes                                    |
|--------|--------------------------|------|--------------------------------------------|
| POST   | `/verification/email/start` | JWT | Sends OTP to account email via Twilio     |
| POST   | `/verification/email/check` | JWT | `{ code }` → promotes `verification_level` to `email` |
| POST   | `/verification/phone/start` | JWT | Existing phone OTP (unchanged)             |
| POST   | `/verification/phone/check` | JWT | Existing phone OTP (unchanged)             |

**Side effect.** `AuthService` now auto-promotes `verification_level` to `email` on successful Google OAuth sign-in — a Google-authenticated user never needs to run the email flow manually.

---

## §3 — P2 features (forward specs)

### §3.1 — P2.A4: Dev-secret cleanup

**No new spec.** This is a code-hygiene + ops task. Acceptance is in `ROADMAP.md` § P2.A4. Tracked here for completeness only.

### §3.2 — P2.OB1: Sentry observability

**Status.** ✅ Shipped + hardened (PR #80, 2026-08-11). Shared scrubber lives at `packages/shared/src/scrub.ts` with its own spec (`sentry-scrub.spec.ts`); wired into both `beforeSend` hooks per the scope below.

**User story (operator).** When a crash happens in production, I see it in Sentry within 60s with full stack trace, user-scoped (anonymized), and zero PII leaked.

**Scope**
- Mobile: `@sentry/react-native`, source-map upload on release builds (`scripts/build-release.bat` extended).
- Backend: `@sentry/nestjs` global filter chained after `AllExceptionsFilter`.
- DSN per env (`SENTRY_DSN_DEV`, `SENTRY_DSN_PROD`).
- Sample rates: errors 1.0 · traces 0.1 in prod, 1.0 in dev.

**PII scrubbing rules (mandatory)**
- Strip `Authorization` header from request context.
- Strip body fields: `password`, `idToken`, `refreshToken`, `phone`, `email`, `latitude`, `longitude`, `idDocumentUrl`.
- User scope: only `{ id: uuid }`. No name, no email.
- Breadcrumbs: console + http; no XHR body capture.

**Alert routing**
- Sentry → Slack webhook in `#g88-alerts` for new issues at WARN+ in prod.
- Rate-limit alerts: max 1/min per issue fingerprint.

**Acceptance**
- Manually thrown `throw new Error('sentry-test')` in mobile → visible in Sentry within 60s with symbolicated frames.
- Backend handler throwing `BadRequestException` → visible with request method, path, anonymized user, **no body**.
- `grep -rE '(password|idToken|refreshToken).*sentry' apps/` returns no instances logging PII.

### §3.3 — P2.A3: Apple Sign-In

**User story.** As an iOS user, I can sign in or register with Sign in with Apple. My account works the same as a Google or email user.

**Mobile**
- Dep: `@invertase/react-native-apple-authentication` (vet for RN 0.83 + React 19 compat — H1 risk).
- iOS only (button hidden on Android).
- Button on `AuthScreen`, beneath existing Google + email/password.

**API**

| Method | Path          | Auth | Body                                  |
|--------|---------------|------|---------------------------------------|
| POST   | `/auth/apple` | No   | `{ identityToken, nonce, fullName? }` |

**Backend logic**
1. Fetch Apple JWKS, verify `identityToken` signature.
2. Validate `aud` (bundle id), `iss` (`https://appleid.apple.com`), `exp`.
3. Extract `sub` (stable user id) and `email` (may be private-relay `*@privaterelay.appleid.com`).
4. Look up user by `appleUserId = sub` (new column on `User`, nullable, indexed unique).
5. If new → create user with `appleUserId = sub`, `email = <relay or real>`, `name = fullName` (Apple only returns name on first sign-in).
6. Issue token pair, return user.

**New `User` columns**
```sql
ALTER TABLE users ADD COLUMN apple_user_id varchar UNIQUE NULL;
CREATE UNIQUE INDEX idx_users_apple_user_id ON users(apple_user_id) WHERE apple_user_id IS NOT NULL;
```

**Edge cases**
- Apple `private-relay` email → store and use as-is. Don't try to "resolve" it.
- User signs in again later → only `sub` returned, no name → don't overwrite existing `name`.
- User had email account first, then signs in with Apple using the same email → **don't auto-merge**. Show "an account exists for this email — sign in to link" flow (P3 polish — for P2, just create separate account and document the merge tool as P3 work).

**Acceptance**
- Sign in with Apple from cold app state → land on `ProfileCreation` (if new) or `Main` (if returning) within 3s.
- Returning user with relay email gets the same `User.id`.
- Android build links cleanly (the native module must be conditional).
- Apple test reviewer account works end-to-end.

### §3.4 — P2.C6: Mobile chat outbox

**User story.** I send a message offline. It shows as pending. When I'm back online, it sends automatically. The recipient never sees a duplicate, even if I retry from a different device.

**Mobile design**
- Persistent queue in AsyncStorage under `chat:outbox:v1`. Shape:
```typescript
type OutboxItem = {
  clientMessageId: string;     // uuid v4 generated at send time
  conversationId: string;
  recipientId: string;
  content: string;
  type: 'text' | 'image';
  state: 'pending' | 'sending' | 'sent' | 'failed';
  createdAt: number;           // unix ms
  attempts: number;
};
```
- States flow: `pending → sending → sent` (happy path) or `sending → failed` (after 5 attempts, exponential backoff).
- UI: small clock icon for `pending`, spinner for `sending`, single check for `sent`, red ! for `failed` (tap to retry).

**Retry strategy**
- NetInfo state change → online → drain queue.
- WS reconnect → drain queue.
- App foreground → drain queue.
- Max 5 attempts per message; backoff: 1s, 2s, 5s, 15s, 60s.

**Backend changes**
- `messages.client_message_id` column (varchar, nullable).
- Unique partial index: `(sender_id, client_message_id) WHERE client_message_id IS NOT NULL`.
- On insert conflict → return existing message (idempotent response).

**WS event addition**
- Server emits `message:ack { clientMessageId, serverId }` to sender's room after persistence. Client uses this to transition queue item to `sent` and drop it from storage.

**Acceptance**
- Airplane mode: send 3 messages → all show `pending` → exit airplane mode → all three transition to `sent` within 5s and are received once each.
- App killed mid-send: messages survive in outbox, drained on next launch.
- Sending same `clientMessageId` twice (e.g. from two devices in race) → backend stores once, returns same `Message`, no double in recipient's view.

### §3.5 — P2.M1: Viewport-diff map protocol

**User story (perf).** The map data payload shrinks substantially on viewport changes. Pan/zoom feels snappier; mobile data + battery savings measurable.

**Current behavior**
- `POST /discovery/nearby?lat&lng&radiusKm` returns full snapshot every time.
- Median payload at 5km radius in dense area: ~80kB.

**New behavior — diff mode**

| Method | Path                | Notes                                                                       |
|--------|---------------------|-----------------------------------------------------------------------------|
| POST   | `/discovery/nearby` | First call (no `since`) returns full snapshot; subsequent calls return diff |

**Query**
- `?lat&lng&radiusKm&since=<timestamp>&previousIds=<comma-sep>` (or `since` only — server computes diff against last-known set if a session id is provided)

**Response shape**
```typescript
type MapDataDiff = {
  added:   MapEntity[];   // entities now visible that weren't before
  updated: MapEntity[];   // existing entities with changed lat/lng/status
  removed: string[];      // entity ids no longer visible
  // first call only:
  snapshot?: MapEntity[]; // when ?since is absent
};
type MapEntity = {
  id: string;
  kind: 'user' | 'event' | 'listing';
  lat: number;            // jittered ~100m for users (privacy)
  lng: number;
  meta: Record<string, unknown>;  // displayName, photoKey, badges, etc.
  updatedAt: string;
};
```

**Client (mobile) logic**
- `mapSlice` tracks `lastFetchAt` and current `entityIds: Set<string>`.
- On viewport change → `POST /discovery/nearby?since=lastFetchAt&previousIds=<...>`
- Apply diff: `added` → push · `updated` → replace · `removed` → drop
- On any missing-id signal (e.g. cursor expired) → fall back to full fetch.

**WS interaction**
- WS `nearby:update` continues to handle per-user real-time moves between viewport fetches.
- Diff protocol handles the boundaries: someone entering/leaving viewport.

**Acceptance**
- Median bytes per viewport pan drops ≥ 60% vs current snapshot mode (measured in dev with 100-entity area).
- No visible regression in map UX (no flicker, no missing dots).
- First-load behavior unchanged (still returns full snapshot).

---

## §4 — P3 features (outlines)

**✅ All of §4.1–§4.7 shipped and surfaced in mobile as of 2026-06-15 — see `STATUS.md`.** Outlines below were never replaced with full specs per the §6 change protocol; kept as-is for historical scope reference rather than rewritten after the fact.

Full specs land at start of each P3 sprint. These outlines anchor scope only.

### §4.1 — P3.1 Gamification surfacing
- Surfaces: daily-challenge card on map open · XP bar on profile header · weekly leaderboard ribbon · achievement toast.
- Existing backend: `gamification` module, `achievement`, `challenge`, `user-achievement`, `user-challenge` entities.
- Endpoints exist; UI not yet wired into main flow.

### §4.2 — P3.2 Gifts (XP-funded)
- Wallet seeded by XP earned in gamification. **No money.**
- Send flow from profile + chat. Catalog of ~30 items.
- Recipient sees gift in chat as a special message type (`type: 'gift'`).
- Existing backend: `gifts` module, `gift-catalog`, `user-wallet`, `gift-transaction`.

### §4.3 — P3.3 Push notifications + geofences
- FCM token registration on app open (already half-wired).
- Channels (per-channel opt-in): waves · matches · messages · nearby events · listings nearby · daily digest.
- Geofence sweeps already scheduled in backend; surface them as notifications.
- Frequency cap per channel; quiet hours respected.

### §4.4 — P3.4 Verification visibility
- Badges (email · phone · photo · ID · social) visible on:
    - Map dot (subtle indicator)
    - Profile card preview
    - Chat header
    - User profile screen
- "Verify to unlock" nudge after D2 if no verification done.
- Composite `verificationScore` already on `User`.

### §4.5 — P3.5 Events UI polish
- Creation flow: title · description · datetime · pin location · capacity · optional polls.
- RSVP + attendee list + polls + Q&A (WS `/events`).
- "Events near you" rail on map screen.
- Existing backend: `events` module + `events.gateway`.

### §4.6 — P3.6 Trending topics
- Geohash-bucketed Redis sorted sets already populated.
- Surfaces: trending strip on map header · dedicated trending screen.
- v1: tap topic → filter map to it. v2 (P4): tap topic → group chat (gated on group chat ship).

### §4.7 — P3.7 Trading UI polish
- Listing creation: photos · price · category · location · description.
- Browse grid + filter + map view.
- Offer flow: make offer · counter · accept · chat.
- Favorites/saves.
- **No payment in v1.** Trades coordinated offline through chat.

---

## §5 — Shared types reference

### §5.1 — `User` entity

```typescript
// apps/backend/src/modules/users/user.entity.ts (shape, not full TypeORM decorators)
type User = {
  id: string;                                  // uuid
  email?: string;
  phone?: string;
  passwordHash: string;                        // @Column({ select: false })
  appleUserId?: string;                        // planned for P2.A3 — column does not exist yet; 0009_apple_oauth.sql was dropped by 0019_drop_apple_oauth.sql
  googleUserId?: string;
  name: string;
  verificationLevel: VerificationLevel;        // 'none'|'email'|'phone'|'selfie'|'id' — see §5.7. Existed since 0001_initial.sql; wasn't in this type doc until 2026-08-13
  hometownCity?: string;                       // 0030_profile_origin.sql
  hometownCountry?: string;                    // 0030_profile_origin.sql
  showAge: boolean;                            // default true — public-profile visibility toggle, 0030_profile_origin.sql
  showHometown: boolean;                        // default true — public-profile visibility toggle, 0030_profile_origin.sql
  location?: { type: 'Point'; coordinates: [lng, lat] };  // geography(Point,4326)
  lastLatitude?: number;
  lastLongitude?: number;
  lastSeenAt: Date;
  profile: UserProfile;                        // JSONB — see §5.2
  badges: UserBadges;                          // JSONB
  settings: UserSettings;                      // JSONB
  verificationScore: number;                   // 0–100
  subscriptionTier: SubscriptionTier;          // P4.M
  isVisible: boolean;
  isActive: boolean;
  isBanned: boolean;
  boostedUntil?: Date;                         // P4.M
  xp: number;
  level: number;
  datingScore: number;
  socialScore: number;
  traderScore: number;
  createdAt: Date;
  updatedAt: Date;
};
```

### §5.2 — `UserProfile` (JSONB)

```typescript
// packages/shared/src/profile.ts
enum Gender { MALE='male', FEMALE='female', NON_BINARY='non-binary', PREFER_NOT='prefer-not-to-say' }
type Goal = 'dating' | 'friends' | 'events' | 'trading' | 'networking';

type PhotoSlot = { slot: number; s3Key: string; uploadedAt: string };

type UserProfile = {
  displayName: string;
  bio?: string;
  dateOfBirth?: string;       // ISO date
  gender?: Gender;
  interestedIn?: Gender[];
  interests: string[];        // from INTEREST_OPTIONS constant
  goals: Goal[];
  photos: PhotoSlot[];
  completedAt?: string;       // gate for AppNavigator
};
```

### §5.3 — `UserBadges` / `UserSettings`

```typescript
type UserBadges = {
  email: boolean;
  phone: boolean;
  photo: boolean;          // set by face-compare service
  id: boolean;             // set after manual or automated ID doc review
  social: { google?: boolean; apple?: boolean; instagram?: boolean };
};

type UserSettings = {
  notifications: {
    waves: boolean;
    matches: boolean;
    messages: boolean;
    nearbyEvents: boolean;
    nearbyListings: boolean;
    dailyDigest: boolean;
  };
  privacy: {
    showOnMap: boolean;      // == top-level isVisible
    showOnlineStatus: boolean;
    showDistance: boolean;
    homeWorkZones?: Array<{ lat: number; lng: number; radiusM: number }>; // P3
  };
  discovery: {
    radiusKm: number;
    ageRange: [number, number];
    showMe: Gender[];
  };
};
```

### §5.4 — `SubscriptionTier` enum

```typescript
enum SubscriptionTier {
  FREE = 'free',
  PLUS = 'plus',         // P4.M1
  PRO  = 'pro',
}
```

### §5.5 — Constants

```typescript
// packages/shared/src/constants.ts
const INTEREST_OPTIONS = [/* curated 40-ish tags: 'hiking','coffee','startups','cycling',... */];
const GOAL_OPTIONS    = ['dating','friends','events','trading','networking'] as const;
const SOCIAL_PROVIDER_CONFIG = {
  google: { color: '#DB4437', icon: 'google' },
  apple:  { color: '#000000', icon: 'apple' },
};
```

### §5.6 — Brand tokens (canonical)

```typescript
// packages/shared/src/brand.ts
export const COLORS = {
  bg:        '#0a0a0f',
  surface:   '#1a1a2e',
  border:    '#2a2a4a',
  accent:    '#00d4ff',
  user:      '#FF69B4',
  event:     '#FF9800',
  listing:   '#4CAF50',
  current:   '#007AFF',
  error:     '#ff6b6b',
  text:      { primary: '#ffffff', secondary: '#aaaaaa', muted: '#666666' },
};
```

---

### §5.7 — `VerificationLevel` enum (added 2026-08-13)

```typescript
// packages/shared/src/api.ts
type VerificationLevel = 'none' | 'email' | 'phone' | 'selfie' | 'id';
```
Ladder order (low→high): `none < email < phone < selfie < id`. Existed in the schema since `0001_initial.sql` (`users.verification_level`) but wasn't in this doc until the Stories gate (§2.9) made the ranking logic load-bearing. Drives `canPostStory` and the `StoryEligibilityGuard` mentioned elsewhere.

---

## §6 — Change protocol for this doc

- **P1 sections** — update only when implementation actually changes.
- **P2 sections** — update as you build; mark sections `✅` when shipped.
- **P3 sections** — replace outline with full spec at sprint start.
- **§5 types** — single source of truth; if a field changes, update here first, then in code.

## Decision log

| Date       | Decision                                                                                   | Source                                                                                                                                      |
|------------|--------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-08-13 | Added §2.8–§2.11 for Chat live-location share, Stories, ID-verification admin+Rekognition assist, and Email verification | All four shipped on `master` with no corresponding spec entry |
| 2026-08-13 | §2.7 Blocks downgraded from an implied "done" to "mostly shipped" with an explicit enforcement gap noted | `interactions.service.ts` (waves) has no `isBlocked` call in the current codebase, contradicting `ROADMAP.md` P2.B1's "closed" status |
| 2026-08-13 | Added §5.7 `VerificationLevel` and four missing `User` fields (`verificationLevel`, hometown, show-age/hometown toggles) | Fields existed in the DB schema (some since `0001_initial.sql`) but were never added to this type reference |
| 2026-05-23 | One file with §-numbered sections (vs many files)                                          | Initial scoping with user — easier to grep, single source of truth                                                                          |
| 2026-05-23 | Document P1 retroactively rather than skip                                                 | Reduces onboarding cost for future contributors                                                                                             |
| 2026-05-23 | Apple `sub`, not email, as identity primary                                                | Apple private-relay design forces this                                                                                                      |
| 2026-05-23 | `clientMessageId` for outbox idempotency at `(senderId, clientMessageId)`                  | Standard pattern; survives device-clock skew                                                                                                |
| 2026-07-04 | Added §2.7 Blocks — backend shipped but was undocumented                                   | Drift audit found `BlocksModule`, `0026_blocks.sql`, and discovery/messaging enforcement already in the codebase with no corresponding spec |
| 2026-07-04 | Corrected `GET /locations/map-data` → `POST /discovery/nearby` throughout                  | No `locations` module exists in the codebase                                                                                                |
| 2026-07-04 | Reclassified A3 (Apple Sign-In) status from "in place" to "reverted, rebuild from scratch" | `0019_drop_apple_oauth.sql` dropped `0009_apple_oauth.sql`                                                                                  |

# NEXA — Specification

> Feature contracts. Types of record: `packages/shared`. Live progress/release state: `docs/STATUS_CURRENT.md`. Sequence/gates: `ROADMAP.md`.  
> **Compatibility note:** public product identity is **NEXA**. Technical identifiers such as `@g88/*`, `com.g88`, storage keys, legacy infrastructure hostnames, release artifact names, and signing metadata remain unchanged unless an explicit migration says otherwise.  
> Last reconciled: **2026-10-26**.

---

## §1 — Conventions

- Errors: `{ statusCode, code, message, details? }`.
- Mobile/API auth: Bearer JWT unless a feature contract says otherwise.
- Browser auth uses the dedicated hardened web flow documented in `docs/WEB_CLIENT_V1.md`; browser access tokens are memory-only and refresh credentials are HttpOnly.
- Ordinary location writes fuzz to H3 r10 before persist; timed chat live-location is a bounded exception.
- `packages/shared` is the field-level source of truth over prose here.
- UI state is never the security boundary for blocks, visibility, verification or messaging permissions.

## §2 — Shipped features

### §2.1–§2.2 Auth & Profile

✅ Email/password + Google OAuth; profile CRUD; cover photo; DOB 18+; hometown; `friendsSeeOnlineStatus`; strike standing fields on owner profile.

Apple Sign-In is not implied by current iOS build/runtime support and remains a separate auth/product decision.

### §2.3 — Map Discovery

**Status.** ✅ Viewport-diff + content-aware discovery.

**API:** `POST /discovery/nearby` with:

```typescript
interface DiscoveryQuery {
  viewport: Viewport;
  zoom: number;
  kinds?: EntityKind[];
  prevViewportHash?: string;
  topic?: string;
  listingMode?: 'sell' | 'buy';
  friendsOnly?: boolean;
}
```

**Invariants:** blocks excluded; online only for friends when preference allows; `MAX_CELLS` 5k; mobile skips >15° span; server visibility/privacy rules are authoritative.

**UI:** SearchBar · CategoryFilterBar · TrendingCard · challenge/nudge stack · EntityBottomSheet on pin tap.

Renderer choice does not change the discovery contract. The production default remains legacy while MapLibre follows the gated runtime policy in §2.15.

### §2.4–§2.6 Presence, Wave, Chat

✅ Presence Redis; wave → `403 wave.blocked` when blocked; 1:1 chat + outbox + live location share sessions.

**Conversations REST**

| Method | Path | Controller | Notes |
|--------|------|------------|--------|
| POST | `/conversations` | Messaging | Open/fetch 1:1; body `{ targetUserId }` → `CreateConversationResponse` |
| GET | `/conversations` | Chat | List `ConversationSummary[]` (`peerOnline` privacy-gated) |
| GET | `/conversations/:id/messages` | Chat | Cursor page → `MessagePage` |
| POST | `/conversations/:id/read` | Chat | 204 mark-read |
| GET | `/conversations/:id/location-session` | Chat | Active live-location session or null |

**Open gate** (`MessagingService.openForMessaging`): block → `canMessage: 'none'` → **403 `chat.locked`**. Match → accepted chat; shared interest may mint pending request. Do **not** use `/chat/conversations` (404).

**Realtime send path** — use Socket.IO:

| Event | Direction | Notes |
|-------|-----------|--------|
| `conversation:join` | C→S | Ack before send |
| `chat:send` | C→S | `{ conversationId, body, clientMessageId }` → ack message |
| `chat:typing` | C→S | |
| `chat:message` | S→C | Fanout |
| `conversation:opened` | S→C | After wave reciprocation etc. |
| `location:share:start` / `update` / `stop` | C→S | Live location |
| `location:share:started` / `update` / `ended` | S→C | |

Outbox: mobile persists pending with `clientMessageId`; server is idempotent on `(senderId, clientMessageId)`.

Conversation-list refresh failures are classified into a bounded diagnostic shape (`network`, `refresh_unavailable`, `unauthorized`, `forbidden`, `rate_limited`, `server`, `unknown`) plus status code. Diagnostics must not retain free-text transport errors, URLs, tokens or private user/conversation identifiers.

### §2.7 — Blocks

✅ Discovery, messaging, gifts, waves and marketplace direct-access paths enforce server-side block isolation. Client visibility alone must never be treated as authorization.

### §2.8 — Chat live location

✅ Timed share sessions; sweep ends session; privacy exception to ordinary r10 fuzz for the session path only.

### §2.9 — Stories (P4.S)

✅ Soft gate: email verified + 24h account age. Pulse strip. Presign media trust remains Redis-bound. Current shared/backend contracts override older prose on media implementation detail.

### §2.10 — ID verification

✅ Submit → object storage → pending; admin decide atomic; assist-only Rekognition; `verification:updated` WS. Human/admin decision remains authoritative.

### §2.11 — Email verification

✅ OTP start/check; Google OAuth promotes to email.

### §2.12 — Friends

**Product rules:** unfriend keeps follows; follow independent of friendship; request limits may tighten after abuse signal.

**API:** follow/unfollow, requests accept/decline/cancel, lists, suggestions, mutual, relationship, unfriend, `GET /interactions/inbox`.

**Shared:** `RelationshipSummary`; `FriendCard.online: boolean | null`; `SuggestionCard`; `InboxItem`.

**Online:** friendship + `friends_see_online_status` only.

### §2.13 — EntityBottomSheet

| Kind | CTA |
|------|-----|
| user | Wave → Message → Profile; ⋯ Block |
| event | View → EventDetail |
| listing | View → ListingDetail (Wanted = violet) |

Message uses `/conversations` + root Chat navigation. Public presentation must remain verification-factual and must not introduce a public numeric trust/popularity score or exact-location disclosure.

### §2.14 — Marketplace offers + counter

```typescript
type ListingMode = 'sell' | 'buy';
interface ListingOffer {
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  lastActor: 'buyer' | 'seller' | null;
  offerCents: number | null;
}
```

**REST** (`ListingsController`, JWT):

| Method | Path | Notes |
|--------|------|--------|
| POST | `/listings` | Create (`mode` default `sell`) |
| POST | `/listings/photo/base64` | Thumbnail upload → public URL |
| POST | `/listings/browse` | Body: location + optional `mode` / category |
| GET | `/listings/favorites` | Saved listings |
| GET | `/listings/:id` | Detail (+ `myOffer`, `offerCount`) |
| PUT | `/listings/:id/status` | Seller: active / sold / withdrawn |
| PUT | `/listings/:id/favorite` | Toggle favorite |
| POST | `/listings/:id/offers` | Buyer make / re-open offer |
| GET | `/listings/:id/offers` | Seller all; buyer own |
| PUT | `/listings/:id/offer/withdraw` | Buyer withdraw |
| PUT | `/listings/offers/:offerId` | Accept / decline (`RespondOfferDto`) |
| PUT | `/listings/offers/:offerId/counter` | Seller counter → `lastActor=seller`, status stays pending |

Seller counter keeps `pending` + sets `lastActor=seller`. Buyer then accepts/declines via `PUT /listings/offers/:offerId`. No payment settlement is implied by this v1 contract.

### §2.15 — Mobile renderer policy

MapLibre is bundled and available but is **not the default production renderer**.

Build-time request is fail-closed:

- unset / `legacy` / malformed values → `legacy`;
- exact `NEXA_MAP_RENDERER=maplibre` may request MapLibre.

Effective MapLibre rendering additionally requires:

1. fresh remote renderer policy with `mapLibreEnabled=true`;
2. native MapLibre availability;
3. validated MapTiler configuration.

Any missing, stale, malformed or unavailable gate resolves to `legacy`. Server policy cannot promote a legacy-requesting build. Remote policy is a kill switch / permission boundary, not proof of production readiness.

**Public runtime policy:** `GET /api/v1/runtime-config/map-renderer` returns the shared v1 policy shape with bounded cache TTL. The response is read-only and contains no secret material.

Production activation remains separately gated by manual provider-canary and physical-device evidence documented in `ROADMAP.md`.

### §2.16 — Browser client foundation

✅ Repo-backed browser foundation exists for **Map / Discover / Pulse / Connections / You**.

Browser-specific auth/security contract:

- access token stays in memory;
- refresh credential is HttpOnly / SameSite cookie scoped to web auth paths;
- browser auth mutations use the expected same-origin/session-header contract;
- same-origin edge proxies `/api/v1` and `/socket.io` to the backend;
- session coordination may broadcast only credential-free session-change signals;
- private Connections data is not fabricated for unauthenticated users.

Chromium regression coverage includes multi-tab auth coordination, realtime token rotation/rejoin, viewport stale-response races and Connections actions/chat. Public web release is still gated on final topology, supported-browser matrix, production map provider and deployed HTTPS validation. See `docs/WEB_CLIENT_V1.md`.

### §2.17 — Product analytics

Canonical analytics flow is backend-owned:

```text
client → /api/v1/analytics/events → backend allow-list → Postgres
                                               └─ optional PostHog mirror
```

Postgres remains source of truth. The optional PostHog sink is backend-only, best-effort and disabled until explicitly configured. Mirror delivery starts only after canonical persistence succeeds and is restricted to the existing HMAC subject hash, canonical event name and already-sanitized low-cardinality properties.

The mirror must not receive raw user IDs, exact coordinates, free text, auth tokens, contact data or private entity/conversation identifiers.

## §3 — Deferred / gated

Apple Sign-In rebuild · group chat · Stripe Connect / paid gifts · live streaming remain deferred/gated. The **browser client is no longer a deferred feature**; its foundation is merged but public release remains gated. MapLibre is a controlled renderer rollout, not a new product feature.

See `ROADMAP.md` and `docs/STATUS_CURRENT.md` for current gates.

## Decision log

| Date | Decision |
|------|----------|
| 2026-10-26 | Reconciled live status pointer; browser foundation moved out of deferred; added MapLibre remote renderer policy, privacy-safe chat diagnostics and backend-first analytics mirror contracts |
| 2026-09-14 | Deepened §2.3; §2.12 types; added §2.13 sheet + §2.14 offers/counter; aligned to `@g88/shared` |
| 2026-09-14 | §2.14 paths corrected to ListingsController; §2.4–§2.6 chat/messaging routes documented |
| 2026-09-12 | §2.12 Friends; §2.7 waves blocked verified |
| 2026-08-13 | Stories, email OTP, ID admin, live location documented |

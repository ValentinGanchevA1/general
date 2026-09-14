# G88 — Specification

> Feature contracts. Types of record: `packages/shared`. Live progress: `STATUS.md`.
> Last revised: **2026-09-14**.

---

## §1 — Conventions

- Errors: `{ statusCode, code, message, details? }`.
- Auth: Bearer JWT unless noted.
- Location writes fuzz to H3 r10 before persist.
- Shared package is field-level source of truth over prose here.

## §2 — Shipped features

### §2.1–§2.2 Auth & Profile

✅ Email/password + Google OAuth; profile CRUD; cover photo; DOB 18+; hometown; `friendsSeeOnlineStatus`; strike standing fields on owner profile.

### §2.3 — Map Discovery

**Status.** ✅ Viewport-diff + content-aware discovery. Map polish Option 1 (SearchBar · CategoryFilterBar · TrendingCard) 2026-09-13.

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

**Invariants:** blocks excluded; online only for friends when preference allows; `MAX_CELLS` 5k; mobile skips >15° span; `UserMeta.isFriend` → teal ring.

**UI:** SearchBar (client filter) · CategoryFilterBar · TrendingCard · challenge/nudge stack · EntityBottomSheet on pin tap.

### §2.4–§2.6 Presence, Wave, Chat

✅ Presence Redis; wave → `403 wave.blocked` when blocked; 1:1 chat + outbox + live location share sessions.

### §2.7 — Blocks

✅ Discovery, messaging, gifts, waves. Residual: events/listings author hide needs `authorId` in view meta.

### §2.8 — Chat live location

✅ Timed share sessions; sweep ends session; privacy exception to r10 fuzz for the session path only.

### §2.9 — Stories (P4.S)

✅ Soft gate: email verified + 24h account age. Pulse strip. Presign mediaUrl trust (Redis-bound). Video create partial; viewer still partial.

### §2.10 — ID verification

✅ Submit → S3 → pending; admin decide atomic; assist-only Rekognition; `verification:updated` WS.

### §2.11 — Email verification

✅ OTP start/check; Google OAuth promotes to email.

### §2.12 — Friends

**Product rules:** unfriend keeps follows; follow independent of friendship; request limits after abuse signal.

**API:** follow/unfollow, requests accept/decline/cancel, lists, suggestions, mutual, relationship, unfriend, `GET /interactions/inbox`.

**Shared:** `RelationshipSummary` (`state`, `isFollowing`, `isFollowedBy`, `mutualFriendsCount`); `FriendCard.online: boolean | null`; `SuggestionCard`; `InboxItem`.

**Online:** friendship + `friends_see_online_status` only.

### §2.13 — EntityBottomSheet

| Kind | CTA |
|------|-----|
| user | Wave → Message → Profile; ⋯ Block |
| event | View → EventDetail |
| listing | View → ListingDetail (Wanted = violet) |

Message uses `/conversations` + `openRootScreen` Chat. Profile cache ~45s; error + Retry; `key={point.id}`. Stats: level, allTimeRank, achievementIcons. Goals stay on UserProfile.

### §2.14 — Marketplace offers + counter

```typescript
type ListingMode = 'sell' | 'buy';
interface ListingOffer {
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  lastActor: 'buyer' | 'seller' | null;
  offerCents: number | null;
}
```

Seller counter keeps pending + sets `lastActor=seller`. Buyer can accept/decline that counter. No payment v1. Post-create map focus via `focusListingId` / pendingMapFocus.

## §3 — Deferred / horizon

Apple Sign-In rebuild · group chat · Stripe Connect · live streaming · web client. See `ROADMAP.md`.

## Decision log

| Date | Decision |
|------|----------|
| 2026-09-14 | Deepened §2.3; §2.12 types; added §2.13 sheet + §2.14 offers/counter; aligned to `@g88/shared` |
| 2026-09-12 | §2.12 Friends; §2.7 waves blocked verified |
| 2026-08-13 | Stories, email OTP, ID admin, live location documented |

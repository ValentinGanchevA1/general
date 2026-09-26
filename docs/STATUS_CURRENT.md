# G88 — current status (authoritative snapshot)

> **Synced:** 2026-09-26  
> **HEAD truth:** master + merged PRs through #423  
> **Next free migration:** `0046`  
> Historical log: root `STATUS.md` (stale as of 2026-09-24 — replace with this file).

---

## 1. One-liner (what G88 is today)

**Map-first, identity-verified, real-time social app.**  
See people / events / listings nearby → wave, message, friend, trade, attend, post story.  
Launch market: **Varna, BG** (α).

Not a feed. Not a swipe deck. Not a super-app yet.

---

## 2. Old plans → reality

| Source | Claimed | Reality 2026-09-26 |
|--------|---------|--------------------|
| **BG 14-day MVP** (area posts + basic map + chat) | Auth, map, hyperlocal posts, 1:1 chat, push | **Superseded.** Area posts never shipped as primary surface. Map discovery + people/events/listings + friends + marketplace + stories + verification ladder are the product. |
| **HTML Phase 1–2** (microservices, Kafka, GraphQL, ML matching, Neo4j) | Months 1–6 foundation | **Rejected architecture.** Monolith NestJS + PostGIS + Redis + Socket.IO. No Kafka/GraphQL/K8s. Matching is rankBy + friends suggestions, not TensorFlow. |
| **HTML Phase 3** (live streaming, WebRTC, NFT, blockchain gifts) | Months 7–9 | **Explicitly deferred / cut.** Stories (ephemeral photo/video ≤15s) shipped instead. Live streaming stays P4.L horizon. |
| **HTML Phase 4** (full commerce, crypto, logistics) | Months 10–12 | **Partial.** Local marketplace + offers + counter + urgency (expires/bump) shipped. No Stripe live, no crypto, no logistics. |
| **HTML Phase 5–6** (AR nav, news, enterprise API, white-label) | Months 13–24 | **Out of scope.** Do not build. |
| **v2/v3 from BG plan** (marketplace then streaming+dating) | Sequential | **Marketplace ahead of streaming.** Dating layer is map filter + identity prefs (gender/orientation/nationality) — not a swipe product. |

**Kill list (do not re-open without explicit go-ahead):**  
Kafka · GraphQL Federation · Neo4j · TensorFlow matching · WebRTC live · NFT/blockchain · multi-CDN streaming · enterprise white-label · AR indoor nav.

---

## 3. Shipped on master (code)

| Area | State | Key migrations / PRs |
|------|--------|----------------------|
| **P1 foundation** | ✅ | Auth · Profile · Map discovery · Presence · Wave · Chat |
| **P2 hardening** | ✅ | Blocks (wave.blocked) · outbox · viewport diff · Sentry |
| **P3 habit** | ✅ | Gamification · gifts · push · events · trading (offers+counter) |
| **Friends graph** | ✅ | 0032/0033 · requests · mutual · suggestions rank C (0043) · presence privacy · notifications + badge · interactions inbox |
| **Stories (P4.S)** | ✅ | 0029 · photo/video create ≤15s · Pulse strip · viewer · soft gate (email+24h) · strikes enforced |
| **Profile** | ✅ | Origin (DOB 18+, hometown) · cover · storyline · **identity** (gender, orientation, nationality + show_* flags) **0045** · public surface #423 |
| **Map discovery** | ✅ | rankBy relevance/distance/newest · PostGIS KNN · listingMode · friendsOnly · cell-cap 5k · content-aware diff · lastSeen activity |
| **Map chrome** | ✅ | Calm v1 (#409–410) · Search · CategoryFilter · TrendingCard · coach v2 · empty/create nudge · online pip (privacy-gated) · activation trust ladder |
| **EntityBottomSheet** | ✅ | Above-fold price/time/distance · Wave→Message→Profile · mutual · stats · Message seller/host |
| **Marketplace** | ✅ | Sell/Wanted · offers + counter · urgency (expires_at/bumped_at **0044**) · Message seller · post-create map focus |
| **Verification** | ✅ | Email OTP · phone (Redis fallback) · ID submit→admin queue · atomic decide · assist-only Rekognition · WS verification:updated |
| **UX primitives** | ✅ | ScreenHeader · FormField · ListRow · EmptyState · IdentityBlock · Avatar friend teal · theme tokens (hex residual closed) |
| **Admin** | ✅ | Vite `127.0.0.1:5173` · AdminGuard · id:approve CLI |
| **Migrations** | **0001–0045** on master. dual-0030 resolved. Prefix CI guard. **Next free: 0046** |

---

## 4. Ops gaps (not code blockers)

1. **Rekognition on Render** — `REKOGNITION_ENABLED=true`, region = S3, IAM DetectFaces/CompareFaces. Until then scores skip/error; human decide still works.
2. **`ADMIN_USER_IDS` on Render** — required for prod queue.
3. **Twilio email OTP** — often fails; Redis/DEV fallback. Wire real channel for prod.
4. **Play Console** — owner closed testing still open.
5. **Live G2/G3** — Twilio SMS + Stripe test checkout not fully exercised on deploy.
6. **0045 (identity) on Render** — run migrate after deploy.

---

## 5. Next (priority order)

| # | Item | Why |
|---|------|-----|
| 1 | **Trust ops** | Enable Rekognition + ADMIN_USER_IDS; one E2E ID submit → score → approve |
| 2 | **Device smoke** | Cold-start city map · coach v2 → create · online pip · sheet Message → chat · story photo+video · listing photo + urgency |
| 3 | **Dating prefs (0046)** | Draft already in artifacts (`0046_dating_preferences.sql`). Wire only if map Dating layer needs server preferences; keep opt-in + privacy. |
| 4 | **Listing urgency mobile** | Backend 0044 shipped; mobile EntityBottomSheet + ListingDetail still need local apply from artifacts `.tmp-*-urgency.tsx` |
| 5 | **Play closed testing** | Owner path |
| 6 | **Retention metrics** | D1/D7 on verified users before any monetization talk |

**Explicitly not next:** live streaming, group chat, web client, premium paywall, ML matching.

---

## 6. Architecture that actually runs

```
Mobile (RN + TS)  ──REST + Socket.IO──►  NestJS monolith
                                              │
                    PostGIS (viewport / KNN)  Redis (presence, OTP, rate)
                                              S3 (media, ID docs)
                                              FCM (push)
apps/admin (Vite) ──JWT AdminGuard──► same API
```

No microservices. No Kafka. No GraphQL. Shared types in `packages/shared`.

---

## 7. Success metrics (α — Varna)

- D1 / D7 retention on **verified** users (email+).
- Waves → chat conversion.
- Listings with ≥1 offer within 48h.
- Zero unblocked harassment paths (blocks + strikes).

---

## 8. Doc ownership

| File | Role |
|------|------|
| **docs/STATUS_CURRENT.md** (this) | Single source of “where are we?” |
| STATUS.md | Historical log — keep short, point here |
| ROADMAP.md | Sequence + cuts (needs migration number fix → 0046) |
| PRODUCT.md | What/why (still accurate) |
| ARCHITECTURE.md / SPECIFICATION.md | How / contracts |

**Action:** replace root `STATUS.md` progress section and `docs/STATUS_CURRENT.md` with this content on next docs PR. Update ROADMAP migration line and P4 table if dating prefs ship.

Update this file when migrations or product state change.

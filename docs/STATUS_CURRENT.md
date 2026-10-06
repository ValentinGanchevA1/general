# G88 — current status (authoritative snapshot)

> **Synced:** 2026-10-06  
> **HEAD truth:** master through **#486** (`05a7917`)  
> **Next free migration:** `0048`  
> Historical log: root `STATUS.md` (may lag — prefer this file).

---

## 1. One-liner

**Map-first, identity-verified, real-time social app.**  
People / events / listings nearby → wave, like (dating), message, friend, trade, attend, story.  
Launch market: **Varna, BG** (α).

Not a feed. Not a swipe deck.

---

## 2. Shipped on master (code)

| Area | State | Notes |
|------|--------|--------|
| **P1 foundation** | ✅ | Auth · Profile · Map discovery · Presence · Wave · Chat |
| **P2 hardening** | ✅ | Blocks · outbox · viewport diff · Sentry · cell-cap |
| **Friends** | ✅ | Requests · suggestions · mutual · presence privacy · map tier |
| **Stories** | ✅ | Create photo/video · Pulse strip · strike escalation |
| **Marketplace** | ✅ | Sell/Wanted · offers + counter · urgency **0044** · Message seller |
| **Verification** | ✅ | Email OTP · phone Redis fallback · ID queue · atomic decide · Rekognition assist-only |
| **Dating layer** | ✅ | Prefs **0046** · likes **0047** · map Dating filter · empty nudge |
| **Pin interaction ladder** | ✅ | Preview → sheet → full + back · dual-mode · machine-owned CTAs · match→chat (**#468–#486**) |
| **Map chrome** | ✅ | Calm v1 · Search · filters · TrendingCard · coach v2 · trust nudge |
| **UX primitives** | ✅ | ScreenHeader · FormField · ListRow · EmptyState · IdentityBlock · theme |
| **Admin** | ✅ | Vite `127.0.0.1:5173` · AdminGuard · id:approve CLI |
| **Migrations** | **0001–0047** on master. dual-0030 resolved. Prefix CI guard. **Next free: 0048** |

### Pin interaction (2026-10-05)

| Slice | PR | Status |
|-------|-----|--------|
| Stage-1 PreviewCallout + machine | #468+ | ✅ |
| C2a sheet handoff | #478 | ✅ |
| C2b dual-mode Like/Pass | #479 | ✅ |
| C3 full profile + back-to-sheet | #481 | ✅ |
| B machine-owned CTAs + C match→chat | #484 | ✅ |
| Lint cleanup | #485 · #486 | ✅ CI green |

Machine owns Wave / Like / Pass; context holds `conversationId` / `datingConversationId` for Chat handoff.

---

## 3. Ops gaps (not code blockers)

1. **Rekognition on Render** — `REKOGNITION_ENABLED=true`, region = S3, IAM DetectFaces/CompareFaces.
2. **`ADMIN_USER_IDS` on Render** — required for prod ID queue.
3. **Twilio email OTP** — Redis/DEV fallback; wire real channel for prod.
4. **Migrations on Render** — ensure through **0047** (dating likes).
5. **Play Console** — closed testing still open.
6. **Device smoke** — pin ladder (Wave / Like / match→Chat / Pass / full back).

---

## 4. Next (priority order)

| # | Item | Why |
|---|------|-----|
| 1 | **Device smoke** | Pin ladder + cold-start map + story + listing urgency |
| 2 | **Trust ops** | Rekognition + ADMIN_USER_IDS; one E2E ID decide |
| 3 | **pinInteraction.machine.spec.ts** | Lock B/C transitions (artifact ready — apply + PR) |
| 4 | **STATUS / CLAUDE sync** | Keep docs aligned after pin merge |
| 5 | **Play closed testing** | Owner path |
| 6 | **Retention metrics** | D1/D7 on verified users before monetization |

**Explicitly not next:** live streaming · group chat · web client · premium paywall · ML matching · Kafka/GraphQL.

---

## 5. Architecture that runs

```
Mobile (RN + TS)  ──REST + Socket.IO──►  NestJS monolith
                                              │
                    PostGIS (viewport / KNN)  Redis (presence, OTP, rate)
                                              S3 (media, ID docs)
                                              FCM (push)
apps/admin (Vite) ──JWT AdminGuard──► same API
```

Shared types: `packages/shared`. Pin UX: XState `pinInteractionMachine` on MapScreen.

---

## 6. Success metrics (α — Varna)

- D1 / D7 retention on **verified** users (email+).
- Map session depth: pin open → CTA → chat.
- Trust funnel: email → phone → ID approve rate.

# STATUS — G88

> **Last updated:** 2026-09-24  
> **Authority:** live progress. Sequence/gates → `ROADMAP.md`. System design → `ARCHITECTURE.md`. Feature contracts → `SPECIFICATION.md`. Snapshot → `docs/STATUS_CURRENT.md`.

### ✅ Where we are / ⏭️ What's next

**Shipped on master (code):**

| Area | State |
|------|--------|
| **P1 foundation** | ✅ Auth · Profile · Map discovery · Presence · Wave · Chat |
| **P2 pre-launch hardening** | ✅ Gate list complete (incl. **P2.B1 blocks** — wave path returns `wave.blocked`) |
| **P3 habit-forming** | ✅ Gamification, gifts, push/geofences, verification UI, events, trending, trading (offers + counter) |
| **Friends** | ✅ 0032/0033 — requests, list, presence privacy (`friends_see_online_status`), mutual, suggestions (rank C + dismiss **0043**), request notifications + badge, interactions inbox |
| **Stories (P4.S)** | ✅ 0029 — create/nearby/view/react; soft gate (email + 24h age); Pulse strip; **video create + viewer playback** (mute, progress, fail/retry overlay); mediaUrl trust |
| **Profile origin** | ✅ 0031 — DOB (18+), hometown, showAge/showHometown |
| **Profile cover** | ✅ Cover photo + setCover |
| **ID verification** | ✅ Submit → S3 → pending; admin queue; atomic decide; partial UNIQUE pending (0034); `verification:updated` WS; **assist-only Rekognition** |
| **Map polish Option 1** | ✅ SearchBar · CategoryFilter · TrendingCard — PRs #349–#351 |
| **Map calm v1** | ✅ #409–#410 — People/Events/Listings labels · More sheet · recenter · pan-dismiss challenge · `+` create chip · coach v2 |
| **Map empty / online** | ✅ #412 — create nudge after coach v1|v2 · online green pip (privacy-gated) |
| **EntityBottomSheet** | ✅ Above-fold price/time + distance (#411) · CTA Wave→Message→Profile · mutual · stats · Message seller/host |
| **Listing mode** | ✅ Discovery `listingMode` · Wanted styling · post-create map focus |
| **Friends-only layer** | ✅ Server filter + chrome + empty copy |
| **Map online privacy** | ✅ Online markers gated by friendship + `friends_see_online_status` |
| **Discovery ranking** | ✅ rankBy relevance/distance/newest · PostGIS KNN · lastSeen activityScore |
| **UX chrome** | ✅ ScreenHeader, FormField, ListRow, EmptyState, IdentityBlock, Avatar rings (friend teal) |
| **Theme residual** | ✅ Hex → tokens mass + residual tail closed (#346/#347) |
| **Offers / strikes** | ✅ Schema 0038–0040; counter-offer wire; buyer accept seller counter; strike standing surface |
| **Map activation** | ✅ Trust ladder NudgeBanner (email→phone→ID→streak); map empty CTAs |
| **Admin** | ✅ `apps/admin` Vite queue @ `127.0.0.1:5173`; CORS; AdminGuard |
| **Migrations** | **0001–0043** on disk/master. dual-0030 resolved. Filesystem prefix CI guard. **Next free: 0044** |
| **Android** | Sideload APK + signed AAB pipelines; privacy policy live |

**Ops gaps (not code blockers):**

1. **Rekognition on Render** — `REKOGNITION_ENABLED=true`, region match S3, IAM DetectFaces/CompareFaces on `g88-dev`. Until then scores stay skipped/error; human decide still works.
2. **`ADMIN_USER_IDS` on Render** — required for prod queue decide.
3. **Twilio email OTP** — often fails; Redis/dev fallback logs codes. Wire real email for prod.
4. **Play Console** — owner-side closed testing still open (`DEPLOY.md`).
5. **G2/G3 live exercise** — Twilio SMS + Stripe test checkout not fully run-verified on deploy.

**Next, in order:**

1. Enable Rekognition in prod + one E2E submit → admin score visible.
2. Confirm `ADMIN_USER_IDS` on Render; approve pending via UI or `pnpm --filter @g88/backend id:approve`.
3. Device smoke (map calm + create + online + Message paths).
4. Play closed testing (owner).
5. Live-verify phone OTP + Stripe test webhook.

---

## Phase snapshot (ROADMAP vocabulary)

| Phase | Status | Notes |
|-------|--------|--------|
| P1 — foundation | ✅ shipped | Auth → Profile → Map → Presence → Wave → Chat |
| P2 — pre-launch hardening | ✅ shipped | B1 blocks closed in code; Android beta path engineering-complete |
| P3 — habit-forming | ✅ shipped | P3.1–P3.7 + friends + interactions inbox |
| P4+ — horizon | 🟡 partial | **P4.S Stories shipped** (incl. video viewer); monetization / group chat / web still gated |

---

## Known residual / doc debt

| Item | Notes |
|------|--------|
| `admin.guard.spec.ts` | Still missing |
| Events/listings block-by-author | Optional; needs authorId in discovery meta |
| Strike appeal / copy polish | Escalation enforced; product copy optional |
| Hex theme lint | Convention only; not enforced |

---

## Ops quick refs

- **Admin local:** `http://127.0.0.1:5173` — must be in `CORS_ORIGINS`.
- **ID approve CLI:** `pnpm --filter @g88/backend id:approve` / `id:review` — see `docs/ID_VERIFICATION_OPS.md`.
- **Sideload APK:** GitHub Release `releases/latest/download/g88-v1.0.apk`.
- **Privacy:** `https://g88-legal.onrender.com/privacy`.

Update this file as work progresses.

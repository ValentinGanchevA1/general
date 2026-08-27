# Doc drift fixes (2026-08-28)

Apply these after restoring `SPECIFICATION.md` / `STATUS.md` from `master` if they were wiped.

## SPECIFICATION.md §2.7

**Status** → ✅ Shipped. Waves enforce `blocks.isBlocked` before insert (`wave.blocked`). P2.B1 fully closed.

**Enforcement** add:
- `interactions.service.ts` — `blocks.isBlocked(from, to)` before wave insert (`wave.blocked`)
- `gifts.service.ts` — send-time block guard
- Still not: events/listings visibility (needs `authorId` in view meta)

**Acceptance** add:
- Waves to blocked/blocking counterpart → `wave.blocked` (403)
- `BlocksModule` is registered in `app.module.ts`

**Decision log** add row:
`2026-08-28 | §2.7 wave gap closed — status → ✅ | interactions.service calls blocks.isBlocked`

## STATUS.md

Replace dual-0030 warning with:

> Profile origin is **`0031_profile_origin`** (collision resolved via #126). Chat location share stayed `0030_chat_location_share`. Next free was 0035 as of 2026-08-21 — verify before cutting a new migration.

## Code (already on this branch)

`apps/backend/src/modules/id-verification/admin.guard.spec.ts` — allow/deny on `ADMIN_USER_IDS`.

## Hex colors

Count 49→58: **do not add lint yet**. Convention is not being followed; either own a real eslint rule on touched files later or drop the convention from audit checklists.

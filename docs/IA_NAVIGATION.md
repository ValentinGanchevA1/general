# G88 Mobile — Information Architecture & Navigation Map

> Source of truth: `apps/mobile/src/navigation/*` on master.
> Last reviewed: 2026-09-03 (Social stack + Marketplace chrome).

See full document in repo history if truncated — primary changes:
- **Social** nested stack: FriendsList | Suggestions (out of Account)
- **Marketplace** entries: Map 🏪 badge, Profile Local market row
- Account stack is settings / verification / privacy only

## Hierarchy (updated)

```
Root
├── Main tabs: Map · Pulse · Profile
├── Social ──stack──► FriendsList | Suggestions
├── Account ──stack──► Settings | Verification | Privacy | …
├── Commerce ──stack──► Marketplace | ListingDetail | ListingCreate
└── …
```

## Marketplace entry points

| Surface | Control |
|---------|--------|
| Map | MapChrome 🏪 badge → `openRootScreen('Marketplace')` |
| Profile | Local market row → Marketplace |
| ContextualFab | when mounted |

## IA-1 / IA-2 status

| ID | Status |
|----|--------|
| IA-1 Social stack | **Shipped** |
| IA-2 Marketplace chrome | **Shipped** |

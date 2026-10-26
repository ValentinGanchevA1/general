# NEXA Mobile — Information Architecture & Navigation

> **Product IA reference.** Runtime source of truth is `apps/mobile/src/navigation/AppNavigator.tsx` plus `stacks.ts`.  
> Tab identity/semantics are defined in `apps/mobile/src/navigation/NEXA_NAVIGATION_TABS.md`.  
> **Reviewed:** 2026-10-26.  
> Compatibility route names may remain technical identifiers; do not infer visible product copy from a legacy route name.

---

## 1. Canonical product model

NEXA is map-first. The authenticated primary navigation is fixed to five tabs:

| Order | Tab | Product role |
|---:|---|---|
| 1 | **Map** | Primary spatial surface: nearby people, events and listings; contextual actions and creation |
| 2 | **Discover** | Navigation hub into people, events, marketplace and suggestions; not a second feed |
| 3 | **Pulse** | Live/local activity interpretation and event/marketplace lanes |
| 4 | **Connections** | Chats plus actionable relationship activity |
| 5 | **You** | Signed-in identity, profile, activity and settings entry points |

The old centered Create tab is not part of primary navigation. Creation stays contextual to the Map through existing create/FAB/long-press flows.

---

## 2. Navigator hierarchy

```text
NavigationContainer
└── Root Stack
    ├── [guest] Auth
    └── [authenticated]
        ├── ProfileCreation                 profile-completion gate
        ├── Main → Bottom Tabs
        │   ├── Map
        │   ├── Discover
        │   ├── Pulse
        │   ├── Connections
        │   └── You
        │
        ├── Chat
        ├── UserProfile
        ├── MutualFriends
        ├── AlertComposer
        ├── GiftsInbox
        ├── Interactions                    compatibility fallback only
        ├── Gamification → Challenges | Leaderboard | Achievements
        ├── Commerce → Marketplace | ListingDetail | ListingCreate
        ├── Account → Settings | TrustCenter | Privacy | Help | About
        │             NotificationSettings | BlockedUsers | Verification
        │             EmailVerification | VerificationId | Subscription
        │             SocialLinking | ProfileEdit | Photos
        ├── Social → FriendsList | Suggestions
        └── Events → EventDetail | EventCreate
```

`AppNavigator.tsx` and the typed param lists remain authoritative if this diagram and code ever diverge.

---

## 3. Tab contracts

### Map

- Home/default product surface.
- Accepts focus params for the signed-in user, another user, a listing, coordinates and contextual create entry.
- Entity sheets/actions remain map-owned rather than becoming extra primary tabs.
- Map/discovery privacy precision remains server-authoritative.

### Discover

Discover is a lightweight routing hub, not another ranked content feed. Current lanes route into existing surfaces:

- Nearby people → Map
- Local events → Pulse / Events
- Marketplace → Commerce / Marketplace
- People you may know → Social / Suggestions

Opening Discover itself does not introduce a new location-permission, persistence, REST or Socket.IO contract.

### Pulse

Pulse supports the current product filters (`for-you`, `nearby`, `events`, `marketplace`) and remains the local-activity interpretation surface.

### Connections

`Connections` renders the existing interactions/chats implementation as the canonical visible product destination.

Badge policy is functional only: unread chats plus pending connection actions, capped at `99+`. It must not expose popularity or vanity counts.

### You

`You` is the signed-in profile/identity surface. Profile, verification, map presence and account-management flows fan out from here into the existing root/nested stacks.

---

## 4. Compatibility re-entry

`Interactions` is retained as a root route for source compatibility with older push/toast/map callers.

New normal re-entry must resolve to:

```text
Main → Connections
```

Do not create a duplicate visible Interactions destination or reintroduce it as a sixth tab.

---

## 5. Navigation identity & accessibility

- Labels stay visible; navigation does not rely on icons alone.
- Map / Discover / Pulse use discovery/live semantic treatment.
- Connections / You use relationship/identity semantic treatment.
- Interactive tab targets remain at least 44dp wide.
- Connections is the only primary tab that may show an actionable numeric badge.
- Keyboard-open behavior may hide the tab bar where configured.

---

## 6. Privacy / abuse invariants

Navigation is never the security boundary:

- no route bypasses block, verification or messaging permissions;
- Discover does not request fresh location merely by opening;
- route params and UI copy must not expose hidden/exact location data;
- push re-entry must not reveal additional lock-screen/private information;
- no tab badge exposes follower count, popularity, trust score or nearby population.

---

## 7. Historical note

The pre-NEXA document described an older three-tab `Map / Pulse / Profile` model with a visible `Interactions` root surface. That model is historical and must not be used for new product or implementation decisions.

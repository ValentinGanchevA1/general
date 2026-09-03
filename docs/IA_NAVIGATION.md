# G88 Mobile — Information Architecture & Navigation Map

> Source of truth: `apps/mobile/src/navigation/*` on master.  
> Last reviewed: 2026-09-03 (post #260 EntityBottomSheet CTA, #264 typecheck).

---

## 1. Product model (what the IA optimizes for)

| Pillar | Primary surface | User goal |
|--------|-----------------|-----------|
| **Map & Discovery** | Tab `Map` | See nearby people/events/listings; wave / message |
| **Pulse (feed)** | Tab `Pulse` | Stories + activity stream; jump to entities |
| **Self** | Tab `Profile` | Identity, activity, friends entry, presence |
| **Chat** | Root `Chat` | 1:1 conversation |
| **Interactions** | Root `Interactions` | Inbox: waves, requests, followers |
| **Account** | Nested `Account` | Settings, verification, privacy, friends list |
| **Commerce** | Nested `Commerce` | Marketplace browse / create / detail |
| **Events** | Nested `Events` | Event create / detail |
| **Gamification** | Nested `Gamification` | Challenges, leaderboard, achievements |

**Design rule:** Map is the home surface. Everything else is a *modal or nested stack* reached via `openRootScreen` or tab switch — never a fourth tab.

---

## 2. Navigator hierarchy (wireframe)

```
NavigationContainer
└── Root Stack (headerShown: false unless noted)
    ├── [guest] Auth
    └── [authed]
        ├── ProfileCreation          (gate until profileSetupComplete)
        ├── Main                     → Bottom Tabs
        │   ├── Map                  (focusMyPin | focusUserId/Lat/Lng)
        │   ├── Pulse                (filter?: all|chats|waves|listings|alerts|matches)
        │   └── Profile              (self)
        │
        ├── Chat                     { conversationId, otherUserName, … }
        ├── UserProfile              { userId }
        ├── MutualFriends            { peerUserId, peerName? }
        ├── Interactions             (header: Interactions)
        ├── GiftsInbox
        ├── AlertComposer            { presetCategory?, presetTag? }
        │
        ├── Gamification  ──stack──▶ Challenges | Leaderboard | Achievements
        ├── Commerce      ──stack──▶ Marketplace | ListingDetail | ListingCreate
        ├── Account       ──stack──▶ Settings | Privacy | Help | About
        │                            NotificationSettings | BlockedUsers
        │                            Verification | EmailVerification | VerificationId
        │                            Subscription | SocialLinking
        │                            ProfileEdit | Photos
        │                            FriendsList | Suggestions
        └── Events        ──stack──▶ EventDetail | EventCreate
```

### Overlay / non-route surfaces (map-owned)

These are **not** stack screens; they live on `MapScreen`:

| Surface | Trigger | Exit |
|---------|---------|------|
| `EntityBottomSheet` (36% / 62%) | Marker tap / peer focus | dismiss / Wave / Message / Profile |
| `EmptyState` overlay | 0 points in viewport | Refresh |
| `CreateNearbySheet` | Long-press map | Listing / Event / Alert |
| `MapChrome` (challenge, nudge, 👋, FAB) | always | Interactions via 👋 |
| `MapCoachMarks` | first sessions | dismiss |
| `EventsRail` | region ready | → EventDetail |

---

## 3. Tab wireframes (primary chrome)

### 3.1 Map tab

```
┌─────────────────────────────────────┐
│  [DailyChallenge]                   │  safe-area top
│  [NudgeBanner streak]               │
│  [👋 badge]                         │  → Interactions
│                                     │
│           MAP VIEWPORT              │
│        (markers / clusters)         │
│                                     │
│     ┌─ EmptyState (if sparse) ─┐    │
│     └─────────────────────────┘    │
│                                     │
│  [EventsRail]───────────────     │  bottom-ish
│                          [FAB]      │  create / compose
└─────────────────────────────────────┘
         EntityBottomSheet ↑
    ┌──────────────────────────────┐
    │ IdentityBlock (ring)         │
    │ [Wave] [Message] [Profile]   │  CTA order locked
    │ Trust · Stats · Bio · Block  │
    └──────────────────────────────┘
```

**Focus params (Tab `Map`):**

| Param | Source | Behavior |
|-------|--------|----------|
| `focusMyPin` | Profile “View my pin” | animate to GPS, clear param |
| `focusUserId` + lat/lng | UserProfile “View on map” | `pendingMapFocus` + animate + open sheet |

### 3.2 Pulse tab

```
┌─────────────────────────────────────┐
│  PulseStrip (stories)               │  create / view
│  filter chips (optional)            │
│  feed rows → UserProfile / listing  │
│              / event / alert        │
└─────────────────────────────────────┘
```

Gate: email verified + account age for story post (soft).

### 3.3 Profile tab (self)

```
┌─────────────────────────────────────┐
│  Cover + Avatar                     │
│  Name · trust % · [Settings ⚙]      │
│  Bio / tags                         │
│  Activity: Challenges · LB · Ach · Gifts
│  Friends card → FriendsList         │
│  Storyline (self)                   │
│  Photos → Photos manage             │
│  Premium → Subscription             │
│  View my pin on map                 │
└─────────────────────────────────────┘
```

**Intentionally not on Profile:** Logout, Privacy, Help, Connected accounts, Phone add — all under **Settings** (`Account` stack).

---

## 4. Nested stack maps (leaf screens)

### Account (`openRootScreen → Account`)

| Screen | Entry | Notes |
|--------|-------|-------|
| Settings | Profile ⚙ | Hub |
| ProfileEdit | Settings | Identity edit |
| Photos | Profile / Settings | Gallery + cover |
| FriendsList | Profile friends card | Requests tab + badge |
| Suggestions | FriendsList CTA | People you may know |
| Verification | Settings / gates | Phone ladder |
| EmailVerification | Soft gates / Settings | OTP |
| VerificationId | Settings / ladder | ID submit |
| SocialLinking | Settings | Connected accounts |
| Subscription | Profile premium | Stripe |
| NotificationSettings | Settings | Channels |
| BlockedUsers | Settings | |
| Privacy / Help / About | Settings → Account section | |

### Commerce

| Screen | Entry |
|--------|-------|
| Marketplace | (future chrome / pulse) |
| ListingCreate | Map long-press / FAB |
| ListingDetail | Pulse / map listing marker |

### Events

| Screen | Entry |
|--------|-------|
| EventCreate | Map long-press / FAB |
| EventDetail | EventsRail / Pulse / marker |

### Gamification

| Screen | Entry |
|--------|-------|
| Challenges / Leaderboard / Achievements | Profile activity links |

---

## 5. Cross-cutting flows (sequence)

### A. Map → Wave → Chat

```
Map marker → EntityBottomSheet → Wave
  → POST /interactions/wave
  → if conversationId → Root Chat
```

### B. Map → Message

```
Sheet Message (canMessage ≠ none) → POST /chat/conversations → Chat
```

### C. Map → Profile → Map focus

```
Sheet Profile → UserProfile
  → View on map → pendingMapFocus + Main/Map focus params
  → Map animates + sheet for peer
```

### D. Interactions inbox

```
Map 👋 / push → Interactions
  → Accept friend / Follow back / Match CTAs
  → may open Chat or UserProfile
```

### E. Create nearby

```
Long-press map → CreateNearbySheet
  → ListingCreate | EventCreate | AlertComposer
  (coords as initialLocation)
```

---

## 6. IA findings (friction & debt)

| ID | Severity | Finding | Recommendation |
|----|----------|---------|----------------|
| IA-1 | **High** | FriendsList + Suggestions live under **Account** stack | Acceptable short-term; long-term prefer `Social` nested stack or Profile-owned stack so Settings does not own graph |
| IA-2 | **High** | Marketplace has no first-class chrome entry from Map/Profile | Add Map FAB / Pulse filter / Profile shortcut; avoid orphan Commerce |
| IA-3 | **Med** | `Interactions` vs Pulse filters overlap (waves) | Keep Interactions as **action inbox**; Pulse as **discovery feed** — document in UI copy |
| IA-4 | **Med** | GiftsInbox is root-level but only linked from Profile activity | Either promote (tab badge) or nest under Account/Gamification consistently |
| IA-5 | **Med** | EntityBottomSheet CTAs fixed Wave → Message → Profile | Lock in design system; do not re-order without conversion data |
| IA-6 | **Low** | `openRootScreen` leaf union missing `Suggestions` | **Fixed** in this PR — `Suggestions` in Leaf + NEST |
| IA-7 | **Low** | MutualFriends is root-only | OK; ensure back always returns to UserProfile |
| IA-8 | **Info** | Auth / ProfileCreation gates are root-level | Keep; do not put on tabs |

---

## 7. Navigation API contract

| Helper | When |
|--------|------|
| `navigation.navigate('Main', { screen, params })` | Tab switch / map focus |
| `openRootScreen(nav, leaf, params?)` | Any nested leaf from tabs/map/toasts |
| `openViaRef(leaf, params?)` | Push handlers / no nav prop |
| `pendingMapFocus` module | UserProfile → Map handoff (survives tab remount) |

**Rule:** From Main tabs and map chrome, **never** `navigate('ListingCreate')` directly — always `openRootScreen(..., 'ListingCreate', …)`.

---

## 8. Target IA (next slice — optional)

If we lift social out of Account:

```
Root
├── Social  ──stack──▶ FriendsList | Suggestions | MutualFriends?
└── Account ──stack──▶ Settings + verification + privacy only
```

Profile friends card → `Social/FriendsList`.  
Settings keeps BlockedUsers + online privacy toggle only.

Do **not** add a 4th tab. Social stays a nested stack.

---

## 9. Acceptance checklist (IA health)

- [x] Every leaf in `openRootScreen` Leaf union has a NEST entry or is a true root screen
- [ ] Map long-press create paths use `openRootScreen`
- [ ] Profile has no Logout / Privacy / Help rows (Settings only)
- [ ] Sheet CTA order Wave → Message → Profile
- [ ] View-on-map uses `pendingMapFocus` + focus params
- [ ] Push handler uses `openViaRef` only

---

## 10. File map

| Path | Role |
|------|------|
| `navigation/AppNavigator.tsx` | Root + tabs + nested host screens |
| `navigation/stacks.ts` | Nested param lists |
| `navigation/openRootScreen.ts` | Leaf → stack router |
| `navigation/pendingMapFocus.ts` | Peer focus handoff |
| `navigation/navigationRef.ts` | Ref for push / cold start |

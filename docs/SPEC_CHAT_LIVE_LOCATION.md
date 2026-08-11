# SPEC: Chat Live Location Share

> **Status:** Design locked · Implementation not started  
> **Branch:** `feat/chat-live-location`  
> **Depends on:** existing chat (Socket.IO + REST), `useUserLocation`, conversation membership  
> **Does not depend on:** map visibility / public presence  
> Last revised: 2026-08-11

---

## 1. Product summary

Users can share **timed live location** inside a 1:1 chat.

| Decision | Choice |
|----------|--------|
| Scope | Timed live session (15m / 60m / until off) |
| Entry | Tap 📍 in composer → duration confirm → start |
| Coordinates | **Exact** (private 1:1 context) |
| Message model | Extend with `type` + payload (option A) |
| Pending request | Allowed as first message |
| Blocks | Existing chat block rules apply |
| Label | **"Live location"** (not "Approximate" — coords are exact) |
| Map visibility | Independent — does **not** force `visibility = public` |

Out of scope for v1: path history trail, group chat, background iOS always-on without user consent UI, static one-shot pin (can follow as thin add-on).

---

## 2. User flow

```
Chat composer
  [🎁] [📍] [ Message… ] [↑]
         │
         ▼
  Duration sheet
  ┌──────────────────────────────┐
  │  Share live location         │
  │  ○ 15 minutes                │
  │  ○ 1 hour                    │
  │  ○ Until I turn it off       │
  │  [Cancel]        [Share]     │
  └──────────────────────────────┘
         │
         ▼
  • System/session message in thread
  • Sticky banner both sides: "X is sharing · 14:32 left"
  • Sharer: Stop button
  • Recipient: Open in Maps / in-app pin
  • GPS updates ~every 10–15s or 25m movement
         │
         ▼ ends on timer | stop | stale heartbeat | leave
```

---

## 3. Shared types (`packages/shared`)

### 3.1 API / domain (`api.ts`)

```ts
export type ChatMessageType = 'text' | 'location' | 'location_session';

export type LocationShareDuration = '15m' | '60m' | 'until_off';

export type LocationShareStatus = 'active' | 'ended';

export type LocationShareEndReason =
  | 'expired'
  | 'stopped'
  | 'timeout'
  | 'blocked'
  | 'conversation_closed';

export interface ChatLocation {
  lat: number;
  lng: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: ChatMessageType;          // default 'text' for back-compat
  location?: ChatLocation;        // one-shot (future)
  locationSessionId?: string;     // when type === 'location_session'
  createdAt: string;
}

export interface LocationShareSession {
  id: string;
  conversationId: string;
  sharerId: string;
  status: LocationShareStatus;
  duration: LocationShareDuration;
  startedAt: string;
  endsAt: string | null;          // null when until_off
  lastLocation: ChatLocation;
  lastUpdatedAt: string;
  endedAt?: string | null;
  endReason?: LocationShareEndReason | null;
}
```

### 3.2 Socket events (`events.ts`)

```ts
// ── Client → Server ──────────────────────────────────────────

export interface LocationShareStartPayload {
  conversationId: string;
  duration: LocationShareDuration;
  location: ChatLocation;
}

export interface LocationShareUpdatePayload {
  sessionId: string;
  location: ChatLocation;
}

export interface LocationShareStopPayload {
  sessionId: string;
}

// Extend ClientToServerEvents:
'location:share:start': (
  p: LocationShareStartPayload,
  ack: (r: AckResult<LocationShareSession>) => void,
) => void;

'location:share:update': (
  p: LocationShareUpdatePayload,
  ack: (r: AckResult<{ updatedAt: string }>) => void,
) => void;

'location:share:stop': (
  p: LocationShareStopPayload,
  ack: (r: AckResult<{ ended: true }>) => void,
) => void;

// ── Server → Client ──────────────────────────────────────────

export interface LocationShareStartedEvent {
  session: LocationShareSession;
  /** System message row inserted into the thread. */
  message: ChatMessage;
}

export interface LocationShareUpdateEvent {
  sessionId: string;
  conversationId: string;
  location: ChatLocation;
  updatedAt: string;
}

export interface LocationShareEndedEvent {
  sessionId: string;
  conversationId: string;
  reason: LocationShareEndReason;
  endedAt: string;
}

// Extend ServerToClientEvents:
'location:share:started': (e: LocationShareStartedEvent) => void;
'location:share:update': (e: LocationShareUpdateEvent) => void;
'location:share:ended': (e: LocationShareEndedEvent) => void;

// Optional: extend ChatMessageEvent / ChatSendPayload later for one-shot pins
```

---

## 4. Database migration

```sql
-- migrations/00XX_chat_location_share.sql

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text'
    CHECK (type IN ('text', 'location', 'location_session')),
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS location_session_id uuid;

CREATE TABLE IF NOT EXISTS chat_location_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sharer_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'ended')),
  duration          text NOT NULL
                      CHECK (duration IN ('15m', '60m', 'until_off')),
  started_at        timestamptz NOT NULL DEFAULT NOW(),
  ends_at           timestamptz,          -- NULL = until_off
  last_lat          double precision NOT NULL,
  last_lng          double precision NOT NULL,
  last_updated_at   timestamptz NOT NULL DEFAULT NOW(),
  ended_at          timestamptz,
  end_reason        text
                      CHECK (end_reason IS NULL OR end_reason IN (
                        'expired', 'stopped', 'timeout', 'blocked', 'conversation_closed'
                      )),
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_location_sessions_conv_active_idx
  ON chat_location_sessions (conversation_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS chat_location_sessions_ends_at_idx
  ON chat_location_sessions (ends_at)
  WHERE status = 'active' AND ends_at IS NOT NULL;

ALTER TABLE messages
  ADD CONSTRAINT messages_location_session_fk
  FOREIGN KEY (location_session_id)
  REFERENCES chat_location_sessions(id)
  ON DELETE SET NULL;
```

**Rules**
- At most **one active session per (conversation, sharer)**.
- Starting a new session ends any previous active session for that pair.

---

## 5. Backend

### 5.1 `LocationShareService` (Nest)

```ts
// apps/backend/src/modules/chat/location-share.service.ts

@Injectable()
export class LocationShareService {
  private static readonly STALE_MS = 90_000; // no update → timeout
  private static readonly MIN_UPDATE_INTERVAL_MS = 5_000;
  private static readonly MAX_SPEED_M_S = 100; // anti-spoof soft bound

  constructor(
    private readonly db: DataSource,
    private readonly chat: ChatService,
    // gateway injected via forwardRef or event emitter for fan-out
  ) {}

  async start(
    userId: string,
    conversationId: string,
    duration: LocationShareDuration,
    location: ChatLocation,
  ): Promise<{ session: LocationShareSession; message: ChatMessage }> {
    await this.assertParticipant(userId, conversationId);
    await this.assertNotBlocked(userId, conversationId);
    this.assertValidCoords(location);

    // End any existing active session for this sharer in this conversation
    await this.endActiveForSharer(userId, conversationId, 'stopped');

    const endsAt = this.computeEndsAt(duration);
    const row = await this.insertSession({
      conversationId,
      sharerId: userId,
      duration,
      endsAt,
      location,
    });

    // System message in thread
    const message = await this.chat.persistSystemLocationSession(
      conversationId,
      userId,
      row.id,
      bodyForStart(duration),
    );

    return { session: this.toSession(row), message };
  }

  async update(
    userId: string,
    sessionId: string,
    location: ChatLocation,
  ): Promise<{ updatedAt: string }> {
    this.assertValidCoords(location);
    const session = await this.getActive(sessionId);
    if (session.sharer_id !== userId) throw forbidden('location.not_sharer');
    if (session.status !== 'active') throw gone('location.ended');

    // Rate limit + soft anti-teleport
    await this.assertUpdateAllowed(session, location);

    const updatedAt = new Date().toISOString();
    await this.db.query(
      `UPDATE chat_location_sessions
          SET last_lat = $2, last_lng = $3, last_updated_at = $4
        WHERE id = $1 AND status = 'active'`,
      [sessionId, location.lat, location.lng, updatedAt],
    );
    return { updatedAt };
  }

  async stop(userId: string, sessionId: string): Promise<void> {
    const session = await this.getActive(sessionId);
    if (session.sharer_id !== userId) throw forbidden('location.not_sharer');
    await this.markEnded(sessionId, 'stopped');
  }

  /** Called by cron / interval: expire by ends_at and stale last_updated_at. */
  async sweepExpired(): Promise<number> {
    // 1) ends_at <= now
    // 2) last_updated_at older than STALE_MS
    // return count ended
  }
}
```

### 5.2 Gateway handlers (`realtime.gateway.ts`)

```ts
@SubscribeMessage('location:share:start')
async onLocationStart(
  @ConnectedSocket() client: Socket,
  @MessageBody() body: LocationShareStartPayload,
): Promise<AckResult<LocationShareSession>> {
  const userId = client.data.userId;
  try {
    const { session, message } = await this.locationShare.start(
      userId,
      body.conversationId,
      body.duration,
      body.location,
    );
    // Fan-out to conversation room (both participants)
    this.server
      .to(`conversation:${body.conversationId}`)
      .emit('location:share:started', { session, message });
    // Also emit chat:message so existing message list stays consistent
    this.server
      .to(`conversation:${body.conversationId}`)
      .emit('chat:message', message);
    return { ok: true, data: session };
  } catch (e) {
    return toAckError(e);
  }
}

@SubscribeMessage('location:share:update')
async onLocationUpdate(...) { /* update + emit location:share:update to room */ }

@SubscribeMessage('location:share:stop')
async onLocationStop(...) { /* stop + emit location:share:ended */ }
```

**Room:** clients already join `conversation:{id}` via `conversation:join` — reuse it.

### 5.3 REST (optional, for cold open)

```
GET /conversations/:id/location-session
  → active LocationShareSession | null
```

Used when opening ChatScreen so recipient sees an already-running session.

### 5.4 Error codes

| Code | When |
|------|------|
| `location.not_participant` | User not in conversation |
| `location.blocked` | Block either direction |
| `location.not_sharer` | Update/stop by non-owner |
| `location.ended` | Session already ended |
| `location.invalid_coords` | lat/lng out of range |
| `location.rate_limited` | Updates too frequent |
| `chat.request_pending` | Reuse existing pending rules if sharer already sent first msg |

Pending request: location session **counts as the one allowed first message** (same as text).

---

## 6. Mobile

### 6.1 Composer

- Add 📍 button beside gift (same row).
- Opens `LocationShareSheet` (bottom sheet): duration radios + Share / Cancel.
- On Share: request GPS if needed → `location:share:start` → optimistic banner.

### 6.2 `useLiveLocationShare` hook

```ts
function useLiveLocationShare(conversationId: string) {
  // state: activeSession | null, starting, error
  // start(duration)
  // stop()
  // effect: when sharer && active → watchPosition → emit update
  // effect: listen location:share:started | update | ended
  // effect: on unmount / background — keep updating while app foreground;
  //         if app backgrounds, continue best-effort; server times out at 90s
}
```

Update cadence:
- `distanceFilter: 25` (meters)
- Fallback interval 15s if stationary
- Min emit interval 5s (client-side)

### 6.3 UI components

| Component | Role |
|-----------|------|
| `LocationShareSheet` | Duration picker |
| `LocationSessionBanner` | Sticky under header — countdown + Stop (sharer) / Open map (peer) |
| `LocationSessionBubble` | Thread row for `type === 'location_session'` |
| Optional `LocationMapPreview` | Small MapView or static image |

**Bubble copy**
- Sharer: "You started sharing live location"
- Peer: "{Name} started sharing live location"

**Banner**
- Timed: `Live location · 12:48 left`
- Until off: `Live location · sharing`

### 6.4 ChatScreen integration

```tsx
// input row
<TouchableOpacity onPress={() => setShareSheetOpen(true)}>
  <Text>📍</Text>
</TouchableOpacity>

// under header
{activeSession && (
  <LocationSessionBanner
    session={activeSession}
    isSharer={activeSession.sharerId === myUserId}
    onStop={stop}
    onOpenMap={openMaps}
  />
)}

// MessageBubble: branch on msg.type
```

### 6.5 Open in Maps

```ts
const url = Platform.select({
  ios: `maps:0,0?q=${lat},${lng}`,
  android: `geo:${lat},${lng}?q=${lat},${lng}`,
});
Linking.openURL(url);
```

---

## 7. Privacy & safety

| Rule | Implementation |
|------|----------------|
| Exact coords only in chat | No fuzz; only participants receive events |
| Label | "Live location" |
| Independent of map visibility | No write to `users.visibility` |
| Block | `assertNotBlocked` on start/update |
| Stop | One tap for sharer |
| Auto-end | `ends_at` + 90s stale timeout |
| No path history | Only `last_lat/lng` stored |
| Rate limit | ≥5s between updates |
| Pending request | Session start = first message quota |

---

## 8. Edge cases

| Case | Behavior |
|------|----------|
| App backgrounded (sharer) | Best-effort updates; server ends after 90s silence |
| Socket disconnect | Same — timeout ends session |
| Second start by same user | Previous session ended with `stopped` |
| Peer starts own share | Allowed — two concurrent sessions (one per sharer) |
| Conversation deleted | Cascade end |
| GPS denied | Sheet shows error; cannot start |
| Open chat mid-session | `GET .../location-session` hydrates banner |

---

## 9. Acceptance criteria

1. User starts 15m / 60m / until_off from chat 📍.  
2. Both participants see session UI + countdown when timed.  
3. Recipient receives location updates in near real time.  
4. Sharer can stop; both sides get `location:share:ended`.  
5. Timer expiry ends session automatically.  
6. Stale updates (>90s) end session with `timeout`.  
7. Works as first message in a pending request.  
8. Blocked peer cannot start or receive updates.  
9. Map `visibility` flag unchanged.  
10. Existing text chat unaffected (default `type: 'text'`).

---

## 10. Implementation order

| Step | Work | Owner surface |
|------|------|----------------|
| 1 | Shared types in `api.ts` + `events.ts` | `packages/shared` |
| 2 | Migration `00XX_chat_location_share.sql` | backend |
| 3 | `LocationShareService` + module wiring | backend |
| 4 | Gateway handlers + room fan-out | backend |
| 5 | REST `GET .../location-session` | backend |
| 6 | Sweep job (ends_at + stale) | backend |
| 7 | `useLiveLocationShare` + sheet | mobile |
| 8 | Banner + bubble + composer 📍 | mobile |
| 9 | ChatScreen wiring + cold hydrate | mobile |
| 10 | Tests: service unit + socket ack paths | both |

---

## 11. Test plan (minimum)

**Backend**
- start → session row + message row  
- update by non-sharer → rejected  
- stop → status ended + event  
- expire via `ends_at`  
- stale timeout  
- block prevents start  

**Mobile**
- sheet durations  
- optimistic banner on start  
- bubble renders `location_session`  
- stop clears banner  

---

## 12. Open questions (non-blocking)

1. Show a small in-chat MapView preview vs external Maps only?  
2. Push notification: "X shared live location" when chat not focused?  
3. One-shot static pin as follow-up using same `type: 'location'`?

---

## 13. File checklist (when implementing)

```
packages/shared/src/api.ts              # ChatMessage, LocationShareSession, …
packages/shared/src/events.ts           # socket payloads + event map
apps/backend/migrations/00XX_….sql
apps/backend/src/modules/chat/location-share.service.ts
apps/backend/src/modules/chat/location-share.service.spec.ts
apps/backend/src/realtime/realtime.gateway.ts   # handlers
apps/backend/src/modules/chat/chat.controller.ts  # GET active session
apps/mobile/src/features/chat/useLiveLocationShare.ts
apps/mobile/src/features/chat/LocationShareSheet.tsx
apps/mobile/src/features/chat/LocationSessionBanner.tsx
apps/mobile/src/features/chat/LocationSessionBubble.tsx
apps/mobile/src/screens/ChatScreen.tsx          # wire UI
```

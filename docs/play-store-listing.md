# G88 — Play Console Store Listing + Data Safety (copy-paste checklist)

> Drafted 2026-06-22 for the Android-first **closed testing** release (`com.g88`).
> Source of truth for privacy claims: `ARCHITECTURE.md §3.3` (location fuzzing).
> Fill the blanks marked `⟨…⟩` before submitting. Nothing here is legal advice —
> the privacy policy URL must point to a real hosted document.

---

## 1. App details

| Field | Value |
|---|---|
| App name | `G88` ⟨confirm final store name⟩ |
| Package name | `com.g88` (bound at first AAB upload — do not create a different one) |
| Default language | English (United States) |
| App or game | **App** |
| Free or paid | **Free** (in-app subscription exists; declare under monetization) |
| Category | Social |
| Tags | Social, Local, Map |
| Contact email | ⟨support email⟩ |
| Website | ⟨landing page URL, optional⟩ |
| Privacy policy URL | ⟨REQUIRED — hosted privacy policy⟩ |

---

## 2. Store listing copy

### App name (30 char max)
```
G88
```

### Short description (80 char max)
```
See who's nearby on a live map. Wave, chat, and meet people around you.
```
*(70 chars — fits.)*

### Full description (4000 char max)
```
G88 puts the people around you on a live map. Open the app and see nearby
users as interactive avatars — discover who's around, send a wave, and start
a conversation.

WHAT YOU CAN DO
• Live map discovery — nearby people appear as avatars in real time
• Presence — see who's active around you right now
• Wave — a lightweight, low-pressure way to say hi
• Chat — message people you've matched or waved with
• Profiles — a photo, a short bio, and your interests
• Events, listings, gifts, and challenges to keep your area lively

BUILT FOR PRIVACY
Your exact location is never shared with other users. G88 deliberately
coarsens every location to roughly a 120-meter area before anyone else can
see it — so you show up "in the neighborhood," never at your doorstep. Your
precise GPS stays on your device and is used only to place you on the map.

G88 is map-first and local by design. No endless feeds — just the people and
activity actually around you.

⟨Add: any beta caveats, tester instructions, or support contact line.⟩
```

### Graphics checklist (upload in Console)
- [ ] **App icon** — 512×512 PNG, 32-bit, < 1 MB
- [ ] **Feature graphic** — 1024×500 PNG/JPG (shown at top of listing)
- [ ] **Phone screenshots** — min 2, max 8; 16:9 or 9:16; 320–3840 px per side
      (suggest: Map discovery, Profile, Chat, Pulse/Events)
- [ ] **Tablet screenshots** — optional for closed testing
- [ ] **Promo video** — optional (YouTube URL)

---

## 3. Data Safety form (Play Console → App content → Data safety)

> The decisive question Google asks per data type: is it **collected** (sent off
> the device AND stored/used beyond the request) or only **processed ephemerally**
> (sent off the device, used in-memory for the request, not retained)?
>
> G88-specific fact (`ARCHITECTURE.md §3.3`, `presence.service.ts`): the client
> sends **precise GPS** to the server, the server immediately snaps it to the
> ~120m H3 r10 cell centroid, and **only the coarse location is stored**. So:
> precise location = *processed ephemerally*; approximate location = *collected*.

### 3a. Overview answers
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all collected data encrypted in transit? | **Yes** (HTTPS/TLS; WSS for sockets) |
| Do you provide a way for users to request data deletion? | **Yes — in-app** ✅ — Settings → "Delete account" calls `DELETE /users/me`, which permanently hard-deletes the account (DB cascade + S3 blobs + Redis presence). Optionally also declare a deletion-request email as a secondary channel. See §8. |

### 3b. Data types — declare these

| Data type | Collected? | Shared? | Ephemeral only? | Required/Optional | Purpose |
|---|---|---|---|---|---|
| **Approximate location** (~120m) | Yes | No | No (stored) | Required | App functionality (map discovery, presence) |
| **Precise location** (GPS) | No¹ | No | **Yes** | Required | App functionality (computing your map position) |
| **Name** | Yes | No | No | Required | App functionality, account |
| **Email address** | Yes | No | No | Required | Account management, auth |
| **User IDs** | Yes | No | No | Required | Account, app functionality |
| **Photos** (profile/gallery) | Yes | No | No | Optional | App functionality (profile) |
| **Other info — profile** (bio, interests) | Yes | No | No | Optional | App functionality |
| **Messages — in-app** | Yes | No | No | Optional | App functionality (chat) |
| **App interactions** | Yes | No | No | Optional | Analytics (PostHog) ⟨confirm⟩ |
| **Crash logs / diagnostics** | Yes | No | No | Optional | Analytics / app stability (Sentry) |
| **Purchase history** | ⟨Yes if Stripe subs surfaced in-app⟩ | No | No | Optional | App functionality (subscription) |

> ¹ **Precise location** is marked *not collected* because it is **processed
> ephemerally** — transmitted over TLS, fuzzed to ~120m in the same request, and
> never persisted. In Google's form, ephemeral processing is declared by checking
> "processed ephemerally" and is **not** counted as collection. If your reviewer
> interpretation differs, the conservative fallback is: mark precise location
> *Collected = Yes, purpose = app functionality*, and keep the policy text below.

### 3c. Security practices to check
- [x] Data is encrypted in transit
- [ ] Users can request data deletion ⟨confirm account-deletion path⟩
- [x] Committed to Play Families Policy: **N/A** (target audience 13+/adults)
- [x] Independent security review: **No** (not claimed)

---

## 4. App content (other required declarations)

- [ ] **Privacy policy** — paste the hosted URL (same as listing).
- [ ] **App access** — sign-in is required. Provide reviewer credentials:
      `email: ⟨reviewer test account⟩ / password: ⟨…⟩` and any steps to reach
      the map (grant location permission on first launch).
- [ ] **Ads** — declare whether the app contains ads. G88: **No ads** ⟨confirm⟩.
- [ ] **Content rating** — complete IARC questionnaire. Social app with
      user-generated content + user communication + sharing location → expect a
      **Teen**-ish rating; answer truthfully (UGC, user-to-user comms = yes).
- [ ] **Target audience and content** — age **13+** (or 18+ ⟨decide⟩). Do **not**
      target children; "appeal to children" = No.
- [ ] **News app** — No.
- [ ] **COVID-19 contact tracing/status** — No.
- [ ] **Data safety** — section 3 above.
- [ ] **Government app** — No.
- [ ] **Financial features** — ⟨if Stripe subscription is live, declare it⟩.

---

## 5. Sensitive permission note (location)

The app requests `ACCESS_FINE_LOCATION`. Play requires a **prominent disclosure +
runtime consent** before requesting it, and the Data Safety + policy must justify
foreground use. G88 uses location **only in foreground** to place the user on the
map; no background location. If the manifest ever adds
`ACCESS_BACKGROUND_LOCATION`, a separate Play declaration form is triggered —
avoid it for the closed-testing release.

- [ ] Confirm manifest has **no** `ACCESS_BACKGROUND_LOCATION`.
- [ ] Prominent in-app disclosure shown before the OS location prompt.

---

## 6. Privacy policy — must cover (for the hosted doc)

The hosted policy URL must state, at minimum:
1. **What is collected**: account (name, email), profile (photo, bio, interests),
   coarse (~120m) location, in-app messages, device/diagnostic data (Sentry),
   usage analytics (PostHog).
2. **Precise location handling**: GPS is transmitted to compute map position,
   immediately coarsened to ~120m, and **not stored** in precise form.
3. **Who it's shared with**: other users see only your coarse location, avatar,
   and profile. Third-party processors: ⟨Supabase (DB), Render (hosting), AWS S3
   (photos), Firebase (push), Sentry, PostHog, Stripe, Twilio, Google OAuth⟩.
4. **Retention + deletion**: how to delete an account and what's removed.
5. **Contact**: ⟨privacy contact email⟩.

---

## 7. Pre-submit gate (everything must be ✅ before "Start rollout")

- [ ] Privacy policy URL live and reachable
- [ ] Data Safety form completed + saved
- [ ] Content rating questionnaire submitted
- [ ] Target audience set
- [ ] App access reviewer credentials provided
- [ ] Store listing copy + all required graphics uploaded
- [ ] Signed AAB uploaded to the Closed testing track (from `android-release.yml`)
- [ ] Tester email list added + opt-in URL distributed

---

## 8. Account deletion — ✅ shipped (in-app)

Google Play's **User Data policy** requires apps that let users create an account
to provide **in-app account deletion** (and, for production, a **web URL** to
request deletion). The in-app path is now **implemented** (commit `fc1f188`):

- **Backend:** `DELETE /users/me` (JWT, throttled 5/hour) — re-auth (password
  accounts; OAuth-only rely on bearer + `confirm: 'DELETE'`), then a permanent
  hard delete: DB cascade across all `users` FKs (messages, photos rows, waves,
  gifts, events, listings, gamification, refresh-token families, …), explicit
  conversation cleanup, plus **S3 blob purge** and **Redis presence** clear.
- **Mobile:** Settings → "Delete account" → confirm modal with password field.

**Remaining (production only):** a **public web deletion-request URL** — Play
asks account-based apps for a web link in addition to the in-app flow. For
**closed testing** the in-app flow + a deletion-request email in the privacy
policy (§6) suffices. Add the web URL before the production track.
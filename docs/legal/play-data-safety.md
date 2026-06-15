# Google Play — Data Safety form answers (G88)

> ⚠️ **Draft for owner review.** This maps G88's actual data flows to the Play Console
> **Data Safety** questionnaire (App content → Data safety). Fill it in the Console exactly
> as below unless legal review says otherwise. Cross-check against `privacy-policy.md`.
>
> **Key definition that drives these answers:** Google counts data as **"collected"** if it
> is *transmitted off the device* — **not** only if it is stored. G88 blurs location before
> *storage*, but the precise coordinate is *transmitted* to the server first. Therefore
> **precise location is declared "collected."** See the note in §Location below.

---

## Section 0 — Top-level questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all user data encrypted in transit? | **Yes** (TLS/HTTPS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (in-app / via support email) |
| Have you completed Play's Families policy (if targeting children)? | **No** — app is not directed to children |

For every data type below: **Collected = Yes**, **Shared = No** (providers are processors
acting on our behalf, not third parties using data for their own purposes), **Processed
ephemerally = No** unless noted, and **Is collection optional?** as marked.

---

## Section 1 — Data types to declare

### Location
| Type | Collected | Shared | Purpose(s) | Optional? | Note |
|---|---|---|---|---|---|
| **Approximate location** | Yes | No | App functionality | No (core) | The stored, blurred (~120m H3-r10) position used by the map. |
| **Precise location** | Yes | No | App functionality | No (core) | ⚠️ Declared because exact GPS is **transmitted** to the server before it is blurred. It is **not persisted** (discarded on receipt). If you ship client-side fuzzing so precise GPS never leaves the device, you may drop this row and declare approximate-only. |

### Personal info
| Type | Collected | Shared | Purpose(s) | Optional? |
|---|---|---|---|---|
| Name | Yes | No | App functionality, Account management | No |
| Email address | Yes | No | App functionality, Account management | No |
| User IDs | Yes | No | App functionality, Account management | No |
| Phone number | Yes | No | App functionality, Fraud prevention/security | **Yes** (only if you verify your phone) |
| Other info — **government ID / identity documents** | Yes | No | Fraud prevention, security, and compliance | **Yes** (only if you start ID verification) |

### Financial info
| Type | Collected | Shared | Purpose(s) | Optional? | Note |
|---|---|---|---|---|---|
| Purchase history | Yes | No | App functionality | Yes (subscribers only) | Subscription tier/status. |
| Payment info (card numbers) | **No** | No | — | — | Handled entirely by **Stripe**; the app never receives or stores card data. |

### Messages
| Type | Collected | Shared | Purpose(s) | Optional? |
|---|---|---|---|---|
| Other in-app messages | Yes | No | App functionality | Yes (only if you chat/wave) |

### Photos and videos
| Type | Collected | Shared | Purpose(s) | Optional? |
|---|---|---|---|---|
| Photos | Yes | No | App functionality | Yes (profile/gallery; verification images) |

### App activity
| Type | Collected | Shared | Purpose(s) | Optional? |
|---|---|---|---|---|
| App interactions | Yes | No | App functionality, Analytics | No |
| Other user-generated content | Yes | No | App functionality | Yes (alerts, events, listings, gifts) |
| Search history | Yes | No | App functionality | Yes (only if you search) |

### App info and performance
| Type | Collected | Shared | Purpose(s) | Optional? | Note |
|---|---|---|---|---|---|
| Crash logs | Yes | No | Analytics (diagnostics) | No | Via Sentry; PII + location scrubbed. |
| Diagnostics | Yes | No | Analytics (diagnostics) | No | Via Sentry. |

### Device or other IDs
| Type | Collected | Shared | Purpose(s) | Optional? | Note |
|---|---|---|---|---|---|
| Device or other IDs | Yes | No | App functionality | No | FCM push token, for notification delivery. |

---

## Section 2 — Data **not** collected (declare absent if asked)

- **Advertising ID** — not used (no ads, no ad SDKs).
- **Contacts / Calendar / SMS / Call logs** — not accessed.
- **Health & fitness, web browsing history** — not collected.
- **Payment card numbers** — never touch our servers (Stripe-hosted).

---

## Section 3 — Security practices (declare)

- ✅ Data is encrypted in transit.
- ✅ Users can request data deletion.
- ✅ (Mention in policy) On-device tokens encrypted at rest in the OS keystore.
- Committed to the Play Families policy: N/A (not child-directed).

---

## Section 4 — Permissions declared in the manifest (for cross-check)

From `apps/mobile/android/app/src/main/AndroidManifest.xml`:

- `INTERNET` — networking
- `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` — map presence/discovery (this is why
  **precise location** must be addressed on the form)
- `POST_NOTIFICATIONS` — push notifications
- `VIBRATE` — notification haptics

There is **no** background-location permission, so no background-location declaration or
prominent-disclosure video is required. Keep it that way unless background presence is
added later (that would trigger Play's background-location review).

---

## Recommended follow-up (removes the precise-location declaration)

Today `MapScreen.tsx` calls `sendPresence({ location: myCoords })` with raw GPS, and the
backend fuzzes on receipt (`presence.service.ts`). If you instead fuzz on the client
(`fuzzLocation(myCoords, 10)` from `@g88/shared`) **before** emitting `presence:update`,
precise GPS never leaves the device, the stored result is identical (server re-fuzz is
idempotent), and you can honestly declare **approximate location only**. Small change,
strictly stronger privacy posture, simpler Data Safety story.

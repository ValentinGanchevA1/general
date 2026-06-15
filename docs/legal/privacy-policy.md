# G88 Privacy Policy

**Effective date:** 2026-06-15
**Last updated:** 2026-06-15

> ⚠️ **Draft for owner/legal review.** This is an engineering-accurate draft built from
> the actual data flows in the codebase (see `ARCHITECTURE.md §3.3`, the modules table in
> `CLAUDE.md`). It is **not** legal advice. Before publishing, replace the placeholders
> (`[Controller name]`, `[support email]`, `[jurisdiction]`) and have it reviewed. Host it
> at a stable public URL — the URL is **required** by the Google Play Console and the
> Data Safety form. See "Hosting" at the bottom.

G88 ("G88", "we", "us") operates the G88 mobile application (the "App"), a map-first,
location-based social platform. This policy explains what we collect, why, how we share
it, and the choices you have.

The data controller is **[Controller name]**, contactable at **[support email]**.

---

## 1. Summary (the short version)

- G88 shows people, events, and listings near you on a live map. To do that we need your
  **location**, a **profile**, and basic **account** details.
- **We deliberately blur your location.** Your exact GPS coordinates are **never stored**
  in our database — on receipt they are reduced to the center of an ~120-meter grid cell
  (H3 resolution 10) before anything is written. Other users only ever see the blurred
  position. (See §3.)
- We use a small number of well-known service providers (Google, AWS, Stripe, Twilio,
  Firebase, Sentry) to run the App. We do **not** sell your data.
- You can edit your profile, control push notifications per channel, and request deletion
  of your account at any time.

---

## 2. Information we collect

### 2.1 You provide directly

| Data | When | Purpose |
|---|---|---|
| Email address + password | Email sign-up / login | Authentication |
| Google account profile (name, email, avatar) | "Sign in with Google" | Authentication |
| Display name, profile fields, bio | Profile creation / edit | Your public profile |
| Profile + gallery photos (up to 6) | Photo upload | Your public profile |
| Phone number | Optional phone verification | Anti-fraud / verified badge (via Twilio) |
| Selfie + government ID image | Optional ID verification | Verified badge (manual review; via AWS S3) |
| Messages and waves | Chatting / interacting | Delivering your messages |
| Posts: alerts, events, listings, gifts | Using those features | Delivering that content to nearby users |
| Payment details | Subscribing | Processed **entirely by Stripe** — we never receive or store your card number |

### 2.2 Collected automatically

| Data | Purpose |
|---|---|
| **Location** (device GPS) | Placing you on the map and finding nearby people/content. **Transmitted to our server, then immediately blurred to ~120m before storage** (see §3). |
| Device push token (FCM) | Sending push notifications |
| Approximate map viewport | Returning only the entities visible in your current map view |
| Crash logs & diagnostics | Stability and debugging (via Sentry, with personal identifiers and location scrubbed before sending) |
| In-app activity (e.g. waves sent, screens used) | Core features and product reliability. Client-side analytics are recorded only as Sentry breadcrumbs with user ID, email, phone, tokens, and coordinates **redacted** before they leave the device. |

We do **not** use advertising identifiers and do **not** run third-party ad networks.

---

## 3. How we protect your location (privacy invariant)

Location is the most sensitive thing G88 handles, so it gets specific treatment:

1. Your device sends your current coordinates to our server when you are active on the map.
2. **Before anything is written to the database**, the server reduces those coordinates to
   the centroid of an H3 resolution-10 cell — roughly a 120-meter hexagon. Your exact GPS
   point is discarded and never persisted.
3. Other users and the map only ever receive this blurred position. We never expose your
   precise coordinates to other users.
4. Location and authentication tokens are scrubbed from crash/diagnostic reports.

This means that even in the event of a database compromise, stored locations are
deliberately imprecise.

---

## 4. How we use your information

- Operate the core map experience (presence, discovery, nearby people/events/listings).
- Enable interactions: waves, chat, gifts, events (RSVP/polls/Q&A), listings (offers).
- Authenticate you and keep your account secure (rotating refresh tokens, optional phone
  and ID verification).
- Send notifications you have not opted out of (per-channel controls in-app).
- Process subscriptions (via Stripe).
- Maintain stability, debug crashes, and prevent abuse.

We rely on the following legal bases (where GDPR/UK GDPR applies): **performance of a
contract** (running the service you signed up for), **consent** (device location and push
notifications, which you can withdraw via OS settings), and **legitimate interests**
(security, abuse prevention, product reliability).

---

## 5. How we share information

We share data only with service providers ("processors") who act on our instructions to
operate the App. We do **not** sell personal data and do **not** share it with third
parties for their own marketing.

| Provider | What it processes | Why |
|---|---|---|
| Google (OAuth, Maps SDK, Firebase Cloud Messaging) | Sign-in tokens, map tiles, push tokens | Login, map rendering, push delivery |
| Amazon Web Services (S3) | Profile photos, verification images | Media storage |
| Stripe | Payment details, subscription status | Payment processing (PCI-compliant; we never see card numbers) |
| Twilio | Phone number | One-time-passcode phone verification |
| Sentry | Crash logs / diagnostics (PII + location scrubbed) | Error monitoring |
| Render + Supabase | Application data + database hosting | Running the backend |

Content you choose to publish (your profile, photos, posts, listings, events, messages to
recipients) is shared with the users you direct it to or with nearby users, by design.

We may also disclose information if required by law, to enforce our terms, or to protect
the rights and safety of users.

---

## 6. Data retention

- Account, profile, and content data are retained while your account is active.
- Refresh-token records are rotated and revoked on logout or token reuse.
- On account deletion we remove or anonymize your personal data, except where we must
  retain limited records for legal, security, or fraud-prevention purposes.

---

## 7. Your choices and rights

- **Edit/delete profile data** in-app at any time.
- **Notification controls**: per-channel push opt-outs in Settings (waves, messages, gifts,
  nearby, events, listings, digest).
- **Location**: revoke the location permission in your device settings — note the map
  experience will not function without it.
- **Account deletion**: request deletion via **[support email]** (or the in-app account
  deletion control, where available).
- Depending on where you live (e.g. EEA/UK, California), you may have rights to access,
  correct, delete, port, or object to processing of your personal data. Contact us at
  **[support email]** to exercise them.

---

## 8. Children

G88 is not directed to children under 13 (or the minimum age in your jurisdiction). We do
not knowingly collect data from them. If you believe a child has provided us data, contact
**[support email]** and we will delete it.

---

## 9. Security

Data is encrypted in transit (TLS/HTTPS). On your device, authentication tokens are stored
encrypted in the OS secure store (Android Keystore / iOS Keychain). Location is blurred
before storage (§3), and personal identifiers are scrubbed from diagnostic reports.

No system is perfectly secure, but we apply industry-standard safeguards appropriate to the
sensitivity of the data.

---

## 10. International transfers

Our providers may process data in regions including the EU and the US. Where required, we
rely on appropriate safeguards (e.g. Standard Contractual Clauses) for cross-border
transfers.

---

## 11. Changes to this policy

We may update this policy. Material changes will be reflected by the "Last updated" date
and, where appropriate, an in-app notice.

---

## 12. Contact

Questions or requests: **[support email]**
Controller: **[Controller name]**, **[jurisdiction]**

---

### Hosting (owner action — required before Play submission)

The Play Console needs a **public HTTPS URL** for this policy. Options:

- **GitHub Pages** (free, fast): enable Pages on this repo and serve `docs/`, giving e.g.
  `https://<user>.github.io/g88/legal/privacy-policy`. Convert this Markdown to HTML or
  enable a Markdown theme.
- **A page under `g88.app`** (the API domain already exists): host a static
  `https://g88.app/privacy` page.
- A free doc host (e.g. a public Notion/Google Site page) for the beta, replaced later.

Use the final URL in both the **store listing** and the **Data Safety form**.

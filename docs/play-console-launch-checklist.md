# G88 — Play Console beta launch checklist

> **Scope:** the owner-side Google Play Console steps to get G88 into **closed testing**.
> All engineering prep is done (signed AAB, CI secrets, privacy policy, store copy,
> account deletion). This is the click-by-click for the parts only the account owner can do.
> Background + rationale: `DEPLOY.md` → "Mobile release". Paste-ready copy:
> `docs/play-store-listing.md` and `docs/play-release-notes.md`.

Work top to bottom. Est. ~1 hour (+ a few hours for the first review).

---

## 0. Before you start — have these open
- [ ] Google account you'll use as the **Play developer** (personal or org).
- [ ] **Google Cloud Console** project that owns `GOOGLE_MAPS_API_KEY_RELEASE` (for step 4).
- [ ] `docs/play-store-listing.md` (name, short/full description, Data-Safety answers).
- [ ] `docs/play-release-notes.md` (release notes).
- [ ] Privacy policy URL: `https://g88-legal.onrender.com/privacy` (verify it loads).
- [ ] Tester email addresses (a Google Group or a plain list of Gmail accounts).

---

## 1. Register the developer account ($25)
- [ ] Go to https://play.google.com/console → **Create account** → choose **Personal** (or Org).
- [ ] Pay the **$25** one-time fee. (Personal accounts created recently may require the
      "20 testers for 14 days" closed-test step before production — fine for beta.)

## 2. Create the app
- [ ] Play Console → **Create app**.
  - App name: **G88** (or your store name from `play-store-listing.md`).
  - Default language, **App**, **Free**.
  - Accept declarations → **Create app**.
- [ ] Confirm the package will be **`com.g88`** (it's set when you upload the AAB in step 5;
      nothing to type here, but don't create a different package).

## 3. Turn on Play App Signing + create the closed track
- [ ] **Test and release → Testing → Closed testing → Create track** (name e.g. `beta`).
- [ ] **Testers** tab → add your Google Group or email list → **Save**.
- [ ] Play App Signing is **on by default** for new apps (Google holds the signing key; our
      `upload.keystore` is only the *upload* key). You'll confirm the signing cert in step 4.

## 4. ⚠️ Maps SHA-1 — do this or testers get a BLANK/GREY MAP
Play **re-signs** every download with Google's **App signing key**, so the cert testers run is
*not* your upload key or debug key. The Maps release key must allow that App-signing SHA-1.

- [ ] **Get the SHA-1:** Play Console → app **G88** → **Test and release → Setup → App
      integrity → App signing** → copy the **App signing key certificate → SHA-1**.
      *(Also copy the **Upload key certificate** SHA-1 while you're here — used below.)*
- [ ] **Apply it:** Google Cloud Console → **APIs & Services → Credentials** → open the key
      behind `GOOGLE_MAPS_API_KEY_RELEASE`:
  - **Application restrictions** = **Android apps**
  - **API restrictions** = **Maps SDK for Android**
  - **Add** row: package name `com.g88` + the **App signing** SHA-1.
  - **Add a second** row: package `com.g88` + the **Upload key** SHA-1 (so a sideloaded
    upload-signed AAB also renders the map).
  - **Save** (can take a few minutes to propagate).
- [ ] Leave `GOOGLE_MAPS_API_KEY_DEBUG` alone — it's the separate local/emulator key.

## 5. Upload the first AAB (must be manual)
The signed AAB is already built by CI; the Play API can't create the app or seed an empty
track, so the **first** release is by hand.
- [ ] **GitHub → Actions → "Android Release (AAB)" → Run workflow** to produce a fresh build
      (or reuse an existing run). Download the **`g88-release-aab`** artifact.
- [ ] Play Console → **Closed testing → your track → Create new release**.
- [ ] **Upload** the `.aab`.
- [ ] **Release notes:** paste from `docs/play-release-notes.md`.
- [ ] **Save → Review release → Start rollout to Closed testing.**

## 6. Complete the store listing + Data Safety (required to go live)
From `docs/play-store-listing.md`:
- [ ] **Store presence → Main store listing:** app name, **short description**, **full
      description**, **app icon**, **feature graphic**, phone **screenshots**.
- [ ] **Policy → App content → Privacy policy:** paste `https://g88-legal.onrender.com/privacy`.
- [ ] **Policy → App content → Data safety:** answer per `play-store-listing.md`. Key points:
  - Collects **Location (approximate)** — note: fuzzed to ~120 m server-side (`ARCHITECTURE.md §3.3`).
  - Collects **account info** (email/name).
  - Data **encrypted in transit**: Yes.
  - **Users can request deletion:** **Yes — in-app** (Settings → Delete account, `DELETE /users/me`).
- [ ] Finish the rest of **App content** (ads = No, content rating questionnaire, target
      audience, news = No, data safety **Submit**).

## 7. Ship to testers
- [ ] Once the release is reviewed/approved, copy the **closed-testing opt-in URL**
      (Closed testing track → Testers → "Copy link") and send it to testers.
- [ ] **Smoke test on a real device:** install from the link, sign in, open the **map**
      (confirms step 4), send a wave, open Marketplace.

---

## After first upload — enable auto-publish (optional)
Lets future `android-release.yml` runs push to Play automatically.
- [ ] Google Cloud Console (Play-linked project) → create a **service account** (no GCP roles) → **JSON key**.
- [ ] Play Console → **Users and permissions → Invite new user** → add the service-account
      email → grant app access to `com.g88` with **Release → Manage testing track releases**.
- [ ] `gh secret set PLAY_SERVICE_ACCOUNT_JSON < service-account.json` — the publish step then
      activates automatically on the next run.

---

## Non-blocking (do later, not gating beta)
- [ ] On-device check of the **P3.7 Marketplace listing thumbnail** (couldn't capture on the
      emulator — verify on a real device; feature is API-verified).
- [ ] Live-verify **Twilio OTP** and **Stripe** checkout→webhook (still test mode).
- [ ] iOS/TestFlight — deferred (no `ios/` native project; needs macOS).

## Common gotchas
- **Grey map for testers** → step 4 SHA-1 missing/wrong, or not propagated. `adb logcat | grep -i Authorization`
  on the device echoes the SHA-1 + `com.g88` it presented — compare to the key's restriction.
- **"Upload key" vs "App signing key"** — the upload key (our keystore) is what *you* sign with;
  Google's App signing key is what *ships*. Maps must trust the App signing SHA-1 above all.
- **Lost upload key** → recoverable via Play upload-key reset; **never** lose access to the
  Play account itself.
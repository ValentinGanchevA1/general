# Play closed testing — go / no-go

**Package:** `com.g88`  
**Display name:** G88  
**targetSdk:** 36 · **minSdk:** 24  
**versionName (About):** 1.0.0 · **gradle versionName:** 1.0 · **versionCode:** CI `github.run_number`  
**AAB workflow:** `.github/workflows/android-release.yml` (`workflow_dispatch` + `v*` tags)

## Verdict: **CONDITIONAL GO** for closed testing

Ship is viable for a small closed track **after** the ops checklist below. Not production-ready.

### GO (already in repo)

| Item | Status |
|------|--------|
| applicationId / namespace `com.g88` | OK |
| Signed AAB pipeline (upload keystore secrets) | OK (workflow present) |
| versionCodeOverride via run number | OK (Play rejects duplicates) |
| targetSdk 36 | OK |
| Location + notification permission declarations | OK |
| In-app Privacy screen + hosted policy URL | OK — `https://g88-legal.onrender.com/privacy` |
| Auth legal links (Terms + Privacy) | Present |

### NO-GO / blockers before first closed upload

| # | Blocker | Owner action |
|---|---------|--------------|
| 1 | **Play Console app must exist** and first AAB uploaded manually | Create app `G88`, package `com.g88` |
| 2 | **Secrets on GitHub** | `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, store alias/password secrets as wired in workflow |
| 3 | **Play Data safety form** | Location (approx), photos/video, personal info, messages — declare collection + purposes |
| 4 | **Store listing assets** | Feature graphic, icon 512, phone screenshots ≥2, short + full description |
| 5 | **Privacy policy URL live** | Confirm `g88-legal.onrender.com/privacy` returns 200 publicly |
| 6 | **Terms URL is privacy reuse** | Soft: Play accepts a policy URL; dedicate `/terms` before production |
| 7 | **Migration 0046 on Render** | Dating columns must exist before testers use Dating filter |
| 8 | **Content rating questionnaire** | Complete in Play Console |
| 9 | **Closed testers list** | Email list or Google Group on the track |

### Build command (local parity)

```bash
cd apps/mobile
# requires upload keystore env as in workflow
./android/gradlew -p android bundleRelease -PversionCodeOverride=1
# output: android/app/build/outputs/bundle/release/app-release.aab
```

### CI path

1. Ensure upload keystore secrets are set  
2. Actions → **Android Release (AAB)** → Run workflow  
3. Download AAB artifact (or auto-publish if `PLAY_SERVICE_ACCOUNT_JSON` set)  
4. Play Console → Testing → closed track → upload  

### Residual product risk for testers

- Dating empty nudge ships with this PR; hard gates need 0046 applied  
- Terms page still points at privacy host  
- No production crash reporting gate documented here  

**Decision:** closed testing **GO** once blockers 1–5 + 7–9 are checked; production stays **NO-GO** until Terms + Data safety + rating + broader QA.

# NEXA Play closed testing — go / no-go

**Public display name:** NEXA  
**Android package / applicationId:** `com.g88` *(compatibility identifier; intentionally unchanged)*  
**targetSdk:** 36 · **minSdk:** 24  
**versionName (About):** 1.0.0 · **gradle versionName:** 1.0 · **versionCode:** CI `github.run_number`  
**AAB workflow:** `.github/workflows/android-release.yml` (`workflow_dispatch` + `v*` tags)

## Verdict: **CONDITIONAL GO** for closed testing

The product is suitable for a small closed track after the operational and
on-device QA gates below. Public production rollout remains a separate decision.

The current app still routes **Terms of Service** to the Privacy Policy URL.
That temporary state may be tolerated only during internal/closed testing while
issue #592 is under legal review. It is a **P1 production release blocker**.

## Already in repo

| Item | Status |
|---|---|
| Public mobile identity | **NEXA** |
| applicationId / namespace `com.g88` | Retained intentionally for compatibility |
| Signed AAB pipeline | Workflow present; requires release secrets |
| versionCode override | CI run number |
| targetSdk 36 | OK |
| Foreground location + notification declarations | Present |
| In-app Privacy screen | Present |
| Hosted privacy URL | `https://g88-legal.onrender.com/privacy` *(legacy host name; public copy is NEXA-branded)* |
| Auth legal links | Present; Terms remains temporarily routed to Privacy until #592 |
| In-app account deletion | Present — Settings → Delete account |
| NEXA Visual System v2 | Merged |
| NEXA launch / spatial handoff v3 | Merged |
| Final entity grammar | Person=circle · Event=four-point star · Listing=square · Opportunity/other=diamond |

## Blocking gates before closed-track rollout

| # | Gate | Required action |
|---|---|---|
| 1 | **Play Console identity** | Create/configure app as **NEXA** while keeping package `com.g88` |
| 2 | **Release signing secrets** | Confirm upload keystore alias/password secrets and `ANDROID_UPLOAD_KEYSTORE_BASE64` are configured |
| 3 | **Data Safety** | Complete from current architecture/policy; do not infer from branding docs alone |
| 4 | **Store listing assets** | NEXA feature graphic, 512×512 icon, ≥2 current phone screenshots, short + full description |
| 5 | **Privacy policy** | Confirm hosted policy is public, current, and visibly NEXA-branded |
| 6 | **Terms / #592** | Closed testing may continue while reviewed. **Production NO-GO** until a dedicated NEXA `/terms` document is live and `TERMS_OF_SERVICE_URL` no longer points to `/privacy` |
| 7 | **Backend migrations / production env** | Confirm all migrations required by enabled tester features are applied |
| 8 | **Content rating / target audience** | Complete Play Console declarations truthfully |
| 9 | **Closed tester access** | Configure email list or Google Group and opt-in link |
| 10 | **Physical-device visual QA** | Complete issue #580 on a real Android device using the exact current release build |

## Release build parity

```bash
cd apps/mobile
./android/gradlew -p android bundleRelease -PversionCodeOverride=1
# android/app/build/outputs/bundle/release/app-release.aab
```

## CI / Play path

1. Confirm release signing secrets.
2. Run **Android Release (AAB)**.
3. Verify build, signing and embedded JS bundle checks pass.
4. Download the AAB artifact or publish through the configured Play service account.
5. Upload/promote only to the intended closed-testing track.
6. Complete Play Console Data Safety, content rating, app access and listing assets.
7. Run issue #580 against the exact release candidate on a physical Android device.
8. Before any production rollout, resolve #592 and verify Privacy and Terms as separate public documents from a non-authenticated browser.

## NEXA-specific device sign-off

Do not treat CI success as visual sign-off. The exact release candidate must be
checked for:

- native dark launch → NEXA eye/light-streak animation → spatial handoff with no white flash;
- logged-out and incomplete-profile cold starts do not show the map halo;
- Reduced Motion behavior;
- Map / Discover / Pulse / Connections / You canonical navigation;
- person circle / event star / listing square / opportunity diamond identity where applicable;
- light / dark / system / PROTOS NEXUS theme behavior;
- no visible legacy `G88` product branding;
- no public numeric trust/popularity score or trust-booster language;
- privacy-safe map presence and no exact-coordinate exposure;
- TalkBack, larger text and 44dp interaction targets.

## Current residual risk

- Physical-device launch timing / optical centering cannot be signed off from source or APK inspection alone.
- Play Store screenshots and feature graphics must reflect the current NEXA UI, not legacy G88 screens.
- **#592 remains a P1 production blocker:** the control labeled `Terms of Service` must not ship to production while it resolves to Privacy Policy content.
- The technical identifiers `com.g88`, `@g88/*`, storage keys and legacy service host names are **not** reasons to block the visual migration; renaming them is a separate compatibility project.

**Decision:** closed testing becomes **GO** only after the Play operational gates and
issue #580 physical-device pass are complete. Production remains **NO-GO** until
#592 is resolved, legal/store declarations match the production build, and broader
release QA is complete.

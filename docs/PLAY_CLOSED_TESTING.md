# NEXUS Play closed testing — go / no-go

**Public display name:** NEXUS  
**Android package / applicationId:** `com.g88` *(compatibility identifier; intentionally unchanged)*  
**targetSdk:** 36 · **minSdk:** 24  
**versionName (About):** 1.0.0 · **gradle versionName:** 1.0.0 · **versionCode:** CI `github.run_number`  
**AAB workflow:** `.github/workflows/android-release.yml` (`workflow_dispatch` + `v*` tags)

**AAB upload safety (PR #1072):** `v*` tag pushes **build only** even if the Play service-account secret exists. Upload requires a human-triggered `workflow_dispatch` run with `publish=true` and available `PLAY_SERVICE_ACCOUNT_JSON`. Default `publish=false` creates an AAB artifact without changing Play. The workflow verifies an actual JAR signature and rejects Android Debug certificates, but you must still compare the actual upload certificate SHA-256 against **Play Console → App integrity** before any rollout. Do not use automated publishing merely to finish the Play setup checklist.

## Verdict: **CONDITIONAL GO** for closed testing

The product is suitable for a small closed track after the operational and
on-device QA gates below. Public production rollout remains a separate decision.

The current app still routes **Terms of Service** to the Privacy Policy URL.
That temporary state may be tolerated only during internal/closed testing while
issue #592 is under legal review. It is a **P1 production release blocker**.

## Already in repo

| Item | Status |
|---|---|
| Public mobile identity | **NEXUS** |
| applicationId / namespace `com.g88` | Retained intentionally for compatibility |
| Signed AAB pipeline | Workflow present; requires release secrets |
| versionCode override | CI run number |
| targetSdk 36 | OK |
| Foreground location + notification declarations | Present |
| In-app Privacy screen | Present |
| Hosted privacy URL | `https://g88-legal.onrender.com/privacy` *(legacy host name; public copy is NEXUS-branded)* |
| Auth legal links | Present; Terms remains temporarily routed to Privacy until #592 |
| In-app account deletion | Present — Settings → Delete account |
| NEXUS Visual System v2 | Merged |
| NEXUS launch / spatial handoff v3 | Merged |
| Final entity grammar | Person=circle · Event=four-point star · Listing=square · Opportunity/other=diamond |

## Blocking gates before closed-track rollout

| # | Gate | Required action |
|---|---|---|
| 1 | **Play Console identity** | Create/configure app as **NEXUS** while keeping package `com.g88` |
| 2 | **Release signing secrets** | Confirm upload keystore alias/password secrets and `ANDROID_UPLOAD_KEYSTORE_BASE64` are configured |
| 3 | **Data Safety** | Complete from current architecture/policy; do not infer from branding docs alone |
| 4 | **Store listing assets** | NEXUS feature graphic, 512×512 icon, ≥2 current phone screenshots, short + full description |
| 5 | **Privacy policy** | Confirm hosted policy is public, current, and visibly NEXUS-branded |
| 6 | **Terms / #592** | Closed testing may continue while reviewed. **Production NO-GO** until a dedicated NEXUS `/terms` document is live and `TERMS_OF_SERVICE_URL` no longer points to `/privacy` |
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

## NEXUS-specific device sign-off

Do not treat CI success as visual sign-off. The exact release candidate must be
checked for:

- native dark launch → NEXUS eye/light-streak animation → spatial handoff with no white flash;
- logged-out and incomplete-profile cold starts do not show the map halo;
- Reduced Motion behavior;
- Current mobile navigation v3: Map / Experiences / Opportunities / Connections / Identity; Experiences and Opportunities are Map lenses, not separate maps; legacy Discover/Pulse/You routes remain hidden for compatibility;
- person circle / event star / listing square / opportunity diamond identity where applicable;
- light / dark / system / PROTOS NEXUS theme behavior;
- no visible legacy `G88` product branding;
- no public numeric trust/popularity score or trust-booster language;
- privacy-safe map presence and no exact-coordinate exposure;
- TalkBack, larger text and 44dp interaction targets.

> **Navigation QA baseline note (2026-11-05):** Issue #580 documents the older, frozen RC3 navigation baseline (Map / Discover / Pulse / Connections / You). For any new Android v3 APK, follow [the v3 device regression matrix](IA_NAVIGATION.md) and record the exact build run, commit SHA, APK SHA-256, Android version and device evidence. Passing the RC3 checklist alone does not sign off navigation v3.

## Current residual risk

- Physical-device launch timing / optical centering cannot be signed off from source or APK inspection alone.
- Play Store screenshots and feature graphics must reflect the current NEXUS UI, not legacy G88 screens.
- **#592 remains a P1 production blocker:** the control labeled `Terms of Service` must not ship to production while it resolves to Privacy Policy content.
- The technical identifiers `com.g88`, `@g88/*`, storage keys and legacy service host names are **not** reasons to block the visual migration; renaming them is a separate compatibility project.

**Decision:** closed testing becomes **GO** only after the Play operational gates and
issue #580 physical-device pass are complete. Production remains **NO-GO** until
#592 is resolved, legal/store declarations match the production build, and broader
release QA is complete.

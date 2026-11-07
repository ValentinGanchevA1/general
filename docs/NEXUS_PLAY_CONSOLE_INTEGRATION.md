# NEXUS — Google Play API / GitHub Actions integration

**Scope:** GitHub repo `ValentinGanchevA1/general`, Android `com.g88`; public identity **NEXUS**.
**Safety:** no automatic Play uploads from commits/tags, no production track, and no credentials in Git history.

## What these workflows do

| Workflow | Trigger | Effect |
|---|---|---|
| `.github/workflows/nexus-play-listing.yml` | PR | Validates en-US/bg-BG JSON offline; no Google access |
| Same workflow, `workflow_dispatch` with `apply=false` | Manual | Validates only |
| Same workflow, `workflow_dispatch` with `apply=true` on **master** | Manual, `play-testing` environment gate | Patches en-US/bg-BG Play Store listing and commits an edit; may become visible after Play review |
| `.github/workflows/android-release.yml`, `v*` tag | Automatic | Builds signed AAB **artifact only**, never uploads to Play |
| Same Android workflow, `publish=false` | Manual | Builds signed AAB artifact only |
| Same Android workflow, `publish=true` on **master** | Manual, `play-testing` environment gate | Builds AAB and uploads only to `internal` or `alpha` (testing); never production |

**Warning:** Applying a store listing commits metadata changes to Play; it is not a dry-run. Uploading a test AAB to a track is likewise an external write. Neither operation is triggered by a PR merge or tag push. Google may require review. No workflow creates a production rollout.

## One-time owner-side setup (do NOT paste credentials in chat)

1. In Google Cloud Console, create/select a Cloud project, enable **Google Play Developer API**, and create a dedicated service account.
2. In Google Play Console → Users and permissions, invite/authorize the service-account email for the **NEXUS / com.g88** application. Grant only the necessary app-level permissions for **store presence** and **releasing to testing tracks**. Never grant production release rights or developer-account administration.
3. Play Developer API requires an existing application that has already had its **first APK/AAB uploaded manually via Play Console**. Confirm bootstrap and the actual testing track before trying API writes.
4. In GitHub → repository Settings → Environments, create environment **`play-testing`**. Set required reviewers and restrict deployment branches to `master`. Require human approval before any write job proceeds. *Creating an environment in workflow YAML does NOT automatically configure these protection rules.*
5. Add a secret **`PLAY_SERVICE_ACCOUNT_JSON`** (the complete JSON of the dedicated service account), preferably as an environment secret scoped to `play-testing`. Never commit JSON or print credentials in logs. Existing Android signing secrets remain separate.
6. Confirm whether the selected test track is actually `internal` or legacy `alpha` in Play Console. This pipeline deliberately rejects arbitrary track IDs, `beta`, and `production`; extending the allowlist requires another reviewed PR.
7. Verify NEXUS name, `com.g88`, release certificate, upload key SHA-1, signing, AAB versionCode, tester access and Play policy declarations before any first test upload.

## Store listing usage

Edit the two reviewed files:
- `play-console/listings/en-US.json`
- `play-console/listings/bg-BG.json`

```bash
node --test scripts/play-console/sync-listing.test.mjs
node scripts/play-console/sync-listing.mjs
```

Review PR checks. After merging, start **NEXUS Play Store listing** on `master` with `apply=false` for an offline preview; only select `apply=true` after reviewing text and the `play-testing` approval. Script hardcodes `com.g88`, validates exact NEXUS branding and Play text-length limits, and changes **only** the two listing locales (not graphics, privacy, account verification, Data Safety or test tracks).

## Test AAB usage

Open **Android Release (AAB)** on `master`. Select `publish=false` first. After the AAB build succeeds, inspect artifact `g88-release-aab`, its package/version/signing and physical-device QA. To explicitly upload to a test track, rerun manually with `publish=true`, choose **`internal`** or **`alpha`**, and approve the `play-testing` environment gate. This creates a fresh bundle/versionCode; it does **not** promote an earlier artifact.

The workflow reuses existing signing and `whatsnew-en-US` / `whatsnew-bg-BG` release notes. Be sure they accurately describe the exact release candidate.

## Important release blockers (not solved by API automation)

- Phone/developer verification, review credentials, Data Safety, content rating, testing groups and opt-in link: verify in Play Console.
- At least two genuine current-device screenshots, approved graphics, live privacy and external deletion URLs.
- Dedicated legal-reviewed Terms of Service (issue #592) and physical-device QA before any public production release.
- Service-account privilege, API connectivity and the first accepted test upload are **unverified** until successfully tested. 
- Production rollout remains a separate, owner-approved process outside this integration.

Official docs: https://developers.google.com/android-publisher/getting_started and https://developers.google.com/android-publisher/edits

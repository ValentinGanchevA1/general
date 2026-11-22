# NEXUS Worlds QA APK

## Purpose
Provide a manually triggered, short-retention APK artifact for physical testing of PR #1147. The QA gate is compile-time environment-only and must not be set in production release workflows.

## Guardrails
- Workflow is manual (`workflow_dispatch`) and does not publish GitHub Releases or tags.
- API host is required at run time. `api.g88.app`, localhost and loopback are blocked; only use an approved non-production QA/staging host.
- APK uses the existing Android package and upload signing key, so it can update the installed signed APK without uninstalling. This also means QA runs must use a test account and non-production API host.
- Artifact retention is five days.
- The QA gate is `NEXUS_WORLDS_QA=1`; normal Release workflow does not set it.
- No backend, database, permissions or production workflow changes.

## Run
1. Confirm a reachable staging API host and that staging is isolated from production.
2. Actions → Android Worlds QA APK → Run workflow.
3. Supply the staging host (not the production API).
4. Download the artifact only after workflow success.
5. Install on Huawei Nova 11 and run the acceptance tests below.

## Device acceptance
- QA-01 Fresh test account registration → profile setup → Worlds selector.
- QA-02 Activate a non-default World → portal → Main.
- QA-03 Force stop/relaunch → preference persists, selector does not recur.
- QA-04 Skip → NEXUS preference/session fallback.
- QA-05 Existing account with no first-run marker → Main.
- QA-06 Switch accounts → no preference/marker leakage.
- QA-07 Reduce Motion.
- QA-08 Light mode fallback and Dark accents.
- QA-09 TalkBack and enlarged font.
- QA-10 storage write/cleanup failure paths (unit tests/debug fixture; don't force destructive device storage actions).

## Caveats
- QA APK is still a Release-type APK and uses the existing app ID/signature; it is not a separate installable package.
- Validate the staging host is truly isolated before running. This workflow cannot independently verify the host's infrastructure or data isolation.
- Google Sign-In may require staging Firebase/Google OAuth configuration; if the supplied google-services file is production-only, OAuth behavior is not validated by this build.
- This Draft PR is configuration/code review only until the workflow is run successfully.

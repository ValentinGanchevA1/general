# NEXUS Google Play readiness review — 2026-11-26

## Decision

**Not approved for production submission or legal publication.** The Terms and Child Safety wording has been reviewed for product/Play consistency. It is not qualified legal approval, and the repository has no valid Terms approval record. Google Play declarations were not entered or submitted.

## Text review

### Terms of Service

The current source in `docs/legal/terms/index.html` covers adult eligibility, prohibited content and behavior, the UGC license, location sharing, user arrangements, reporting/blocking, enforcement, deletion/privacy, changes and operator contact. It is a useful product draft and has the elements needed to explain user-content rules. It is **not ready for publication or acceptance**:

- No reviewed candidate exists at `docs/legal-review/NEXUS_TERMS_CANDIDATE.html` and no `NEXUS_TERMS_APPROVAL.json` exists.
- The current HTML does not satisfy the fail-closed publication script: it lacks the `NEXUS_TERMS_VERSION` comment and `<time datetime>`; its H1 is `NEXUS Terms of Service` while the publication contract requires `Terms of Service`.
- The operator identity/address, governing law/consumer disclosures, content-license scope, appeals, retention/deletion and actual enforcement/age-gate claims still require qualified legal review and owner fact-checking.
- The publication guide says `/terms` stays unpublished until approval and the reviewed `--write` PR. The current source status says the live URL is 404; this environment's web viewer could not reach the Render host, so current public reachability remains unverified.

### Child Safety Standards

The current source in `docs/legal/child-safety/index.html` clearly prohibits CSAE/CSAM, states the adult-only intent, explains reporting and blocking, avoids promises of automatic detection/24-hour coverage/fixed response times, and names `vganchev6@gmail.com`. The text is **not ready for self-certification**:

- No legal/safety approval record or anonymous public reachability check is present.
- There is no evidenced staffed procedure for acting on actual knowledge of CSAM, lawful removal/access restriction, case ownership, evidence handling or required authority reporting.
- Delivery/monitoring of `vganchev6@gmail.com` and the Play developer-account contact match are unverified. The `g88.app` forwarding route is not confirmed.
- CS-01–CS-12 and a synthetic report-to-moderation run are not recorded as complete.

Google requires published CSAE standards, accessible in-app feedback, appropriate action on CSAM, legal compliance, and a child-safety point of contact. Social-category apps are in scope even when children are excluded from the target audience. Do not self-certify until the operational checks and legal review pass.

## Terms acceptance implementation on this branch

- Adds a consent screen after adult eligibility with the exact Terms version/hash, an unchecked affirmative checkbox and a Terms link.
- Adds a read-only continuation for users who decline, preserving report/block/account controls; the app surfaces a Terms reminder while UGC creation, upload, profile edits and message sending remain blocked by the server.
- Adds durable evidence containing account id, Terms version, SHA-256 and server timestamp only; no IP address or user agent is stored.
- Adds explicit opt-in enforcement (`NEXUS_REQUIRE_UGC_TERMS`) and fails closed if enabled with missing or conflicting version/hash configuration.
- Adds migration 0078 rather than reusing the `0072_ugc_terms_acceptance.sql` name present in the unverified owner-supplied history snapshot. This keeps filename-only migration tracking from silently treating the new schema as applied; history reconciliation remains blocking. The migration is unused until staged; the feature is not merged or deployed. Privacy/Data Safety wording must disclose the acceptance record before activation.

## Play Console status

No authenticated Google Play Console session or Console connector is available here. No form fields were submitted. The prepared field-by-field worksheet is `docs/play-console-submission-2026-11-26.md`.

Open declaration decisions include category/target audience, random-connection/minor-blocking classification for nearby discovery + spontaneous chat, content rating, child-safety contact, report/moderation evidence, Data Safety from the exact AAB and SDKs, account-deletion URL and app-access instructions.

## Android artifact and device evidence

- Reviewed latest master: `27b6ae22c95f84c0a16b3ee76b23549d68c37ab2` (NEXUS 1.0.1 RC2).
- Latest available signed AAB artifact is run `42953361471`, source commit `e6c6c50c6a7345e970217e3e785df03b2af5dafe`, artifact ZIP digest `sha256:a81c589da926c582e110887d4286cf0f1de83167684528a55c67bd6e18fe5c8f`. It is stale relative to current master.
- The connected Huawei FOA-L29 is reachable by ADB. Installed `com.g88` is a package-installer sideload, version `1.0.0`, versionCode `2555`, last updated 26 Nov. It is not proof of installing the current signed AAB.
- No current-master AAB was available, and the connected GitHub integration exposes read-only workflow inspection rather than dispatch. `gh` CLI is absent. No AAB/device QA was claimed.

## Release gates

1. Qualified legal/safety review, product-owner fact approval and exact immutable approval hashes for Terms and Child Safety.
2. Follow the repository Terms publication guide, publish only through a reviewed PR and verify anonymous HTTPS contents and digest.
3. Verify the child-safety mailbox, backup coverage, report-to-moderation path, CSAM handling and applicable reporting procedure.
4. Merge/stage migration 0078 and deploy the backend API before the mobile build; run acceptance, stale-version, direct HTTP/WebSocket bypass, report, block and account deletion tests.
5. Update Privacy/Data Safety and complete truthful Console declarations against the exact signed AAB and deployed configuration.
6. Produce a current signed AAB, compare its version/signing with Play Console, install the AAB-derived build or Play-installed release on the connected device, and capture QA evidence.
7. Keep production NO-GO until the legal text, public URLs, backend, Data Safety answers, Console declarations and exact device-tested AAB agree.

## Official policy references

- User-generated content: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en
- Child Safety Standards: https://support.google.com/googleplay/android-developer/answer/14747720?hl=en
- Age-restricted functionality: https://support.google.com/googleplay/android-developer/answer/16302250?hl=en
- Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
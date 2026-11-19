# NEXUS Child Safety Standards — approval and publication gate (19 November 2026)

## State: REVIEW ONLY / NO PUBLICATION

- Candidate file on this **draft PR branch**: `docs/legal/child-safety/index.html`.
- The Render static service `g88-legal` uses `master`, auto-deploy enabled, publish path `docs/legal`.
- **Do not merge this PR** until a qualified legal/safety reviewer validates the policy and the release owner verifies operational readiness.
- The HTML includes a prominent REVIEW CANDIDATE notice and `noindex,nofollow`, deliberately preventing accidental representation as an approved policy.
- Target URL **only after approved merge and deploy**: https://g88-legal.onrender.com/child-safety/ .
- Existing public contact `vganchev6@gmail.com` comes from the repository Privacy Policy; owner elected to use the **developer-account email** for Google Play. Check which mailbox that is and its monitoring setup; do not assume equality.

## Owner designation (confirmed in conversation, 19 November 2026)

- [x] Valentin Ganchev accepts responsibility as **NEXUS Owner & Child Safety Contact** for receiving, reviewing and handling CSAE/CSAM reports and escalating to competent authorities where legally required.
- [x] Owner chose the **Google Play developer-account email** as the Play child-safety contact.
- [x] Owner confirmed (19 November 2026) that they have access to this mailbox and check it regularly. **Self-attestation only**; not an independent inbox test.
- [ ] Verify the exact developer-account email address and successfully deliver a test Child Safety message; record timestamp and receipt without publishing the address until confirmed.
- [ ] Validate lawful reporting channels, safe handling, escalation ownership and ability to take moderation action in production. Owner designation is **not** legal sign-off, proof of staffed moderation, or permission to self-certify.

## Before final approval

1. Review the exact HTML text, jurisdiction-specific child-safety obligations for the EU/Bulgaria, authority escalation/reporting workflow, evidence preservation/deletion process, operator responsibilities, appeals, and safeguarding. Document reviewer, date, approved SHA and effective date.
2. Demonstrate that real reports from a signed release AAB reach the deployed API/admin queue; verify user/profile/content reports, admin authorization, invalid target/offline failures and blocking controls. Capture evidence. Do not declare features live based only on source code.
3. Demonstrate authorized CSAM case handling, priority assignment, operational response, content restriction/removal from map/feed/cache where applicable, law-enforcement escalation and documented records. Do not promise 24/7 coverage without staffing.
4. Confirm first-release 18+ enforcement (email, OAuth, existing users, REST, Socket.IO), Dating OFF, correct privacy/terms and Play Console settings.
5. Reconfirm that published external child-safety email, developer-account contact in Play Console, and in-app support reach an actively monitored responder.
6. Confirm the legal URL is publicly available globally without sign-in, renders actual final standards, has NEXUS branding and is not a PDF.

## Publication steps AFTER reviewer and owner sign-off

1. Update `docs/legal/child-safety/index.html` on this PR: remove draft banner, set real approved effective date and reviewer-approved content, replace `noindex,nofollow` with `index,follow`, remove all pending/unverified language while preserving only truthful claims.
2. Re-review the diff and approved content SHA; set the PR ready only when all gates are complete and recorded.
3. Merge the approved PR to `master`. This triggers `g88-legal` auto deploy. **No backend deployment/migration is required to publish this static page**.
4. Check Render deploy is live and fetch https://g88-legal.onrender.com/child-safety/ unauthenticated; verify HTTP 200, final text, effective date, links and mobile view.
5. Only after the real runtime safeguarding evidence exists, enter the verified URL and the developer-account contact email in the Google Play Child Safety Standards declaration. Self-certify the reporting/CSAM/legal items only if proven.

Related: #1071, #1068, #592, #580; `docs/qa/NEXUS_CHILD_SAFETY_RELEASE_GATE_2026-11-08.md`.
Official Google Play requirements: https://support.google.com/googleplay/android-developer/answer/14747720

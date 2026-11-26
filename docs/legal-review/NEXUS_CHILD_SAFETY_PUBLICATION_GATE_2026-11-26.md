# NEXUS Child Safety Standards — publication gate (26 November 2026)

**State: NO-GO for public publication and Play Console self-certification.**
**Publication target:** existing Render Static Site `g88-legal` only.
**No new website, service, Render resource, domain, or hosting target is to be created.**

## 1. Existing hosting design

The current repository review records that the existing Render static service `g88-legal`:
- deploys from GitHub `master`;
- auto-deploys on changes to that branch;
- publishes the repository's `docs/legal` directory;
- already serves the Privacy Policy at `https://g88-legal.onrender.com/privacy`.

The future Child Safety URL is:

`https://g88-legal.onrender.com/child-safety/`

It must be produced by `docs/legal/child-safety/index.html` only after approval. Do not create a separate Render service or website.

## 2. Repository safety boundary

This PR intentionally places the candidate outside the Render publish directory:

- Review candidate: `docs/legal-review/NEXUS_CHILD_SAFETY_STANDARDS_CANDIDATE_2026-11-26.html`
- Internal publication gate: this file
- Internal owner/legal evidence source: `docs/legal-review/NEXUS_RELEASE_OWNER_POLICY_REVIEW_2026-11-25.md`
- Public destination (not yet created on master): `docs/legal/child-safety/index.html`

Merging this review PR does **not** publish a Child Safety page. After all gates pass, create a separate reviewed publication PR that copies only the approved final HTML to the public destination. The final PR will trigger the existing `g88-legal` auto-deploy from master.

## 3. Current verified / source-reviewed state

### Product policy
- Brand: NEXUS.
- Intended first-release Social scope: 18+ across the whole Social app.
- Dating/matchmaking: OFF for the first release.
- NEXUS is intended to be a Social app; the adult-only target audience does not remove the Child Safety Standards work.
- The nearby-person discovery + Waves + spontaneous chat flow must be classified against Google's age-restricted/random-connection policy. Dating being OFF does not settle that classification.

### Reporting and moderation
The 25 Nov 2026 owner review records source-level implementation for:
- mobile reporting to authenticated `POST /api/v1/reports`;
- admin list and decision endpoints protected by JWT/AdminGuard.

Source code is not runtime proof. The exact signed AAB/API test matrix CS-01–CS-12 remains **NOT RUN**. In particular:
- a reviewed report does not itself establish account suspension;
- `hide_story` soft-deletes a Story, but caches/media copies may remain;
- automatic chat moderation and immediate media purge are not established;
- production queue access, case triage, action audit, and escalation have not been demonstrated.

Do not publish promises of 24/7 monitoring, fixed response SLAs, automatic CSAM detection, automatic account suspension, or immediate removal from every cache/device. The public page must describe only actions that are actually staffed, deployed, and tested.

### Child-safety contact and email
The 25 Nov owner review records:
- Valentin Ganchev accepted the NEXUS Owner & Child Safety Contact role.
- The Google Play developer-account mailbox was selected as the Play point of contact, but its exact address and successful test delivery are still unverified.
- Cloudflare destination `vganchev6@gmail.com` is verified.
- The forwarding rule `child-safety@g88.app → vganchev6@gmail.com` exists and is enabled.
- **Email Routing is not operational:** the `g88.app` zone is Pending, Email Routing is disabled/unconfigured, registrar nameserver delegation has not been completed, and no end-to-end message delivery test has passed.
- No nameserver, MX, SPF, or DKIM record was changed during that review.

Therefore:
- do not publish `child-safety@g88.app` as a working address;
- do not claim the developer-account email has been independently tested;
- do not treat an existing generic Privacy Policy contact as proof of a dedicated, monitored child-safety mailbox;
- verify delivery and actual monitoring before inserting any public child-safety address;
- document backup coverage and what happens when the primary contact is unavailable.

### Age controls and release proof
Current master includes server-authoritative age-eligibility code and the mobile eligibility bootstrap. This is source evidence only. Verify:
- production age-gate configuration and fail-closed behavior;
- new email signups, Google OAuth, legacy/DOB-null accounts, session restore and account switching;
- protected REST routes, Socket.IO, push, deep links, and map/chat access;
- exact signed AAB and deployed API;
- Play Console Target audience and any required Restrict Minor Access setting.

A self-entered DOB is not independent identity or age verification. Do not describe it as such.

## 4. Legal review requirements before publication

A qualified legal/safety reviewer must review the **exact final HTML bytes**, not only the Markdown draft, against:
- the operator/controller identity and ability to act;
- applicable Bulgaria/EU and other relevant child-safety obligations;
- reporting, authority escalation and evidence-handling procedures;
- moderation scope, actual action controls, appeal process and realistic coverage;
- age assurance and the exact Social/discovery/chat functionality;
- location, privacy, retention, deletion and Terms consistency;
- contact details, language, effective date, version, and accessible publication.

Record the reviewer identity/role, review date, approved version, effective date, exact SHA-256, and any required limitations. A product-owner review is not legal approval.

## 5. Required operational evidence

Before approval, attach redacted, synthetic-only evidence for:

1. Signed AAB build identity, SHA-256, device model/Android version, and deployed API commit.
2. In-app user and supported-UGC reporting delivered to the real API and moderation queue.
3. Offline and HTTP 500 behavior: no false success state.
4. Normal-user denial for admin moderation routes and successful authorized-admin queue triage.
5. Case decision and audit trail, with role-limited access.
6. Blocking/reporting behavior, cache/feed/map/realtime behavior after a test moderation action, and known removal limitations.
7. A tabletop incident exercise using a synthetic scenario only, covering urgency, assignment, containment, lawful escalation decision, secure record handling, and backup coverage.
8. 18+ and Dating-OFF behavior across the exact app/API.
9. A real, non-sensitive test email to the final contact address, with receipt timestamp and named monitoring owner.
10. No test may create, download, attach, copy, or circulate real or simulated CSAM imagery. Use text-only synthetic scenarios.

Do not test against production until a controlled environment and explicit release-owner authorization exist. Existing isolated staging is not yet a usable NEXUS staging backend: the 25 Nov review found no application schema/migration history, and a dedicated Render staging API is absent.

## 6. Final publication sequence — existing service only

1. Complete the operational evidence and contact verification above.
2. Obtain product-owner review, then qualified legal/safety approval of the exact HTML candidate.
3. Update the candidate with the approved contact, operator details, version, effective date, final appeal/reporting terms, and any legal revisions.
4. Compute SHA-256 over the exact final HTML bytes. Record approval metadata and content hash in the review record.
5. Create a **separate publication PR** that adds `docs/legal/child-safety/index.html` to the current master. That public-path file must have:
   - NEXUS branding and final title;
   - `meta robots=index,follow`;
   - no review banner, TODOs, placeholders, or unverified claims;
   - approved version and effective date;
   - working Privacy Policy link;
   - verified child-safety contact;
   - exact reviewed bytes matching the approval record.
6. Review the final diff and obtain explicit merge approval. Do not auto-merge.
7. Merge to `master`. This triggers the existing `g88-legal` Render static site; no new service or website is needed.
8. Verify the existing service's deploy is live, then verify anonymous HTTPS access to `/child-safety/` (HTTP 200, correct title/version/effective date/contact, Privacy link, desktop/mobile rendering, no draft/noindex marker).
9. Only then enter the exact URL and verified contact in Google Play Console. Complete each self-certification response only when the corresponding operational fact has evidence.

## 7. Current release decision

**NO-GO** for public Child Safety publication and Google Play self-certification because:
- qualified legal/safety approval is not recorded;
- CS-01–CS-12 runtime tests are not run on the exact signed AAB/API;
- production moderation/incident response and cache/removal behavior are not proven;
- Child Safety email routing and final Play contact have no successful end-to-end delivery evidence;
- backup/coverage and lawful escalation procedure remain to be verified.

This gate does not authorize production mutations, Render environment changes, DNS changes, Play Console declarations, or publication.

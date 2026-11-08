# NEXUS Terms — legal publication preparation (NO automatic publication)

This safeguards the step between the **unapproved** Terms preview (PR #1067)
and the public Render page served from `docs/legal/terms/index.html`.

## Current status
- PRs #1064 and #1065 are **already merged**. #1065 included only a legal review draft.
- PR #1067 contains Terms acceptance API, migration 0072 and a React Native
  affirmative consent modal, but requires an actual approved Terms URL.
- The preview has unresolved legal reviewer placeholders, especially general
  minimum age and minor safety (#1071), operator details and UGC licensing.
- **This guide does not establish that any Terms have been approved.**
- Never put the preview in Render's public `docs/legal` folder or announce an unapproved
  page as `https://g88-legal.onrender.com/terms`.

## From legal sign-off to a publication PR
1. Human legal reviewer settles all placeholders in the actual Terms. For launch,
   review **NEXUS 18+ across ALL Social for RC1; Dating disabled**. The backend REST/Socket adult gate and the Play Console Restrict Minor Access setting must be verified.
   Also verify Terms assertions against real app/backend behavior.
2. Put the **final** legal-reviewed HTML in
   `docs/legal-review/NEXUS_TERMS_CANDIDATE.html`. It must have:
   - NEXUS-branded `<title>NEXUS — Terms of Service</title>` and
     `<h1>Terms of Service</h1>`;
   - `<!-- NEXUS_TERMS_VERSION=YYYY-MM-SLUG -->` matching the release version;
   - `<time datetime="YYYY-MM-DD">` with the approved effective date;
   - separate Privacy Policy link;
   - no draft warning, TODO, [LEGAL...] placeholder or JavaScript;
   - public `<meta name="robots" content="index,follow">`.
3. Compute reviewed bytes' SHA-256 and have the real reviewer supply an approval
   record following `NEXUS_TERMS_APPROVAL.example.json`. Store it at
   `docs/legal-review/NEXUS_TERMS_APPROVAL.json`. Record the exact reviewer
   identity/role, date, content SHA-256 and version. **This file is a release
   control, not a cryptographic proof of legal qualifications or permission.**
4. Run from repo root:
   `node scripts/legal/prepare-approved-terms.mjs` — checks only.
5. After *independent* sign-off verification by the release owner, run:
   `NEXUS_TERMS_PUBLICATION_AUTHORIZED=YES node scripts/legal/prepare-approved-terms.mjs --write`.
   It writes `docs/legal/terms/index.html` only if all checks succeed. The
   output MUST go through a reviewed PR to master; never auto-merge to publish.
6. After merge, wait for Render g88-legal automatic deployment and verify the
   **public** `/terms` URL using an unauthenticated browser. Re-verify content,
   version, effective date and privacy link. Keep the earlier approved version
   archived securely.
7. Update mobile `TERMS_OF_SERVICE_URL` and confirm it is different from
   `PRIVACY_POLICY_URL`. Build the exact signed Android AAB.
8. Confirm backend migration 0072 has applied, and only **then** configure
   `NEXUS_TERMS_VERSION` and `NEXUS_TERMS_URL`. Enable
   `NEXUS_REQUIRE_UGC_TERMS=true` after real device acceptance QA, in that
   order. Do not turn it on merely because code merged.
9. Verify new user / existing user / Google OAuth / stale version consent;
   direct HTTP and WebSocket UGC bypass denial; ability to disable public map
   visibility, report abuse and delete account without acceptance.
10. Obtain explicit sign-off for release readiness and issue #592, plus Play
    Console Data Safety, account deletion and Social child-safety (#1071).

## Failure modes
- No approved HTML or matching approval metadata: **no file written**.
- SHA mismatch or remaining draft placeholders: **no file written**.
- Explicit --write flag omitted: only dry-run validation.
- No `NEXUS_TERMS_PUBLICATION_AUTHORIZED=YES`: **no file written**.
- Existing public Terms document: **never overwrite automatically**; use
  manual reviewed versioned update procedure.
- Code merged but legal URL not live: Terms enforcement remains **off**.

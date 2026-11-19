# NEXUS Terms of Service — counsel handoff and release decision register (19 November 2026)

> **NOT APPROVED · NOT FINAL TERMS · NOT FOR PUBLICATION OR USER ACCEPTANCE.**
> This is an internal review aid only. It does not authorize any GitHub merge, Render deploy,
> legal URL switch, activation of `NEXUS_REQUIRE_UGC_TERMS`, live database migration,
> Google Play change or release sign-off. Do not place this file in `docs/legal/`.
> Human counsel must assess the legal clauses and the product owner must independently
> verify the approval and exact reviewed HTML before publication.

## 1. Authoritative inputs and their limitations

| Source | What is supported | What it does **not** prove |
| --- | --- | --- |
| [Issue #592](https://github.com/ValentinGanchevA1/general/issues/592) | Dedicated Terms remains a P1 production-release blocker; approval, publication, URL, acceptance and device proof are required | No legal approval or public `/terms` availability |
| [Issue #1068](https://github.com/ValentinGanchevA1/general/issues/1068) | **Final owner decision, 8 Nov:** NEXUS Social is 18+ across the first release; Dating is OFF | No deployed email/OAuth/existing-user/REST/Socket.IO age enforcement |
| [Issue #1071](https://github.com/ValentinGanchevA1/general/issues/1071) | Social child-safety and Google Play evidence requirements persist despite adult-only scope | No published child-safety standards or staffed moderation proof |
| `docs/legal-review/NEXUS_TERMS_DRAFT_2026-11-07.md` | Existing 12-section working editorial Terms draft | Not lawyer-approved; unresolved operator, licence, moderation and consumer clauses |
| `docs/legal/privacy/index.html` | Source copy identifies operator/contact and explains coarsened public presence vs opt-in precise DM location | No independent verification of operator legal capacity, live URL, or deployed product behavior |
| [PR #1064](https://github.com/ValentinGanchevA1/general/pull/1064) | Merged source work for reporting flow, truthful precise-location disclosures and free-first-launch controls | No end-to-end proof on current signed AAB and production backend |
| [PR #1067](https://github.com/ValentinGanchevA1/general/pull/1067) | Unmerged versioned affirmative Terms acceptance, HTTP/Socket.IO UGC enforcement and mobile UI, intended default-OFF runtime flag | No enforceable live acceptance, migration 0072 deployment or real-device pass |
| [PR #1075](https://github.com/ValentinGanchevA1/general/pull/1075) and [PR #1143](https://github.com/ValentinGanchevA1/general/pull/1143) | Merged preparation-validator safeguards; approved HTML and approval record can be checked with a dry run | No actual approval packet or publication |
| [PR #1142](https://github.com/ValentinGanchevA1/general/pull/1142) | Production-only live-document version and exact approved SHA-256 verification on the PR branch | Not a reviewer's signature; no live Terms page |
| [PR #1066](https://github.com/ValentinGanchevA1/general/pull/1066) | Reporting and Dating-related draft implementation | Describes superseded Dating-only 18+ policy; cannot be merged as-is |
| [PR #1080](https://github.com/ValentinGanchevA1/general/pull/1080) | Earlier staged email-registration adult gate proposal | Closed without merge; not evidence of deployed all-Social 18+ access controls |

**Do not copy historical Dating-only audience statements from PR #1066, earlier issue comments or older drafts.** Public product identity is **NEXUS**, not NEXA. Keep compatibility identifiers `com.g88`, `@g88/*` and Render hostname unchanged.

## 2. Current factual product brief for the reviewer

- First public release: map-first Social; people discovery, profiles, interactions, 1:1 messaging, events and local listings; Dating and paid digital/Premium checkout disabled for RC1. Feature availability must be checked against the exact release AAB/API.
- Whole Social service **intended for users 18 and over**, per owner decision. A birth date provided by the user is a declaration, **not independent age verification**. Server enforcement across OAuth, existing sessions, Socket.IO and REST remains a launch acceptance gate.
- Public map presence is coarsened; it is **not a guarantee of anonymity**. Separate opt-in 1:1 live sharing can disclose and persist precise coordinates, including an initial chat message. Stopping live sharing stops updates but does not by itself erase existing records.
- User generated content includes profiles, photos/stories, messages, reviews, events, listings, offers and related interactions. Reporting/blocking must be available as implemented. Moderation response, escalation and appeal workflow must be independently evidenced.
- Marketplace involves user-to-user contact/trade; do not claim that NEXUS provides escrow, verified sellers, insured transactions, guaranteed deliveries or checkout absent proof.
- Do not imply all trust badges certify identity, age or safety; document exactly what each check establishes.

## 3. Decisions required from counsel and owner (no automatic defaults)

| Priority | Decision / proof required | Responsible | Release evidence |
| --- | --- | --- | --- |
| BLOCKER | Verify legal service operator: full legal name, individual/registered-business status, address, contact channel, any required identification or notices | Owner + counsel | Reviewed operator notice and authoritative details |
| BLOCKER | Agree on actual Terms language(s), governing law, EEA/Bulgarian consumer rights, liability/warranty fairness and dispute procedure; do not waive mandatory rights | Counsel | Approved text + documented jurisdiction assessment |
| BLOCKER | Exact permitted UGC licence scope, IP rights, licence termination/deletion, reuse for moderation and retained lawful evidence | Counsel | Final section 4 |
| BLOCKER | Define prohibited UGC, report routes, illegal-content handling, moderation decisions, notices, appeals, and whether EU DSA provider obligations apply to this NEXUS service | Counsel + safety owner | Final section 3/9, operational SOP and functional evidence |
| BLOCKER | Account suspension, termination and appeal; maintain access to account deletion, reporting, blocking and statutory data requests where legally required | Counsel + backend QA | Final section 9/10 and staged QA |
| BLOCKER | Verify retention/deletion, backups, messages retained by recipients, precision-location records, access requests and privacy-law controller/processor statements | Counsel + privacy/DB owner | Final sections 5/10 + reconciled Privacy |
| BLOCKER | Age 18+ across all Social: determine defensible age-assurance wording, appeals, false-declaration action and lawful DOB retention; never call self-declared DOB “ID verified” | Counsel + auth owner | #1068 staged REST/Socket/Android proof |
| BLOCKER | Exact roles in events/listings/trades, responsibility between users, paid-feature availability and applicable consumer protections | Counsel + product owner | Final sections 7/8 and no-checkout QA |
| BLOCKER | Designate child-safety contact and actual CSAE/CSAM response process; review separate published child-safety standards and Google Play disclosures | Counsel + safety owner | #1071 evidence and approved URL |
| BLOCKER | Choose an immutable Terms version and prospective effective date **after** legal approval; record real reviewer identity/role/date and exact approved HTML SHA-256 | Counsel + release owner | `NEXUS_TERMS_APPROVAL.json` with verified candidate |
| REVIEW | Check whether Bulgarian-language Terms, an English version or both are required/appropriate for the targeted market; ensure acceptance captures the correct version/locale | Counsel + owner | Locale/translation approval |
| REVIEW | Ensure contact, branding, privacy, account-deletion and accessibility content are mutually consistent across public HTML, mobile and Play | Product + QA | Link/device snapshots and document diff |

## 4. Editorial guidance for the next Terms revision — proposed wording only

These are suggested directions for **human editing**, not validated legal clauses.

### A. Account eligibility and verification

Say that NEXUS is intended for adults 18+, and that users must provide accurate information. Distinguish a self-reported DOB from identity/age checks actually performed. Define denial, restriction, appeals and access to legally necessary account controls. Do **not** state that age verification is already implemented across all login and API paths until staged evidence supports it.

### B. Community content and intellectual property

Prohibit threats, harassment, stalking, doxxing, exploitation of minors, scams, malware, unauthorized sharing of others' precise location, illegal trade and rights infringement. State user ownership/responsibility as reviewed. Counsel must define a narrowly scoped, nonexclusive permission sufficient to host/process/display/distribute content **within NEXUS** and handle lawful moderation; specify duration and deletion effects. Avoid an unchecked perpetual, transferable commercial licence.

### C. Location and communication risks

Explain that a coarsened public pin may still permit location inference. Explain that precise 1:1 sharing is opt-in; a recipient can receive accurate GPS coordinates, and the service retains session/message records subject to the published Privacy Policy. Do not equate pressing Stop with erasure. Inform users that offline meetings, direct messages and local exchanges can entail safety risks.

### D. Moderation, reports and remedies

Describe actual report/block channels, how and why content/accounts may be restricted, complaint/appeal access where required, and treatment of urgent illicit content. Do not promise permanent human monitoring, 24/7 emergency response, response SLAs, automated screening, immediate deletion or automated appeals until implemented. Counsel should assess the applicable EU Digital Services Act duties, including terms transparency and notice/action/complaint processes **based on NEXUS's actual provider classification**, not assumed blanket exemptions.

### E. Events, marketplace and billing

Distinguish user-created listings/events from transactions, services or guarantees supplied by the operator. Do not invent escrow or transaction protections. At initial release, digital purchases and Premium checkout are disabled; before any later monetization, review additional applicable store, payment, cancellation and consumer provisions.

### F. Deletion, changes and disputes

Cross-reference the approved Privacy Policy for retention and account-deletion mechanics; disclose lawful exceptions, recipients' already received messages, and backup expiry accurately. Make material Terms version changes visible and require fresh affirmative acceptance before further UGC where applicable. Counsel should set governing law, dispute rights and limitations without waiving non-waivable consumer protections.

## 5. External policy review notes (not a legal applicability determination)

- [Google Play User-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937): review acceptance **before UGC creation/upload**, defined prohibited conduct, in-app report/block for publicly accessible social UGC and actual moderation.
- [Google Play Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720): adult-only Social still requires the applicable child-safety declaration, public standards, reporting and designated contact.
- [EU Digital Services Act overview](https://digital-strategy.ec.europa.eu/en/faqs/digital-services-act-questions-and-answers): counsel should evaluate intermediary/online-platform classification and applicable transparency, illegal-content and appeal requirements.
- [European Commission GDPR information obligations](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en): check the separate Privacy Policy against actual data collection, processors, retention and rights.

## 6. Reviewer decision and handoff record — intentionally blank

**No signature or approval is recorded here.** A completed row is a review note, not a publication permit.

| Field | To be filled by real reviewer / owner |
| --- | --- |
| Reviewer full name and qualification/role | **Not provided** |
| Operator legal capacity and contact details independently verified | **Not verified** |
| Scope: NEXUS Social 18+, Dating disabled | Owner decision recorded; deployment not verified |
| Terms language(s) | **Undecided** |
| Outstanding legal clauses and requested edits | **Open** |
| Counsel-approved exact HTML file | **Missing** |
| Immutable Terms version | **Not assigned** |
| Effective date | **Not assigned** |
| Approval date | **Not assigned** |
| Approved HTML SHA-256 | **Missing** |
| Signed review evidence / correspondence | **Missing** |
| Independent owner authorization to publish | **Not granted** |
| Final backend, Android, Play and public URL QA sign-off | **Not granted** |

## 7. Controlled route from review to publication

1. Counsel edits/finalizes the source text and confirms operator, obligations and actual feature/safety claims.
2. Freeze the precise reviewed HTML as `docs/legal-review/NEXUS_TERMS_CANDIDATE.html`. It must have exactly one `<!-- NEXUS_TERMS_VERSION=... -->` marker, valid `<time datetime="YYYY-MM-DD">`, NEXUS title, separate Privacy link, `index,follow` and no draft marker or executable content.
3. Separately verify counsel identity/authority; create `docs/legal-review/NEXUS_TERMS_APPROVAL.json` from the repository's example with the exact reviewed HTML SHA-256, actual approval date, version and effective date. Never fabricate approval metadata.
4. On the approved candidate, run `node scripts/legal/prepare-approved-terms.mjs` (dry run). Only after independent release-owner authorization, use the explicit `--write` publication preparation flow in a **reviewed PR**. Render `g88-legal` auto-deploys the public `docs/legal` directory from `master`; do not merge an unreviewed file.
5. Verify anonymous public `/terms` and separate `/privacy` with real HTTP responses and SHA-256 matching the approved candidate. Only then switch the mobile Terms URL and configure the approved `NEXUS_TERMS_VERSION` and `NEXUS_TERMS_SHA256` for the production release guard (see PR #1142).
6. Reconcile #1067 and the all-app 18+ work against the latest backend, prove staged migration 0072 and UGC/Socket enforcement, keep age-ineligible users able to reach safety/privacy controls as appropriate, and complete signed Android QA.
7. Match the exact Android AAB, backend deploy SHA, live URLs, Play Console declarations, child-safety standards and all independent sign-offs. **Do not close #592 or ship production before these checks pass.**

## Explicit non-goals

This handoff does **not** implement an age gate, create a human moderator, translate/approve final Terms, claim that the live legal pages return HTTP 200, or authorize release. No approved legal HTML is created in this PR.

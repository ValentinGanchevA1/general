# NEXUS Social — Child Safety release gate (8 Nov 2026)
**State: NO-GO for Child Safety self-certification until verified.** Related: #1071, #1068, #592, PR #1066 reporting/dating, PR #1067 Terms.

## Official requirements
Google Play Child Safety Standards for Social/Dating apps:
https://support.google.com/googleplay/android-developer/answer/14747720

Google Play UGC:
https://support.google.com/googleplay/android-developer/answer/9876937

Google Play Target Audience:
https://support.google.com/googleplay/android-developer/answer/9867159

Before self-certification, confirm all of:
| Gate | Real evidence required | Current truth (8 Nov) |
| --- | --- | --- |
| Published standards against CSAE | Legally reviewed **public** URL accessible without sign-in; exact policy text and effective date | **Missing / not approved** |
| In-app reporting mechanism | Profile + UGC reports actually reach production API and moderation queue; negative/offline test | **Code exists, production QA unknown** |
| CSAM action | Documented, staffed moderation/removal/escalation process with case ownership and secure audit trail | **Unverified** |
| Applicable child-safety laws | Jurisdictional review and written reporting/escalation policy | **Undecided / needs counsel** |
| Child safety point of contact | Named person with working monitored address submitted to Play Console | **Not designated** |
| Social minimum age / Play audience | Explicit targeted age brackets, protective defaults, registration/backend enforcement | **Undecided** |
| Dating off for first release | Inaccessible on signed AAB, REST, WebSockets and all deep links/previous matches | **Code planned in #1066; runtime QA unknown** |
| Privacy consistency | Public Privacy + Terms match general-Social age scope, precise 1:1 chat location, retention | **Inconsistent pending #1066 / legal** |

## Incident handling — operational draft (requires trained owner)
1. In-app report arrives with immutable case id, reporter, target id/type, reason and time. Do not store duplicate illicit media in report payloads.
2. Queue treats potential exploitation of minors as urgent. Explicitly assign to a trained moderator; prevent general admin access to raw sensitive material.
3. Restrict distribution/access where warranted (including preview/CDN/cached surfaces), preserve only evidence legally necessary, track authorized decisions and audit trail.
4. Use approved regional procedure to contact the relevant law-enforcement/child-protection authority when required. Avoid downloading, re-sharing or emailing suspected CSAM.
5. Escalate credible imminent danger to emergency authorities; do not promise instant emergency response through app report forms.
6. Use lawful retention and removal, add abuse-prevention follow-up, and evaluate appeal options separately from emergency containment.
7. Review false-positive handling, transparency and the actual effectiveness of repeated-abuse prevention.

## Exact-device QA (evidence links to attach)
- [ ] Create two test accounts; verify ordinary report user, report story, report listing/event/question/message (if present) and block.
- [ ] Force backend 500/offline; UI must not falsely acknowledge receipt.
- [ ] Re-report blocked user or expired story; persisted report should still be accepted as designed.
- [ ] Confirm admin triage queue + action audit are accessible **only** to authorized accounts.
- [ ] Confirm reported objectionable user content can be removed or disabled in normal read endpoints, caches, map and realtime pushes.
- [ ] Confirm age gating and target-audience choices only after explicit owner/legal decision.
- [ ] Confirm public standards page, child-safety contact, privacy/terms and approved release build refer to the same brand.
- [ ] Attach signed AAB SHA, date, device OS, app version, release track, API deploy SHA and screenshots/videos.

## Operator decision
Do not certify Child Safety Standards solely because this checklist and a draft policy exist. Dedicated policy publication and real staffed response capability must be evidenced separately.

# NEXUS Child Safety — operational evidence matrix (26 November 2026)

**Status: NOT RUN / NO-GO for self-certification.**
Scope: NEXUS Social 18+, Dating OFF. All test content must be synthetic and text-only. Never create, request, download, attach, copy, or circulate suspected CSAM.

| ID | Controlled test | Required evidence | Status |
|---|---|---|---|
| CS-01 | From exact signed AAB, report a synthetic test user | Build SHA, device/OS, report reference, API status | NOT RUN |
| CS-02 | Report each supported UGC type actually exposed by the AAB | Supported-type inventory and persisted report reference | NOT RUN |
| CS-03 | Repeat report and rate-limit burst | Idempotent/duplicate handling and throttling result | NOT RUN |
| CS-04 | Force offline and backend 500 during report submission | Visible failure; no false “reported” success state | NOT RUN |
| CS-05 | Call admin queue as ordinary user | 403; no report metadata leakage | NOT RUN |
| CS-06 | Triage a synthetic report as authorized moderator | Queue access, role identity, case owner, decision record and audit entry | NOT RUN |
| CS-07 | Apply available moderation action to a synthetic Story | Verify DB/read API/feed/map/realtime and document cache/media retention limits | NOT RUN |
| CS-08 | Block a synthetic account and report a blocked account | Both controls behave as designed; no retaliation or bypass | NOT RUN |
| CS-09 | Use under-18 and DOB-null synthetic accounts across email/OAuth/session restore/API/Socket.IO | Protected Social access denied; no map/chat/live location/push before eligibility | NOT RUN |
| CS-10 | Probe Dating UI/deep links/profile writes/API/discovery/realtime | Dating unavailable across client and server | NOT RUN |
| CS-11 | Run a text-only tabletop incident scenario | Priority assignment, containment, escalation decision, secure handling, retention decision and backup coverage | NOT RUN |
| CS-12 | Verify final public Child Safety URL after approved deploy | Anonymous HTTP 200; exact approved SHA/version/date/contact; mobile layout | NOT RUN |

## Execution controls

- Use a dedicated isolated NEXUS staging API/database and synthetic accounts. The 25 Nov owner review says the staging project has no application schema or migration history and a separate Render staging API is not yet available. Do not run this matrix against production as a workaround.
- Record app package/version/versionCode, signed AAB SHA-256, device model, Android version, API commit, database schema/migration checkpoint, test time (UTC), expected result, actual result, and redacted evidence link.
- Do not include reporter email, DOB, precise coordinates, message contents, access tokens, sensitive report details, or personal data in public PR comments.
- Do not assert that reviewing a report suspends an account. Do not assert immediate purge of media from caches or recipient devices.
- Do not assert automatic chat moderation or automated CSAM detection; neither is evidenced by the reviewed source.
- Escalation, retention, evidence preservation, authority-contact procedure, and backup staffing require legal/safety approval and an operational tabletop sign-off.
- Keep the Play Console Child Safety declaration NO-GO until legal approval, public page, actual reporting/response capability, and confirmed contact are all evidenced.

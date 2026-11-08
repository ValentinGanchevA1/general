# NEXUS first public release — 18+ age eligibility: backend registration slice

**Product owner override 8 November 2026:** First NEXUS Social release is **18+ for the entire app**; Dating stays **OFF**. Earlier Dating-only release drafts are historical and must not be published without revision. Android ID remains `com.g88`.

## Scope implemented in this draft

- An optional `dateOfBirth` ISO calendar field is accepted by email `POST /api/v1/auth/register`.
- When `NEXUS_REQUIRE_ADULT_AGE=true`, an absent DOB or DOB younger than 18 is **rejected by the backend before account creation**, including an exactly-18 UTC boundary and conservative Feb 29 treatment.
- Correct DOB persists in `users.date_of_birth` (existing schema). Invalid DOB is rejected even with the gate OFF. No new migration.
- When the flag is OFF, the historical signup flow (DOB optional) remains compatible. This is needed so the new guard can be staged without unexpectedly locking out existing test installations.
- Backend unit tests cover missing/underage/exactly-18, invalid/impossible DOB, leap birthday and successful persisted DOB.

## NOT IMPLEMENTED in this slice — P0 release blockers

- Google OAuth new-account flow **can still create accounts without DOB**.
- Existing accounts with no DOB, login/refresh-token rotation, JWT REST authorization and Socket.IO **are not yet gated**.
- Mobile/Web registration screens do not yet collect and pass DOB. No usable production UX.
- Age self-declaration is not independent verification. Legal age-assurance and appeal/retention process remain open.
- Dating remains available in parts of the codebase until separately disabled. Do not claim it is off because of this slice.
- Underage/ineligible users must retain lawful account deletion, report/block/support access.
- Do **not** enable `NEXUS_REQUIRE_ADULT_AGE` on production yet: this draft does not meet end-to-end eligibility criteria.
- Approved Privacy/Terms + Google Play 18+ Target Audience/Restrict Minor Access are separate sign-off gates.

See #1068 and #1071. Merge only after coordination with existing Draft #1066/#1067; no Render/Play Console changes were made here.

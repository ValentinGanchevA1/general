# NEXA / NEXUS Personal Labels — gated MVP

Status: **feature branch / not released**. Only merge after CI, migration dry-run, admin review and physical-device QA. The deployed state must not be inferred from committed code.

## Product contract

- Personal Labels describe a person's **self-reported** personality. They are not verified attributes, a trust score, or an assertion of psychological compatibility.
- Independent of `interests[]` and `goals[]` / Purpose. No discovery ranking, messaging permission or verification logic changes.
- Bio stays optional and unchanged. User can pick **0–5** approved labels.
- User proposals do **not** become profile tags until a moderator publishes them in the curated catalog.
- Initial bilingual seed: `night_owl` 🌙 Нощна сова / Night owl; `sarcastic` 😏 Саркастичен / Sarcastic; `good_listener` 💬 Добър слушател / Good listener; `spontaneous` ⚡ Спонтанен / Spontaneous.
- Current mobile catalog and profile badges use English. Backend supports Bulgarian and English catalogs and selected labels; a locale selector for **catalog display** is not yet exposed in mobile UI. The suggestion form does offer an explicit **Български / English** language choice.

## Kill switches (both required)

1. Backend `NEXA_PERSONAL_LABELS_ENABLED=true` (exact case/characters) enables the endpoints and returns `{enabled:true}` from `GET /api/v1/runtime-config/personal-labels`.
2. Metro build-time `NEXA_PERSONAL_LABELS_UI=true` opts the mobile bundle into the section and policy request. Unset, false, numeric values and spelling variants fail closed.
3. Admin Vite build-time `VITE_PERSONAL_LABELS_UI=true` opts the moderator tab into the admin bundle; it also requires the server switch.
4. Production/Play release builds retain all three **unset or false** until explicit release approval. The branch does not change CI secrets or production configuration.

When backend switch is false, all `/personal-labels/*` and `/admin/personal-label-proposals/*` service operations fail with 404; UI policy returns false. No registration/verification/onboarding existing behavior changes.

## Endpoint contract (all relative to `/api/v1`)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/runtime-config/personal-labels` | public | Fail-closed feature policy, no-store |
| GET | `/personal-labels/catalog?locale=bg|en` | JWT | Approved, active localized catalog |
| GET | `/personal-labels/me?locale=bg|en` | JWT | Owner's approved selected labels |
| PUT | `/personal-labels/me?locale=bg|en` | JWT | Atomically replace owner selection; `{keys: string[]}`, 0–5 distinct active labels |
| GET | `/personal-labels/users/:id?locale=bg|en` | JWT | Read public profile labels only after canonical users public-profile privacy checks |
| POST | `/personal-labels/proposals` | JWT, 2/hour throttle, 3/30 days durable quota | `{text,locale}` sends for moderation |
| GET | `/personal-labels/proposals/me` | JWT | Own suggestions and status only |
| GET | `/admin/personal-label-proposals?status=pending&offset=0&limit=20` | JWT + AdminGuard | Bounded moderation queue |
| POST | `/admin/personal-label-proposals/:id/decide` | JWT + AdminGuard | Approve bilingual, merge with active key, or reject; single-transaction decision |

The moderator must provide `key` (stable ASCII slug), `labelBg`, `labelEn`, `category` for `approve`; `existingKey` for `merge`; `note` is optional for merge/reject. Admin decisions are recorded with moderator ID + timestamp. Duplicates rejected by DB unique constraints.

## UI

- `ProfileEditScreen` — opt-in `PersonalLabelsEditor`, after Bio and before Interests, with selectable chips, count, Save, suggestion form with explicit BG/EN choice and own proposal statuses. The section also offers a dedicated Save labels action. The primary Edit Profile Save commits any pending label changes after the existing profile PATCH, and closes the editor only if all requested writes succeed. These are still separate API requests, not a database transaction. If label saving fails, the editor stays open with Redux error feedback so users can retry.
- `ProfileScreen` and shared `ProfileView` — `PersonalLabelsBadges`, fail-closed and read-only. Selected labels appear on public profiles only where an existing public profile is viewable.
- `apps/admin` — separate opt-in Personal Labels review tab, bilingual/category approval form, duplicate merge and explicit confirmation. Never render raw proposal HTML.

## Security, moderation and data privacy

- Server is authoritative for max 5, active labels, duplicate prevention, durable quota and access. Client checks are only UX.
- Unpublished proposal text is visible only to its owner and admins. Text normalization is NFKC, whitespace-collapsed, 3–40 characters. For MVP, suggestions must start with a letter and contain only letters, combining marks, numbers, spaces, apostrophe or dash; no URLs, @mentions, HTML or embedded scripts.
- This validation is **not** content moderation. Admin must reject harassment, threats, hate, personal/sensitive data, discriminatory or sexualized labels, misleading verification claims, and labels that are actually interests or Purpose.
- Human approval is mandatory, with translations manually verified. An approval is not a claim that the trait is true.
- Database FK user cascade ensures proposals and choices disappear on account deletion. Remaining retention for rejected proposals must be validated with privacy/legal before activating at scale; follow-up: add 90-day purge policy/worker and user suggestion withdrawal with anti-quota-bypass safeguards.
- No proposal text should enter analytics, Sentry breadcrumbs, Socket.IO events or logs.
- Profile visibility is inherited from `UsersService.getPublicProfile` (deleted/private/blocked checks), not a new SQL-only visibility shortcut. The public result includes only approved catalog labels.

## Acceptance criteria / QA (required before merge or rollout)

- [ ] Gate tests: absent/invalid backend and mobile flags hide the entire experience; backend returns 404 for all user/admin operations.
- [ ] Migration 0072 applies cleanly to a staging copy, is repeat-safe for seeding and does not modify existing profile/discovery tables.
- [ ] Choose 0 / 5 labels, reject 6/duplicates/inactive keys; concurrent edits are serialized per user.
- [ ] Anonymous calls 401; ordinary users cannot call moderator endpoints; moderator without `ADMIN_USER_IDS` is rejected.
- [ ] Suggestion rejects markup, links, malformed Unicode and too-long text; two simultaneous pending duplicates cannot both be inserted.
- [ ] 3 suggestions / 30 days per account and route throttling enforced, including after app reinstall.
- [ ] Moderator approval requires valid bilingual strings and category, creates one catalog entry, and records reviewer; double review gets 409; merge references active label only.
- [ ] Existing block/private/deleted profile permissions apply to viewing labels.
- [ ] Main Edit Profile Save with changed labels persists both resources; a failed label PUT keeps the editor open, and unchanged/disabled labels preserve the legacy profile save path.
- [ ] Android/iOS dark and light mode; long words, screen readers, font scaling, error/offline/retry, app resume and cold launch checked on devices.
- [ ] Saving labels then returning to You refreshes the visible chips; standalone ProfileView mounts do not require React Navigation context.
- [ ] No differences in Map/Discover/Pulse/Connections/You, profile PATCH, messaging, identity verification, onboarding or AAB build when feature is off.
- [ ] Red-team test proposals including “Honest cheater”, identity claims, protected attributes and phone numbers; moderation must reject/merge appropriately.
- [ ] CI backend/mobile/admin typechecks/tests and migration-prefix guard green.
- [ ] Final sign-off separate from merge; explicit staged rollout decision, never inferred from a passed PR.

## Rollout order

1. Branch only, flags false, PR review.
2. Apply migration on staging; enable server + test mobile/Admin builds only.
3. Validate suggestion lifecycle and public profile privacy with two accounts (including blocked/private).
4. Complete device QA + legal moderation policy + purge follow-up.
5. Only then consider a separately approved release candidate. No silent activation.

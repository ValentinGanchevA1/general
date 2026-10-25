# ID verification — ops

## Production readiness gate

Before a production verification smoke, authenticate as an admin and call:

```http
GET /api/v1/admin/verifications/readiness
```

The response is intentionally secret-free. `ready=true` requires:

- at least one `ADMIN_USER_IDS` entry;
- `AWS_S3_BUCKET` configured;
- `AWS_REGION` explicitly configured;
- `REKOGNITION_ENABLED=true` and Rekognition configured.

The probe never returns admin UUIDs, bucket names, AWS keys, or credentials. It validates configuration presence only; a real ID submission is still required to prove IAM/network access.

## Approve a pending submission

### A) Admin UI
1. User UUID must be in backend `ADMIN_USER_IDS` (comma-separated) **on the same env** (local / Render).
2. `cd apps/admin && pnpm dev` → http://127.0.0.1:5173
3. Login with that account (`POST /auth/login`).
4. Queue → open row → Approve / Reject.
5. Reject requires a human-readable reason.
6. Live badge needs CORS (`127.0.0.1:5173` in `CORS_ORIGINS`) + backend up; Refresh works offline.

### B) CLI (same API as UI)
```bash
# Local
export ADMIN_EMAIL='admin@g88.local'
export ADMIN_PASSWORD='...'
# export API_URL='https://g88-api.onrender.com/api/v1'   # prod

pnpm --filter @g88/backend id:approve              # single pending auto
pnpm --filter @g88/backend id:approve -- --user <uuid>
pnpm --filter @g88/backend id:approve -- --all
pnpm --filter @g88/backend id:approve -- --reject --user <uuid> --reason 'blurry id'
```

Script: `apps/backend/scripts/approve-id-verification.mjs`  
Route: `POST /api/v1/admin/verifications/pending/:userId/decide`  
Body: `{ "decision": "approved" | "rejected", "reason?": string }`

The HTTP decide route is retry-safe: repeating the same final decision returns the existing result without sending a second notification/socket update. A contradictory retry returns `409 Conflict` and never overwrites the original reviewer decision.

### C) List pending (debug)
```bash
pnpm --filter @g88/backend id:review   # DB + presigned URLs + decide hint
```

## Rekognition (assist-only)

| Env | Notes |
|-----|--------|
| `REKOGNITION_ENABLED=true` | Otherwise always `skipped` |
| `AWS_REGION` | Must match S3 bucket region (`eu-north-1`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Same IAM user as S3 |
| `AWS_S3_BUCKET` | Selfie/ID keys already uploaded under `verifications/` |

IAM (attach to the uploads user/role):
```json
{
  "Effect": "Allow",
  "Action": ["rekognition:DetectFaces", "rekognition:CompareFaces"],
  "Resource": "*"
}
```
Plus `s3:GetObject` on `arn:aws:s3:::BUCKET/verifications/*`.

Fail-open: DNS/IAM errors → `rekognition_status=error`, row still `pending` for human decide. **Never auto-approves.** Raw AWS exception messages are logged server-side; only a sanitized error name is persisted for the admin UI.

## Upload/security invariants

- Accepted media types: JPEG, PNG, WebP, HEIC only.
- Maximum decoded image size: 10 MiB per image.
- Submit endpoint is throttled to 3 attempts/hour per throttler identity.
- One pending submission per user is enforced in DB and service logic.
- Verification media is stored under private `verifications/<userId>/...` keys.
- Admin read URLs are presigned for 5 minutes.
- If uploads succeed but DB persistence fails, already-uploaded verification objects are deleted best-effort to avoid orphaned identity media.
- Account deletion purges the `verifications/<userId>/` S3 prefix; `user_id_verifications.user_id` is `ON DELETE CASCADE`.

## Retention policy

Automatic age-based retention for verification documents is intentionally **not** guessed in application code. Before public production, set an explicit legal/product retention period and implement it as an S3 lifecycle/tagging policy plus corresponding DB audit state. Until that decision is approved, account deletion is the guaranteed purge path.

## Render E2E — once per environment

1. Set on Render backend: `REKOGNITION_ENABLED=true`, explicit `AWS_REGION`, S3 keys/bucket, `ADMIN_USER_IDS=<admin-uuid>`.
2. Redeploy backend.
3. Call `GET /api/v1/admin/verifications/readiness` and require `ready=true`.
4. Mobile: submit ID (selfie + document) as a test user.
5. Admin UI or `id:review` → confirm `rekognition_status` is `ok` / `no_face_*` / `error` (not `skipped` when enabled).
6. Approve once, then retry the same approve request: both must return the same final verification ID and only one user notification should exist.
7. Submit a second test account and reject with a reason; mobile must surface the rejected state.
8. Mobile should receive `verification:updated` and an approved account's ladder level must become `id`.
9. Delete a disposable test account and verify its `verifications/<userId>/` S3 prefix is gone and its DB verification rows cascade away.

If step 5 stays `skipped` with `REKOGNITION_ENABLED=true`, check readiness output, bucket region and IAM before changing application code.

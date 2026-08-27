# ID verification — ops

## Approve a pending submission

### A) Admin UI
1. User UUID must be in backend `ADMIN_USER_IDS` (comma-separated).
2. `cd apps/admin && pnpm dev` → http://127.0.0.1:5173
3. Login with that account (`POST /auth/login`).
4. Queue → open row → Approve / Reject.
5. Live badge needs CORS (`127.0.0.1:5173`) + backend up; Refresh works offline.

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

IAM (attach to `g88-dev` or uploads user):
```json
{
  "Effect": "Allow",
  "Action": ["rekognition:DetectFaces", "rekognition:CompareFaces"],
  "Resource": "*"
}
```
Plus `s3:GetObject` on `arn:aws:s3:::BUCKET/verifications/*`.

Fail-open: DNS/IAM errors → `rekognition_status=error`, row still `pending` for human decide. **Never auto-approves.**

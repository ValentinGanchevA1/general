#!/usr/bin/env py
"""
Installer: fix the id-verification admin-surface collision.

Problem being fixed:
  1. AdminIdVerificationController (admin/verifications/*) calls
     service.listPendingVerifications() / service.getVerificationDetail() —
     neither exists on IdVerificationService (it has listPending/getAdminDetail).
     -> tsc failure.
  2. getAdminDetail calls s3Service.getSignedUrl(), which S3Service never had.
     -> tsc failure even once #1 is fixed.
  3. IdVerificationController still duplicates admin/pending, admin/:userId,
     admin/:userId/decide alongside the dedicated AdminIdVerificationController.

Fix:
  - IdVerificationController: drop the three admin/* routes, keep start/submit/status.
  - IdVerificationService: rename listPending -> listPendingVerifications,
    getAdminDetail -> getVerificationDetail (matches AdminIdVerificationController).
  - S3Service: add verificationReadUrl(key) — a real GET presign — and point
    getVerificationDetail at it instead of the nonexistent getSignedUrl().

AdminIdVerificationController and the three dto files are untouched — they were
already correct.

Usage (from repo root, C:\\Users\\vganc\\g88):
  py install_fix_admin_verification_collision.py
"""

import os

REPO_ROOT = r"C:\Users\vganc\g88"
BACKEND_SRC = os.path.join(REPO_ROOT, "apps", "backend", "src")
MODULE_DIR = os.path.join(BACKEND_SRC, "modules", "id-verification")
COMMON_DIR = os.path.join(BACKEND_SRC, "common")

FILES = {}

# ---------------------------------------------------------------------------
# id-verification.controller.ts — admin/* routes removed, back to 3 user routes
# ---------------------------------------------------------------------------

FILES[os.path.join(MODULE_DIR, "id-verification.controller.ts")] = """\
import { Controller, Post, Get, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { IdVerificationService } from './id-verification.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';

@Controller('verification/id')
@UseGuards(JwtAuthGuard)
export class IdVerificationController {
  constructor(private readonly service: IdVerificationService) {}

  @Post('start')
  async start(@CurrentUser('id') userId: string) {
    return this.service.startVerification(userId);
  }

  @Post('submit')
  async submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitIdVerificationDto,
  ) {
    return this.service.submitVerification(userId, dto);
  }

  @Get('status')
  async status(@CurrentUser('id') userId: string) {
    return this.service.getStatus(userId);
  }
}
"""

# ---------------------------------------------------------------------------
# id-verification.service.ts — renamed admin methods, real S3 read-presign call
# ---------------------------------------------------------------------------

FILES[os.path.join(MODULE_DIR, "id-verification.service.ts")] = """\
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { IdVerificationStatus } from '@g88/shared';
import { S3Service } from '../../common/s3.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';
import { DecideIdVerificationDto } from './dto/decide-id-verification.dto';
import { ListPendingVerificationsDto } from './dto/list-pending-verifications.dto';
import { ListPendingResponseDto } from './dto/list-pending-response.dto';
import { AdminVerificationDetailDto } from './dto/admin-verification-detail.dto';

interface UserRow {
  id: string;
  id_verification_status: IdVerificationStatus;
  id_verified_at: string | null;
}

interface VerificationRow {
  id: string;
  user_id: string;
  status: 'pending' | 'verified' | 'rejected';
  selfie_url: string;
  id_front_url: string;
  id_back_url: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class IdVerificationService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startVerification(userId: string) {
    const status = await this.requireEligible(userId);
    return { status };
  }

  async submitVerification(userId: string, dto: SubmitIdVerificationDto) {
    await this.requireEligible(userId);

    const selfieKey = await this.uploadImage(userId, 'selfie', dto.selfie, dto.selfieContentType);
    const idFrontKey = await this.uploadImage(userId, 'id-front', dto.idFront, dto.idFrontContentType);
    const idBackKey =
      dto.idBack !== undefined
        ? await this.uploadImage(userId, 'id-back', dto.idBack, dto.idBackContentType ?? 'image/jpeg')
        : null;

    await this.db.query(
      `INSERT INTO user_id_verifications (user_id, selfie_url, id_front_url, id_back_url, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, selfieKey, idFrontKey, idBackKey],
    );

    await this.db.query(
      `UPDATE users SET id_verification_status = 'pending' WHERE id = $1`,
      [userId],
    );

    return { status: 'pending' as const };
  }

  async getStatus(userId: string) {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, id_verification_status, id_verified_at FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException();

    return {
      status: rows[0].id_verification_status,
      verifiedAt: rows[0].id_verified_at,
    };
  }

  async decideVerification(
    adminId: string,
    targetUserId: string,
    dto: DecideIdVerificationDto,
  ) {
    const rows = await this.db.query<{ id: string; status: string }[]>(
      `SELECT id, status FROM user_id_verifications
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [targetUserId],
    );
    if (!rows[0]) throw new NotFoundException('No verification submission found');
    if (rows[0].status !== 'pending') {
      throw new BadRequestException(`Submission already ${rows[0].status}`);
    }

    const newStatus = dto.decision === 'approved' ? 'verified' : 'rejected';

    await this.db.query(
      `UPDATE user_id_verifications
       SET status = $1, reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
       WHERE id = $4`,
      [newStatus, adminId, dto.decision === 'rejected' ? dto.reason ?? null : null, rows[0].id],
    );

    await this.db.query(
      `UPDATE users
       SET id_verification_status = $1, id_verified_at = CASE WHEN $1 = 'verified' THEN now() ELSE id_verified_at END
       WHERE id = $2`,
      [newStatus, targetUserId],
    );

    await this.notificationsService.notifyIdVerificationDecided(
      targetUserId,
      newStatus as 'verified' | 'rejected',
      dto.decision === 'rejected' ? dto.reason : undefined,
    );

    return { status: newStatus };
  }

  async listPendingVerifications(query: ListPendingVerificationsDto): Promise<ListPendingResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      this.db.query<{ id: string; user_id: string; created_at: string }[]>(
        `SELECT id, user_id, created_at FROM user_id_verifications
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.db.query<{ count: string }[]>(
        `SELECT COUNT(*) FROM user_id_verifications WHERE status = 'pending'`,
      ),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        submittedAt: r.created_at,
      })),
      page,
      limit,
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async getVerificationDetail(targetUserId: string): Promise<AdminVerificationDetailDto> {
    const rows = await this.db.query<VerificationRow[]>(
      `SELECT id, user_id, status, selfie_url, id_front_url, id_back_url,
              created_at, reviewed_by, reviewed_at, rejection_reason
       FROM user_id_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [targetUserId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('No verification submission found');

    const [selfieUrl, idFrontUrl, idBackUrl] = await Promise.all([
      this.s3Service.verificationReadUrl(row.selfie_url),
      this.s3Service.verificationReadUrl(row.id_front_url),
      row.id_back_url ? this.s3Service.verificationReadUrl(row.id_back_url) : Promise.resolve(null),
    ]);

    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      selfieUrl,
      idFrontUrl,
      idBackUrl,
      submittedAt: row.created_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      rejectionReason: row.rejection_reason,
    };
  }

  private async requireEligible(userId: string): Promise<IdVerificationStatus> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, id_verification_status, id_verified_at FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('User not found');
    if (rows[0].id_verification_status === 'verified') {
      throw new BadRequestException('Already verified');
    }
    return rows[0].id_verification_status;
  }

  private async uploadImage(
    userId: string,
    kind: 'selfie' | 'id-front' | 'id-back',
    base64: string,
    contentType: string,
  ): Promise<string> {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException(`${kind} image is empty or not valid base64`);
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`${kind} image exceeds the 10 MB limit`);
    }
    return this.s3Service.uploadVerificationBuffer(userId, kind, buffer, contentType);
  }
}
"""

# ---------------------------------------------------------------------------
# s3.service.ts — adds verificationReadUrl(key), a real GET presign.
# Full-file overwrite so the diff is self-contained and auditable.
# ---------------------------------------------------------------------------

FILES[os.path.join(COMMON_DIR, "s3.service.ts")] = """\
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Every object a user owns is written under `{prefix}/{userId}/...` (see the
// upload paths below), so account deletion can purge a user's blobs by prefix
// without parsing stored URLs.
const USER_OBJECT_PREFIXES = ['avatars', 'photos', 'listings', 'verifications'] as const;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION ?? 'eu-north-1';
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.client = new S3Client({ region: this.region });
  }

  /** Presigned PUT URL for a user avatar. Key: avatars/{userId}/{uuid}.{ext} */
  async avatarPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('avatars', userId, contentType);
  }

  /** Presigned PUT URL for a gallery photo. Key: photos/{userId}/{uuid}.{ext} */
  async photoPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('photos', userId, contentType);
  }
  /**
   * Upload an ID-verification document buffer directly to S3 (no presigned URL).
   * Mirrors uploadPhotoBuffer: avoids React Native binary-PUT quirks and lets the
   * server sign the real Content-Type instead of guessing. Returns the S3 object
   * key — verification docs are private, so we store the key, not a public URL.
   */
  async uploadVerificationBuffer(
    userId: string,
    kind: 'selfie' | 'id-front' | 'id-back',
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    const ext = EXT_MAP[contentType] ?? 'jpg';
    const key = `verifications/${userId}/${kind}-${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /**
   * Short-lived presigned GET URL for a private object stored by key (currently
   * only ID-verification docs — selfie/id-front/id-back — are stored as bare keys
   * rather than public URLs). Used solely by the admin review surface so a
   * reviewer's browser can load the image directly from S3 without the bucket
   * being public. Expires in 5 minutes.
   */
  async verificationReadUrl(key: string): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: 300 });
  }

  /**
   * Upload a gallery-photo buffer directly to S3 (no presigned URL round-trip).
   * Used by the mobile upload proxy endpoint — avoids React Native binary PUT quirks.
   */
  async uploadPhotoBuffer(
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.uploadImageBuffer('photos', userId, buffer, contentType);
  }

  /**
   * Upload a listing image buffer directly to S3. Key: listings/{userId}/{uuid}.{ext}.
   * Same base64-over-JSON path as photos (RN multipart "Stream Closed" quirk).
   */
  async uploadListingImageBuffer(
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.uploadImageBuffer('listings', userId, buffer, contentType);
  }

  /** Shared image-buffer upload: writes under `{prefix}/{userId}/{uuid}.{ext}`. */
  private async uploadImageBuffer(
    prefix: string,
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    const ext = EXT_MAP[contentType] ?? 'jpg';
    const key = `${prefix}/${userId}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Delete every object a user owns (avatars, gallery photos, listing images,
   * ID-verification docs). Used by account deletion. Best-effort and idempotent:
   * no-ops when the bucket is unconfigured (dev/test), and paginates each prefix
   * in batches of 1000 (the DeleteObjects cap). Returns the number of objects
   * removed so callers can log it.
   */
  async deleteUserObjects(userId: string): Promise<number> {
    if (!this.bucket) return 0;
    let deleted = 0;
    for (const prefix of USER_OBJECT_PREFIXES) {
      let continuationToken: string | undefined;
      do {
        const listed = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: `${prefix}/${userId}/`,
            ContinuationToken: continuationToken,
          }),
        );
        const objects = (listed.Contents ?? [])
          .map((o) => o.Key)
          .filter((k): k is string => Boolean(k));
        if (objects.length > 0) {
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: objects.map((Key) => ({ Key })), Quiet: true },
            }),
          );
          deleted += objects.length;
        }
        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (continuationToken);
    }
    return deleted;
  }

  /**
   * Return a presigned PUT URL under `{prefix}/{userId}/{uuid}.{ext}`.
   * URL expires in 5 minutes — enough for a mobile upload.
   */
  private async presign(
    prefix: string,
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');

    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    const ext = EXT_MAP[contentType];
    if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
    const key = `${prefix}/${userId}/${randomUUID()}.${ext}`;

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      // ACL: public-read would work but presigned URL + CF CDN is the right model.
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 300 });
    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }
}
"""

# ---------------------------------------------------------------------------
# Installer logic
# ---------------------------------------------------------------------------

def main() -> None:
    if not os.path.isdir(MODULE_DIR):
        print(f"ERROR: module dir not found: {MODULE_DIR}")
        print("Check REPO_ROOT at the top of this script.")
        raise SystemExit(1)
    if not os.path.isdir(COMMON_DIR):
        print(f"ERROR: common dir not found: {COMMON_DIR}")
        raise SystemExit(1)

    written = []
    for path, content in FILES.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        written.append(path)

    print(f"Wrote {len(written)} files:")
    for path in written:
        print(f"  {os.path.relpath(path, REPO_ROOT)}")

    print()
    print("Unchanged (already correct, not touched):")
    print("  apps/backend/src/modules/id-verification/admin-id-verification.controller.ts")
    print("  apps/backend/src/modules/id-verification/id-verification.module.ts")
    print("  apps/backend/src/modules/id-verification/dto/list-pending-verifications.dto.ts")
    print("  apps/backend/src/modules/id-verification/dto/list-pending-response.dto.ts")
    print("  apps/backend/src/modules/id-verification/dto/admin-verification-detail.dto.ts")

    print()
    print("Next steps:")
    print("  1. pnpm --filter @g88/backend typecheck")
    print("  2. pnpm --filter @g88/backend exec jest id-verification")
    print('  3. git add -A && git commit -m "fix(id-verification): resolve admin controller/service method mismatch"')
    print("  4. gh pr create --fill")


if __name__ == "__main__":
    main()

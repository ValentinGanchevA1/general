import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client } from '@aws-sdk/client-s3';

import type { IdVerificationStatus } from '@g88/shared';
import { S3Service } from '../../common/s3.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';
import { DecideIdVerificationDto } from './dto/decide-id-verification.dto';
import { ListPendingVerificationsDto } from './dto/list-pending-verifications.dto';
import { ListPendingResponseDto, PendingVerificationSummaryDto } from './dto/list-pending-response.dto';
import { AdminVerificationDetailDto } from './dto/admin-verification-detail.dto';

interface UserRow {
  id: string;
  id_verification_status: IdVerificationStatus;
  id_verified_at: string | null;
}

interface PendingVerificationRow {
  id: string;
  user_id: string;
  display_name: string;
  selfie_url: string;
  id_front_url: string;
  id_back_url: string | null;
  created_at: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class IdVerificationService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
  ) {
    this.region = process.env.AWS_REGION ?? 'eu-north-1';
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.s3Client = new S3Client({ region: this.region });
  }

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
    return this.db.transaction(async (queryRunner) => {
      const rows = await queryRunner.query<{ id: string; status: string }[]>(
        `SELECT id, status FROM user_id_verifications
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [targetUserId],
      );
      if (!rows[0]) throw new NotFoundException('No verification submission found');
      if (rows[0].status !== 'pending') {
        throw new BadRequestException(`Submission already ${rows[0].status}`);
      }

      const newStatus = dto.decision === 'approved' ? 'verified' : 'rejected';
      const verificationId = rows[0].id;

      // Atomic conditional UPDATE: only update if status is still 'pending'
      const updateResult = await queryRunner.query(
        `UPDATE user_id_verifications
         SET status = $1, reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
         WHERE id = $4 AND status = 'pending'`,
        [newStatus, adminId, dto.decision === 'rejected' ? dto.reason ?? null : null, verificationId],
      );

      // Check if update actually occurred (should be 1 row affected in PostgreSQL driver)
      if (!updateResult || updateResult === 0) {
        throw new BadRequestException('Verification was already processed by another admin');
      }

      await queryRunner.query(
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
    });
  }

  /**
   * Admin: List pending ID verifications with pagination.
   * GET /api/v1/admin/verifications/pending?page=1&limit=20
   */
  async listPendingVerifications(dto: ListPendingVerificationsDto): Promise<ListPendingResponseDto> {
    const offset = (dto.page - 1) * dto.limit;

    // Get total count
    const countRows = await this.db.query<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM user_id_verifications WHERE status = 'pending'`,
    );
    const total = parseInt(countRows[0]?.count ?? '0', 10);

    // Get paginated list
    const rows = await this.db.query<PendingVerificationRow[]>(
      `SELECT v.id, v.user_id, u.display_name, v.created_at
       FROM user_id_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.status = 'pending'
       ORDER BY v.created_at ASC
       LIMIT $1 OFFSET $2`,
      [dto.limit, offset],
    );

    const data: PendingVerificationSummaryDto[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      submittedAt: row.created_at,
    }));

    return {
      data,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total,
      },
    };
  }

  /**
   * Admin: Get a specific pending verification with presigned URLs for images.
   * GET /api/v1/admin/verifications/pending/:userId
   */
  async getVerificationDetail(userId: string): Promise<AdminVerificationDetailDto> {
    const rows = await this.db.query<PendingVerificationRow[]>(
      `SELECT v.id, v.user_id, u.display_name, v.selfie_url, v.id_front_url, v.id_back_url, v.created_at
       FROM user_id_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.user_id = $1 AND v.status = 'pending'
       ORDER BY v.created_at DESC
       LIMIT 1`,
      [userId],
    );

    if (!rows[0]) {
      throw new NotFoundException('No pending verification found for this user');
    }

    const row = rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      submittedAt: row.created_at,
      selfieUrl: await this.presignS3Url(row.selfie_url),
      idFrontUrl: await this.presignS3Url(row.id_front_url),
      idBackUrl: row.id_back_url ? await this.presignS3Url(row.id_back_url) : undefined,
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

  /**
   * Generate a presigned GET URL for an S3 object (verification document).
   * URL expires in 15 minutes — enough for an admin to view it.
   */
  private async presignS3Url(s3Key: string): Promise<string> {
    if (!this.bucket) {
      throw new Error('AWS_S3_BUCKET not configured');
    }
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    return getSignedUrl(this.s3Client, cmd, { expiresIn: 900 });
  }
}

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
import { RekognitionService } from './rekognition.service';
import { IdVerificationGateway } from './gateways/id-verification.gateway';

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
  face_similarity: number | null;
  selfie_face_count: number | null;
  id_front_face_count: number | null;
  selfie_face_confidence: number | null;
  id_front_face_confidence: number | null;
  rekognition_status: string;
  rekognition_error: string | null;
  rekognition_at: string | null;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class IdVerificationService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
    private readonly rekognitionService: RekognitionService,
    private readonly verificationGateway: IdVerificationGateway,
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

    // Assist-only: never blocks submit; scores inform admin review.
    const analysis = await this.rekognitionService.analyzeVerification(selfieKey, idFrontKey);

    const inserted = await this.db.query<{ id: string }[]>(
      `INSERT INTO user_id_verifications (
         user_id, selfie_url, id_front_url, id_back_url, status,
         face_similarity, selfie_face_count, id_front_face_count,
         selfie_face_confidence, id_front_face_confidence,
         rekognition_status, rekognition_error, rekognition_at
       ) VALUES (
         $1, $2, $3, $4, 'pending',
         $5, $6, $7, $8, $9, $10, $11, now()
       )
       RETURNING id`,
      [
        userId,
        selfieKey,
        idFrontKey,
        idBackKey,
        analysis.faceSimilarity,
        analysis.selfieFaceCount,
        analysis.idFrontFaceCount,
        analysis.selfieFaceConfidence,
        analysis.idFrontFaceConfidence,
        analysis.status,
        analysis.error,
      ],
    );

    await this.db.query(
      `UPDATE users SET id_verification_status = 'pending' WHERE id = $1`,
      [userId],
    );

    const verificationId = inserted[0]?.id;
    if (verificationId) {
      this.verificationGateway.emitVerificationUpdate({
        id: verificationId,
        userId,
        status: 'pending',
      });
    }

    return { status: 'pending' as const, verificationId };
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
    const newStatus = dto.decision === 'approved' ? 'verified' : 'rejected';
    const rejectionReason = dto.decision === 'rejected' ? dto.reason ?? null : null;

    // Atomic conditional update: prevents double-process race between two admins.
    // Notification stays outside the transaction (side-effect convention).
    const result = await this.db.transaction(async (manager) => {
      const updated = await manager.query<{ id: string }[]>(
        `UPDATE user_id_verifications
         SET status = $1, reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
         WHERE user_id = $4
           AND status = 'pending'
           AND id = (
             SELECT id FROM user_id_verifications
             WHERE user_id = $4 AND status = 'pending'
             ORDER BY created_at DESC
             LIMIT 1
           )
         RETURNING id`,
        [newStatus, adminId, rejectionReason, targetUserId],
      );

      if (!updated[0]) {
        const existing = await manager.query<{ id: string; status: string }[]>(
          `SELECT id, status FROM user_id_verifications
           WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [targetUserId],
        );
        if (!existing[0]) {
          throw new NotFoundException('No verification submission found');
        }
        throw new BadRequestException(`Submission already ${existing[0].status}`);
      }

      await manager.query(
        `UPDATE users
         SET id_verification_status = $1,
             id_verified_at = CASE WHEN $1 = 'verified' THEN now() ELSE id_verified_at END
         WHERE id = $2`,
        [newStatus, targetUserId],
      );

      return updated[0].id;
    });

    await this.notificationsService.notifyIdVerificationDecided(
      targetUserId,
      newStatus as 'verified' | 'rejected',
      dto.decision === 'rejected' ? dto.reason : undefined,
    );

    this.verificationGateway.emitVerificationUpdate({
      id: result,
      userId: targetUserId,
      status: newStatus as 'verified' | 'rejected',
    });

    return { status: newStatus, verificationId: result };
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
              created_at, reviewed_by, reviewed_at, rejection_reason,
              face_similarity, selfie_face_count, id_front_face_count,
              selfie_face_confidence, id_front_face_confidence,
              rekognition_status, rekognition_error, rekognition_at
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
      faceSimilarity: row.face_similarity,
      selfieFaceCount: row.selfie_face_count,
      idFrontFaceCount: row.id_front_face_count,
      selfieFaceConfidence: row.selfie_face_confidence,
      idFrontFaceConfidence: row.id_front_face_confidence,
      rekognitionStatus: (row.rekognition_status ?? 'skipped') as AdminVerificationDetailDto['rekognitionStatus'],
      rekognitionError: row.rekognition_error,
      rekognitionAt: row.rekognition_at,
    };
  }

  private async requireEligible(userId: string): Promise<IdVerificationStatus> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, id_verification_status, id_verified_at FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('User not found');
    const status = rows[0].id_verification_status;
    if (status === 'verified') {
      throw new BadRequestException('Already verified');
    }
    // One pending submission at a time — blocks stack-up and admin queue noise.
    if (status === 'pending') {
      throw new BadRequestException('Verification already pending review');
    }
    return status;
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

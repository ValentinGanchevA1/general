import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { IdVerificationStatus } from '@g88/shared';
import { S3Service } from '../../common/s3.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';

interface UserRow {
  id: string;
  id_verification_status: IdVerificationStatus;
  id_verified_at: string | null;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class IdVerificationService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3Service: S3Service,
  ) {}

  async startVerification(userId: string) {
    const status = await this.requireEligible(userId);
    return { status };
  }

  async submitVerification(userId: string, dto: SubmitIdVerificationDto) {
    // Re-check here too: `start` is advisory; `submit` is the gate that mutates.
    await this.requireEligible(userId);

    // The server decodes and uploads — keys are generated here, never trusted from
    // the client — so a caller can't point a submission at an arbitrary S3 object.
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

  /** Load the user, throw if missing or already verified; return current status. */
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

  /** Decode a base64 image, bound its size, upload it, and return the S3 key. */
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

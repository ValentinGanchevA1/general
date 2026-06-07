import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { IdVerificationStatus } from '@g88/shared';
import { S3Service } from '@/common/s3.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';

interface UserRow {
  id: string;
  id_verification_status: IdVerificationStatus;
  id_verified_at: string | null;
}

@Injectable()
export class IdVerificationService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3Service: S3Service,
  ) {}

  async startVerification(userId: string) {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, id_verification_status, id_verified_at FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('User not found');
    if (rows[0].id_verification_status === 'verified') {
      throw new BadRequestException('Already verified');
    }

    const selfieKey = `verifications/${userId}/selfie-${Date.now()}`;
    const idFrontKey = `verifications/${userId}/id-front-${Date.now()}`;

    const [selfieUrl, idFrontUrl] = await Promise.all([
      this.s3Service.verificationPresignedUrl(selfieKey),
      this.s3Service.verificationPresignedUrl(idFrontKey),
    ]);

    return {
      selfieUploadUrl: selfieUrl,
      idFrontUploadUrl: idFrontUrl,
      expiresIn: 3600,
    };
  }

  async submitVerification(userId: string, dto: SubmitIdVerificationDto) {
    const rows = await this.db.query<[{ id: string }[], number]>(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException();

    await this.db.query(
      `INSERT INTO user_id_verifications (user_id, selfie_url, id_front_url, id_back_url, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, dto.selfieKey, dto.idFrontKey, dto.idBackKey ?? null],
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
}

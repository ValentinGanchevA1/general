#!/usr/bin/env py
"""
Installer: admin review endpoints for the ID verification module.

Adds:
  - GET  /verification/id/admin/pending   (paginated queue, AdminGuard)
  - GET  /verification/id/admin/:userId   (submission detail w/ signed URLs, AdminGuard)

Writes 3 new DTO files and overwrites service.ts / controller.ts with the
admin-endpoint-enabled versions. No module wiring changes needed.

Usage (from repo root, C:\\Users\\vganc\\g88):
  py install_admin_id_verification.py
"""

import os

REPO_ROOT = r"C:\Users\vganc\g88"
MODULE_DIR = os.path.join(REPO_ROOT, "apps", "backend", "src", "modules", "id-verification")
DTO_DIR = os.path.join(MODULE_DIR, "dto")

FILES = {}

# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------

FILES[os.path.join(DTO_DIR, "list-pending-verifications.dto.ts")] = """\
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPendingVerificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
"""

FILES[os.path.join(DTO_DIR, "list-pending-response.dto.ts")] = """\
export interface PendingVerificationSummary {
  id: string;
  userId: string;
  submittedAt: string;
}

export interface ListPendingResponseDto {
  items: PendingVerificationSummary[];
  page: number;
  limit: number;
  total: number;
}
"""

FILES[os.path.join(DTO_DIR, "admin-verification-detail.dto.ts")] = """\
export interface AdminVerificationDetailDto {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
  selfieUrl: string;
  idFrontUrl: string;
  idBackUrl: string | null;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
"""

# ---------------------------------------------------------------------------
# Service (full overwrite)
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

  async listPending(query: ListPendingVerificationsDto): Promise<ListPendingResponseDto> {
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

  async getAdminDetail(targetUserId: string): Promise<AdminVerificationDetailDto> {
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
      this.s3Service.getSignedUrl(row.selfie_url),
      this.s3Service.getSignedUrl(row.id_front_url),
      row.id_back_url ? this.s3Service.getSignedUrl(row.id_back_url) : Promise.resolve(null),
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
# Controller (full overwrite)
# ---------------------------------------------------------------------------

FILES[os.path.join(MODULE_DIR, "id-verification.controller.ts")] = """\
import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IdVerificationService } from './id-verification.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';
import { DecideIdVerificationDto } from './dto/decide-id-verification.dto';
import { ListPendingVerificationsDto } from './dto/list-pending-verifications.dto';
import { AdminGuard } from './admin.guard';

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

  @Get('admin/pending')
  @UseGuards(AdminGuard)
  async listPending(@Query() query: ListPendingVerificationsDto) {
    return this.service.listPending(query);
  }

  @Get('admin/:userId')
  @UseGuards(AdminGuard)
  async adminDetail(@Param('userId') userId: string) {
    return this.service.getAdminDetail(userId);
  }

  @Post('admin/:userId/decide')
  @UseGuards(AdminGuard)
  async decide(
    @CurrentUser('id') adminId: string,
    @Param('userId') userId: string,
    @Body() dto: DecideIdVerificationDto,
  ) {
    return this.service.decideVerification(adminId, userId, dto);
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

    os.makedirs(DTO_DIR, exist_ok=True)

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
    print("Next steps:")
    print("  1. Confirm S3Service has a getSignedUrl(key) method (or adjust the one call site in")
    print("     id-verification.service.ts -> getAdminDetail).")
    print("  2. pnpm --filter @g88/backend typecheck")
    print('  3. git add -A && git commit -m "feat(id-verification): admin pending list + detail endpoints"')
    print("  4. gh pr create --fill")


if __name__ == "__main__":
    main()

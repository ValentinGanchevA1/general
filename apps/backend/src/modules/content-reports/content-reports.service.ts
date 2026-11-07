import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  ContentReport, AdminContentReport, AdminContentReportPage, CreateContentReportRequest,
  CreateContentReportResponse,
} from '@g88/shared';
import type { ContentReportQueueDto, DecideContentReportDto } from './dto';

interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: 'user' | 'story';
  target_id: string;
  reason: ContentReport['reason'];
  status: ContentReport['status'];
  created_at: Date;
  reviewed_at: Date | null;
  target_display_name: string | null;
  target_caption: string | null;
  target_media_url: string | null;
}

@Injectable()
export class ContentReportsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async submit(reporterId: string, dto: CreateContentReportRequest): Promise<CreateContentReportResponse> {
    // Enforce the same discoverability gates as the user/story read paths; don't
    // permit arbitrary UUID probing, self-reports, deleted content, or blocked stories.
    const rows: Array<{ id: string }> = dto.targetType === 'user'
      ? await this.db.query<Array<{ id: string }>>(
        `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL AND id <> $2`,
        [dto.targetId, reporterId],
      )
      : await this.db.query<Array<{ id: string }>>(
        `SELECT s.id FROM stories s JOIN users u ON u.id = s.author_id AND u.deleted_at IS NULL
         WHERE s.id = $1 AND s.deleted_at IS NULL AND s.expires_at > clock_timestamp()
         AND s.author_id <> $2 AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
            WHERE (b.blocker_id = $2 AND b.blocked_id = s.author_id)
               OR (b.blocker_id = s.author_id AND b.blocked_id = $2)
         )`, [dto.targetId, reporterId],
      );
    if (!rows[0]) {
      throw new NotFoundException({ code: 'report.target_unavailable', message: 'Content is no longer available.' });
    }

    // One report per reporter and target, including after reattempts. No raw content retained.
    await this.db.query(
      `INSERT INTO content_abuse_reports (reporter_id, target_type, target_id, reason)
       VALUES ($1,$2,$3,$4) ON CONFLICT (reporter_id,target_type,target_id) DO NOTHING`,
      [reporterId, dto.targetType, dto.targetId, dto.reason],
    );
    return { reported: true };
  }

  async list(dto: ContentReportQueueDto): Promise<AdminContentReportPage> {
    const limit = dto.limit ?? 30;
    const offset = dto.offset ?? 0;
    const rows = await this.db.query<ReportRow[]>(
      `SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.status,
         r.created_at, r.reviewed_at,
         COALESCE(tu.display_name, au.display_name) AS target_display_name,
         s.caption AS target_caption, s.media_url AS target_media_url
       FROM content_abuse_reports r
       LEFT JOIN users tu ON r.target_type = 'user' AND tu.id = r.target_id
       LEFT JOIN stories s ON r.target_type = 'story' AND s.id = r.target_id
       LEFT JOIN users au ON au.id = s.author_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
      [dto.status ?? 'open', limit + 1, offset],
    );
    return {
      items: rows.slice(0, limit).map((r): AdminContentReport => ({
        id: r.id, reporterId: r.reporter_id, targetType: r.target_type,
        targetId: r.target_id, reason: r.reason, status: r.status,
        createdAt: r.created_at.toISOString(), reviewedAt: r.reviewed_at?.toISOString() ?? null,
        targetDisplayName: r.target_display_name,
        targetCaption: r.target_caption,
        targetMediaUrl: r.target_media_url,
      })),
      nextOffset: rows.length > limit ? offset + limit : null,
    };
  }

  async decide(adminId: string, reportId: string, dto: DecideContentReportDto): Promise<{ status: ContentReport['status'] }> {
    return this.db.transaction(async tx => {
      const [report] = await tx.query<Array<{ target_type: 'user' | 'story'; target_id: string; status: string }>>(
        'SELECT target_type, target_id, status FROM content_abuse_reports WHERE id = $1 FOR UPDATE',
        [reportId],
      );
      if (!report) throw new NotFoundException({ code: 'report.not_found', message: 'Report not found.' });
      if (report.status !== 'open') throw new ConflictException({ code: 'report.already_reviewed', message: 'Report already processed.' });
      if (dto.decision === 'hide_story') {
        if (report.target_type !== 'story') {
          throw new BadRequestException({ code: 'report.not_story', message: 'Only story reports can hide a story.' });
        }
        // Soft deletion propagates into all existing story discovery/read queries.
        await tx.query(
          'UPDATE stories SET deleted_at = COALESCE(deleted_at, clock_timestamp()) WHERE id = $1',
          [report.target_id],
        );
      }
      const status: ContentReport['status'] =
        dto.decision === 'hide_story' ? 'hidden' : dto.decision === 'dismiss' ? 'dismissed' : 'reviewed';
      await tx.query(
        `UPDATE content_abuse_reports SET status = $2, reviewed_by = $3, reviewed_at = clock_timestamp(),
           review_note = $4 WHERE id = $1`,
        [reportId, status, adminId, dto.note?.trim() || null],
      );
      return { status };
    });
  }
}

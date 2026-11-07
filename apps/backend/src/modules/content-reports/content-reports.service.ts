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
  target_type: ContentReport['targetType'];
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
    // Reporters may only report content they are authorized to view.
    // SQL parameters remain bound; never query arbitrary target IDs without
    // the same visibility, expiry and bilateral-block rules as normal reads.
    let sql: string;
    switch (dto.targetType) {
      case 'user':
        sql = `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL AND id <> $2`;
        break;
      case 'story':
        // Allow reporting past abuse after an author blocks the reporter or
        // their Story expires. Deleted stories and deleted authors are excluded.
        sql = `SELECT s.id FROM stories s JOIN users u ON u.id = s.author_id AND u.deleted_at IS NULL
          WHERE s.id = $1 AND s.deleted_at IS NULL AND s.author_id <> $2`;
        break;
      case 'listing':
        sql = `SELECT l.id FROM listings l JOIN users u ON u.id = l.seller_id AND u.deleted_at IS NULL
          WHERE l.id = $1 AND l.deleted_at IS NULL AND l.visibility = 'public'
            AND l.seller_id <> $2 AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = $2 AND b.blocked_id = l.seller_id)
                  OR (b.blocker_id = l.seller_id AND b.blocked_id = $2)
            )`;
        break;
      case 'event':
        sql = `SELECT e.id FROM events e JOIN users u ON u.id = e.host_id AND u.deleted_at IS NULL
          WHERE e.id = $1 AND e.deleted_at IS NULL AND e.visibility = 'public'
            AND e.host_id <> $2 AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = $2 AND b.blocked_id = e.host_id)
                  OR (b.blocker_id = e.host_id AND b.blocked_id = $2)
            )`;
        break;
      case 'event_question':
        sql = `SELECT q.id FROM event_questions q
          JOIN events e ON e.id = q.event_id AND e.deleted_at IS NULL
          JOIN users u ON u.id = q.user_id AND u.deleted_at IS NULL
          WHERE q.id = $1 AND q.user_id <> $2 AND q.deleted_at IS NULL
            AND (e.visibility = 'public' OR e.host_id = $2)
            AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = $2 AND b.blocked_id IN (q.user_id, e.host_id))
                  OR (b.blocked_id = $2 AND b.blocker_id IN (q.user_id, e.host_id))
            )`;
        break;
      case 'check_in':
        sql = `SELECT ci.id FROM pulse_check_ins ci
          JOIN users u ON u.id = ci.user_id AND u.deleted_at IS NULL
          WHERE ci.id = $1 AND ci.user_id <> $2 AND ci.deleted_at IS NULL
            AND ci.expires_at > clock_timestamp()
            AND (ci.audience = 'nearby' OR (ci.audience = 'friends' AND EXISTS (
              SELECT 1 FROM friendships f
               WHERE (f.user_low_id = $2 AND f.user_high_id = ci.user_id)
                  OR (f.user_high_id = $2 AND f.user_low_id = ci.user_id)
            )))
            AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = $2 AND b.blocked_id = ci.user_id)
                  OR (b.blocker_id = ci.user_id AND b.blocked_id = $2)
            )`;
        break;
      case 'alert':
        sql = `SELECT a.id FROM alerts a JOIN users u ON u.id = a.author_id AND u.deleted_at IS NULL
          WHERE a.id = $1 AND a.author_id <> $2 AND a.deleted_at IS NULL
            AND a.visibility = 'public'
            AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = $2 AND b.blocked_id = a.author_id)
                  OR (b.blocker_id = a.author_id AND b.blocked_id = $2)
            )`;
        break;
      case 'message':
        sql = `SELECT m.id FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          JOIN users u ON u.id = m.sender_id AND u.deleted_at IS NULL
          WHERE m.id = $1 AND m.sender_id <> $2 AND (
            (c.kind IN ('dm', 'dating') AND $2 = ANY(c.participant_ids))
            OR (c.kind = 'group' AND EXISTS (
              SELECT 1 FROM conversation_members cm
               WHERE cm.conversation_id = c.id AND cm.user_id = $2
                 AND cm.left_at IS NULL
            ))
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
             WHERE (b.blocker_id = $2 AND b.blocked_id = m.sender_id)
                OR (b.blocker_id = m.sender_id AND b.blocked_id = $2)
          )`;
        break;
      default:
        throw new BadRequestException({ code: 'report.unsupported_target', message: 'Unsupported report target.' });
    }
    const rows = await this.db.query<Array<{ id: string }>>(sql, [dto.targetId, reporterId]);
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
         COALESCE(tu.display_name, au.display_name, lu.display_name, eu.display_name,
                  cu.display_name, mu.display_name, alert_author.display_name, qu.display_name) AS target_display_name,
         COALESCE(s.caption, l.description, e.description, ci.place_label, m.body, a.body, q.body) AS target_caption,
         COALESCE(s.media_url, l.thumbnail_url, e.cover_url) AS target_media_url
       FROM content_abuse_reports r
       LEFT JOIN users tu ON r.target_type = 'user' AND tu.id = r.target_id
       LEFT JOIN stories s ON r.target_type = 'story' AND s.id = r.target_id
       LEFT JOIN users au ON au.id = s.author_id
       LEFT JOIN listings l ON r.target_type = 'listing' AND l.id = r.target_id
       LEFT JOIN users lu ON lu.id = l.seller_id
       LEFT JOIN events e ON r.target_type = 'event' AND e.id = r.target_id
       LEFT JOIN users eu ON eu.id = e.host_id
       LEFT JOIN pulse_check_ins ci ON r.target_type = 'check_in' AND ci.id = r.target_id
       LEFT JOIN users cu ON cu.id = ci.user_id
       LEFT JOIN messages m ON r.target_type = 'message' AND m.id = r.target_id
       LEFT JOIN users mu ON mu.id = m.sender_id
       LEFT JOIN alerts a ON r.target_type = 'alert' AND a.id = r.target_id
       LEFT JOIN users alert_author ON alert_author.id = a.author_id
       LEFT JOIN event_questions q ON r.target_type = 'event_question' AND q.id = r.target_id
       LEFT JOIN users qu ON qu.id = q.user_id
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
      const [report] = await tx.query<Array<{ target_type: ContentReport['targetType']; target_id: string; status: string }>>(
        'SELECT target_type, target_id, status FROM content_abuse_reports WHERE id = $1 FOR UPDATE',
        [reportId],
      );
      if (!report) throw new NotFoundException({ code: 'report.not_found', message: 'Report not found.' });
      if (report.status !== 'open') throw new ConflictException({ code: 'report.already_reviewed', message: 'Report already processed.' });
      const hideTable: Partial<Record<ContentReport['targetType'], string>> = {
        story: 'stories', listing: 'listings', event: 'events', check_in: 'pulse_check_ins', alert: 'alerts', event_question: 'event_questions',
      };
      const hideDecision = {
        hide_story: 'story', hide_listing: 'listing', hide_event: 'event', hide_check_in: 'check_in',
        hide_alert: 'alert', hide_event_question: 'event_question',
      } as const;
      if (dto.decision in hideDecision) {
        const targetType = hideDecision[dto.decision as keyof typeof hideDecision];
        if (report.target_type !== targetType) {
          throw new BadRequestException({ code: 'report.target_mismatch', message: 'Moderation action must match report type.' });
        }
        const table = hideTable[targetType];
        if (!table) {
          throw new BadRequestException({ code: 'report.cannot_hide', message: 'This target cannot be hidden.' });
        }
        await tx.query(
          `UPDATE ${table} SET deleted_at = COALESCE(deleted_at, clock_timestamp()) WHERE id = $1`,
          [report.target_id],
        );
      }
      const status: ContentReport['status'] =
        dto.decision.startsWith('hide_') ? 'hidden' : dto.decision === 'dismiss' ? 'dismissed' : 'reviewed';
      await tx.query(
        `UPDATE content_abuse_reports SET status = $2, reviewed_by = $3, reviewed_at = clock_timestamp(),
           review_note = $4 WHERE id = $1`,
        [reportId, status, adminId, dto.note?.trim() || null],
      );
      return { status };
    });
  }
}

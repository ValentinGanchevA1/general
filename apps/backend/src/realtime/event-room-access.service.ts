import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Authoritative read-access check for event Socket.IO rooms.
 *
 * Matches EventsService.assertEventAccessible: public events or host-owned
 * private events only, with soft-deletion and bilateral block isolation.
 * Having an event UUID or a connected socket is not sufficient access.
 */
@Injectable()
export class EventRoomAccessService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async canView(userId: string, eventId: string): Promise<boolean> {
    if (!userId || !eventId) return false;

    const rows = (await this.db.query(
      `SELECT e.id
         FROM events e
        WHERE e.id = $1
          AND e.deleted_at IS NULL
          AND (e.visibility = 'public' OR e.host_id = $2)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $2 AND ub.blocked_id = e.host_id)
                    OR (ub.blocker_id = e.host_id AND ub.blocked_id = $2)
              )
        LIMIT 1`,
      [eventId, userId],
    )) as Array<{ id: string }>;

    return rows.length !== 0;
  }

  /**
   * Reauthorize viewers immediately before a realtime event delta is emitted.
   *
   * A socket can remain in an event room after a block or visibility change.
   * This single batched query applies the same event policy as canView(),
   * plus the question-author block policy used by listQuestions().
   */
  async authorizedViewerIds(
    eventId: string,
    viewerIds: readonly string[],
    question?: { authorId?: string; questionId?: string },
  ): Promise<Set<string>> {
    const uniqueIds = [...new Set(viewerIds.filter((id) => id.length > 0))];
    if (!eventId || uniqueIds.length === 0) return new Set();

    const rows = (await this.db.query(
      `SELECT viewers.viewer_id
         FROM unnest($2::uuid[]) AS viewers(viewer_id)
         JOIN events e ON e.id = $1
         LEFT JOIN event_questions q
           ON q.id = $4::uuid AND q.event_id = e.id
        WHERE e.deleted_at IS NULL
          AND (e.visibility = 'public' OR e.host_id = viewers.viewer_id)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = viewers.viewer_id AND ub.blocked_id = e.host_id)
                    OR (ub.blocker_id = e.host_id AND ub.blocked_id = viewers.viewer_id)
              )
          AND ($4::uuid IS NULL OR q.id IS NOT NULL)
          AND (
                COALESCE($3::uuid, q.user_id) IS NULL
                OR viewers.viewer_id = COALESCE($3::uuid, q.user_id)
                OR NOT EXISTS (
                     SELECT 1 FROM user_blocks qb
                      WHERE (qb.blocker_id = viewers.viewer_id
                             AND qb.blocked_id = COALESCE($3::uuid, q.user_id))
                         OR (qb.blocker_id = COALESCE($3::uuid, q.user_id)
                             AND qb.blocked_id = viewers.viewer_id)
                )
              )`,
      [
        eventId,
        uniqueIds,
        question?.authorId ?? null,
        question?.questionId ?? null,
      ],
    )) as Array<{ viewer_id: string }>;

    return new Set(rows.map((row) => row.viewer_id));
  }
}

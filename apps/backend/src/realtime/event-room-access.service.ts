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
}

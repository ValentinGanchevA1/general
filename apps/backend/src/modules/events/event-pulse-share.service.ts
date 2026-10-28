import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { ShareEventJoinResponse } from '@g88/shared';

import {
  PulseActivityRealtimeService,
  type RemoveEventJoinActivityInput,
} from '../feed/pulse-activity-realtime.service';

interface ShareableJoinRow {
  event_id: string;
  title: string;
  host_id: string;
  location_h3_r7: string;
  pulse_shared_at_iso: string;
}

interface JoinShareStateRow {
  title: string;
  host_id: string;
  location_h3_r7: string;
  visibility: 'public' | 'private';
  is_upcoming: boolean;
  deleted_at: Date | null;
  status: 'going' | 'maybe' | 'declined' | null;
  pulse_shared_at_iso: string | null;
}

interface RevocableJoinRow {
  event_id: string;
  host_id: string;
  location_h3_r7: string;
}

@Injectable()
export class EventPulseShareService {
  private readonly logger = new Logger(EventPulseShareService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly pulseRealtime: PulseActivityRealtimeService,
  ) {}

  async shareJoin(userId: string, eventId: string): Promise<ShareEventJoinResponse> {
    const [created] = await this.db.query<ShareableJoinRow[]>(
      `WITH updated AS (
        UPDATE event_attendees a
           SET pulse_shared_at = NOW(),
               updated_at = NOW()
          FROM events e
         WHERE a.event_id = $1
           AND a.user_id = $2
           AND a.status = 'going'
           AND a.pulse_shared_at IS NULL
           AND e.id = a.event_id
           AND e.deleted_at IS NULL
           AND e.visibility = 'public'
           AND e.starts_at > NOW()
      RETURNING e.id AS event_id,
                e.title,
                e.host_id,
                e.location_h3_r7,
                to_char(
                  a.pulse_shared_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS pulse_shared_at_iso
      )
      SELECT * FROM updated`,
      [eventId, userId],
    );

    if (created) {
      const sharedAt = created.pulse_shared_at_iso;
      void this.pulseRealtime.publishEventJoin({
        eventId: created.event_id,
        actorId: userId,
        eventTitle: created.title,
        eventHostId: created.host_id,
        locationH3R7: created.location_h3_r7,
        createdAt: sharedAt,
      }).catch((error: unknown) => {
        this.logger.warn(`event join realtime publish failed: ${String(error)}`);
      });

      return { eventId, sharedAt, alreadyShared: false };
    }

    const [state] = await this.db.query<JoinShareStateRow[]>(
      `SELECT e.title,
              e.host_id,
              e.location_h3_r7,
              e.visibility,
              e.starts_at > NOW() AS is_upcoming,
              e.deleted_at,
              a.status,
              CASE
                WHEN a.pulse_shared_at IS NULL THEN NULL
                ELSE to_char(
                  a.pulse_shared_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                )
              END AS pulse_shared_at_iso
         FROM events e
         LEFT JOIN event_attendees a
           ON a.event_id = e.id
          AND a.user_id = $2
        WHERE e.id = $1`,
      [eventId, userId],
    );

    if (!state || state.deleted_at) {
      throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });
    }
    if (state.visibility !== 'public') {
      throw new ConflictException({
        code: 'event.pulse_private',
        message: 'Private event attendance cannot be shared to Pulse.',
      });
    }
    if (state.status !== 'going') {
      throw new ConflictException({
        code: 'event.pulse_requires_going',
        message: 'RSVP Going before sharing this event to Pulse.',
      });
    }
    if (!state.is_upcoming) {
      throw new ConflictException({
        code: 'event.pulse_not_upcoming',
        message: 'Only upcoming events can be shared to Pulse.',
      });
    }
    if (state.pulse_shared_at_iso) {
      return {
        eventId,
        sharedAt: state.pulse_shared_at_iso,
        alreadyShared: true,
      };
    }

    throw new ConflictException({
      code: 'event.pulse_unavailable',
      message: 'This event cannot be shared to Pulse right now.',
    });
  }

  async prepareJoinRevocation(
    userId: string,
    eventId: string,
  ): Promise<RemoveEventJoinActivityInput | null> {
    const [row] = await this.db.query<RevocableJoinRow[]>(
      `SELECT e.id AS event_id,
              e.host_id,
              e.location_h3_r7
         FROM event_attendees a
         JOIN events e ON e.id = a.event_id
        WHERE a.event_id = $1
          AND a.user_id = $2
          AND a.status = 'going'
          AND a.pulse_shared_at IS NOT NULL
          AND e.deleted_at IS NULL
          AND e.visibility = 'public'`,
      [eventId, userId],
    );
    if (!row) return null;
    return {
      eventId: row.event_id,
      actorId: userId,
      eventHostId: row.host_id,
      locationH3R7: row.location_h3_r7,
    };
  }

  revokePreparedJoin(input: RemoveEventJoinActivityInput): void {
    void this.pulseRealtime.removeEventJoin(input).catch((error: unknown) => {
      this.logger.warn(`event join realtime removal failed: ${String(error)}`);
    });
  }
}

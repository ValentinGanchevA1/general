import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  computeH3Cells,
  EVENT_LIMITS,
  type EventDetail,
  type EventQuestion,
  type EventSummary,
  type PollResult,
  type RsvpResponse,
  type RsvpStatus,
} from '@g88/shared';

import {
  CreateEventDto,
  CreatePollDto,
  CreateQuestionDto,
  NearbyEventsDto,
  RsvpDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';

/** Max attendees inlined into an event detail payload. */
const ATTENDEE_PREVIEW = 50;

interface EventRow {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  starts_at: Date;
  ends_at: Date | null;
  capacity: number | null;
  attendee_count: number;
  visibility: 'public' | 'private';
  lat: number;
  lng: number;
  my_rsvp: RsvpStatus | null;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Create / read ─────────────────────────────────────────────────────────

  async create(hostId: string, dto: CreateEventDto): Promise<EventSummary> {
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'event.starts_in_past',
        message: 'Event start time must be in the future.',
      });
    }
    if (dto.endsAt && new Date(dto.endsAt).getTime() <= startsAt.getTime()) {
      throw new BadRequestException({
        code: 'event.ends_before_start',
        message: 'Event end time must be after the start time.',
      });
    }

    // An event location is a host-published venue pin, not a tracked personal
    // position — stored precisely, with app-computed H3 cells (per 0001).
    const cells = computeH3Cells(dto.location.lat, dto.location.lng);

    const rows = (await this.db.query(
      `INSERT INTO events
         (host_id, title, description, cover_url, starts_at, ends_at, capacity, visibility,
          location, location_h3_r4, location_h3_r5, location_h3_r6,
          location_h3_r7, location_h3_r8, location_h3_r9, location_h3_r10)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8,
          ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
          $11, $12, $13, $14, $15, $16, $17)
       RETURNING id, host_id, title, description, cover_url, starts_at, ends_at,
                 capacity, attendee_count, visibility,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      [
        hostId,
        dto.title,
        dto.description ?? null,
        dto.coverUrl ?? null,
        dto.startsAt,
        dto.endsAt ?? null,
        dto.capacity ?? null,
        dto.visibility ?? 'public',
        dto.location.lng,
        dto.location.lat,
        cells.r4, cells.r5, cells.r6, cells.r7, cells.r8, cells.r9, cells.r10,
      ],
    )) as EventRow[];

    const summary = this.toSummary({ ...rows[0]!, my_rsvp: null });

    // Fan a push to anyone watching this area via a geofence (channel `events`).
    // Fire-and-forget — public events only; a slow/failed FCM never blocks create.
    if (summary.visibility === 'public') {
      void this.notifications
        .notifyEventNearby(cells.r7, hostId, summary.title, summary.id)
        .catch(() => undefined);
    }

    return summary;
  }

  async nearby(userId: string, dto: NearbyEventsDto): Promise<EventSummary[]> {
    const radiusM = dto.radiusM ?? 5_000;
    const limit = dto.limit ?? 50;

    const rows = (await this.db.query(
      `SELECT e.id, e.host_id, e.title, e.description, e.cover_url, e.starts_at, e.ends_at,
              e.capacity, e.attendee_count, e.visibility,
              ST_Y(e.location::geometry) AS lat, ST_X(e.location::geometry) AS lng,
              a.status AS my_rsvp
         FROM events e
         LEFT JOIN event_attendees a ON a.event_id = e.id AND a.user_id = $1
        WHERE e.deleted_at IS NULL
          AND e.starts_at > NOW()
          AND (e.visibility = 'public' OR e.host_id = $1)
          AND ST_DWithin(
                e.location,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                $4)
        ORDER BY e.starts_at ASC
        LIMIT $5`,
      [userId, dto.location.lng, dto.location.lat, radiusM, limit],
    )) as EventRow[];

    return rows.map((r) => this.toSummary(r));
  }

  async detail(userId: string, eventId: string): Promise<EventDetail> {
    const [row] = (await this.db.query(
      `SELECT e.id, e.host_id, e.title, e.description, e.cover_url, e.starts_at, e.ends_at,
              e.capacity, e.attendee_count, e.visibility,
              ST_Y(e.location::geometry) AS lat, ST_X(e.location::geometry) AS lng,
              a.status AS my_rsvp,
              h.display_name AS host_display_name, h.avatar_url AS host_avatar_url
         FROM events e
         JOIN users h ON h.id = e.host_id
         LEFT JOIN event_attendees a ON a.event_id = e.id AND a.user_id = $1
        WHERE e.id = $2 AND e.deleted_at IS NULL`,
      [userId, eventId],
    )) as Array<EventRow & {
      host_display_name: string;
      host_avatar_url: string | null;
    }>;

    if (!row) throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });
    if (row.visibility === 'private' && row.host_id !== userId) {
      throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });
    }

    const attendees = (await this.db.query(
      `SELECT a.user_id, a.status, u.display_name, u.avatar_url
         FROM event_attendees a
         JOIN users u ON u.id = a.user_id
        WHERE a.event_id = $1 AND a.status = 'going'
        ORDER BY a.created_at ASC
        LIMIT $2`,
      [eventId, ATTENDEE_PREVIEW],
    )) as Array<{ user_id: string; status: RsvpStatus; display_name: string; avatar_url: string | null }>;

    return {
      ...this.toSummary(row),
      description: row.description,
      hostDisplayName: row.host_display_name,
      hostAvatarUrl: row.host_avatar_url,
      attendees: attendees.map((a) => ({
        userId: a.user_id,
        displayName: a.display_name,
        avatarUrl: a.avatar_url,
        status: a.status,
      })),
    };
  }

  // ─── RSVP ──────────────────────────────────────────────────────────────────

  async rsvp(userId: string, eventId: string, dto: RsvpDto): Promise<RsvpResponse> {
    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Lock the event row so the capacity check + count update are race-free.
      const [event] = await qr.query(
        `SELECT id, host_id, capacity, visibility
           FROM events
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [eventId],
      );
      if (!event) {
        throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });
      }
      if (event.visibility === 'private' && event.host_id !== userId) {
        throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });
      }

      const [existing] = await qr.query(
        `SELECT status FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId],
      );

      // Enforce capacity only on a transition *into* 'going' from a non-going state.
      const becomingGoing = dto.status === 'going' && existing?.status !== 'going';
      if (becomingGoing && event.capacity != null) {
        const [{ going }] = await qr.query(
          `SELECT COUNT(*)::int AS going FROM event_attendees
            WHERE event_id = $1 AND status = 'going'`,
          [eventId],
        );
        if (going >= event.capacity) {
          throw new ConflictException({
            code: 'event.full',
            message: 'This event is at capacity.',
          });
        }
      }

      await qr.query(
        `INSERT INTO event_attendees (event_id, user_id, status)
              VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id)
         DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [eventId, userId, dto.status],
      );

      // Recompute the cached going-count from the source of truth, then read it
      // back with a SELECT. (TypeORM's queryRunner.query returns a
      // [rows, affectedCount] tuple for UPDATE ... RETURNING — not a plain rows
      // array like INSERT ... RETURNING — so RETURNING here would mis-read; a
      // separate SELECT is unambiguous.)
      await qr.query(
        `UPDATE events
            SET attendee_count = (
                  SELECT COUNT(*) FROM event_attendees
                   WHERE event_id = $1 AND status = 'going')
          WHERE id = $1`,
        [eventId],
      );
      const [counted] = await qr.query(
        `SELECT attendee_count FROM events WHERE id = $1`,
        [eventId],
      );

      await qr.commitTransaction();
      return { eventId, status: dto.status, attendeeCount: counted.attendee_count };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─── Polls ──────────────────────────────────────────────────────────────────

  async createPoll(userId: string, eventId: string, dto: CreatePollDto): Promise<PollResult> {
    await this.assertHost(userId, eventId);

    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [poll] = await qr.query(
        `INSERT INTO event_polls (event_id, question) VALUES ($1, $2) RETURNING id`,
        [eventId, dto.question],
      );
      // Bound the iteration by a constant cap (defence-in-depth — the DTO's
      // @ArrayMaxSize already enforces this, but slicing makes the loop bound
      // independent of the user-supplied array length).
      const options = dto.options.slice(0, EVENT_LIMITS.pollOptionsMax);
      let position = 0;
      for (const label of options) {
        await qr.query(
          `INSERT INTO event_poll_options (poll_id, label, position) VALUES ($1, $2, $3)`,
          [poll.id, label, position],
        );
        position++;
      }
      await qr.commitTransaction();
      return this.pollResult(userId, poll.id);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async listPolls(userId: string, eventId: string): Promise<PollResult[]> {
    const polls = (await this.db.query(
      `SELECT id FROM event_polls WHERE event_id = $1 ORDER BY created_at ASC`,
      [eventId],
    )) as Array<{ id: string }>;
    return Promise.all(polls.map((p) => this.pollResult(userId, p.id)));
  }

  async vote(userId: string, pollId: string, optionId: string): Promise<PollResult> {
    const [poll] = await this.db.query(
      `SELECT closed_at FROM event_polls WHERE id = $1`,
      [pollId],
    );
    if (!poll) throw new NotFoundException({ code: 'poll.not_found', message: 'Poll not found.' });
    if (poll.closed_at) {
      throw new ConflictException({ code: 'poll.closed', message: 'This poll is closed.' });
    }

    const [option] = await this.db.query(
      `SELECT id FROM event_poll_options WHERE id = $1 AND poll_id = $2`,
      [optionId, pollId],
    );
    if (!option) {
      throw new BadRequestException({
        code: 'poll.bad_option',
        message: 'That option does not belong to this poll.',
      });
    }

    await this.db.query(
      `INSERT INTO event_poll_votes (poll_id, option_id, user_id)
            VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_id)
       DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
      [pollId, optionId, userId],
    );

    return this.pollResult(userId, pollId);
  }

  // ─── Q&A ─────────────────────────────────────────────────────────────────

  async askQuestion(userId: string, eventId: string, dto: CreateQuestionDto): Promise<EventQuestion> {
    const [event] = await this.db.query(
      `SELECT id FROM events WHERE id = $1 AND deleted_at IS NULL`,
      [eventId],
    );
    if (!event) throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });

    const [row] = await this.db.query(
      `INSERT INTO event_questions (event_id, user_id, body)
            VALUES ($1, $2, $3)
       RETURNING id, event_id, user_id, body, upvotes, answered, created_at`,
      [eventId, userId, dto.body],
    );
    const [user] = await this.db.query(`SELECT display_name FROM users WHERE id = $1`, [userId]);

    return {
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      displayName: user?.display_name ?? 'Someone',
      body: row.body,
      upvotes: row.upvotes,
      answered: row.answered,
      upvotedByMe: false,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async listQuestions(userId: string, eventId: string): Promise<EventQuestion[]> {
    const rows = (await this.db.query(
      `SELECT q.id, q.event_id, q.user_id, q.body, q.upvotes, q.answered, q.created_at,
              u.display_name,
              (uv.user_id IS NOT NULL) AS upvoted_by_me
         FROM event_questions q
         JOIN users u ON u.id = q.user_id
         LEFT JOIN event_question_upvotes uv ON uv.question_id = q.id AND uv.user_id = $1
        WHERE q.event_id = $2
        ORDER BY q.upvotes DESC, q.created_at ASC`,
      [userId, eventId],
    )) as Array<{
      id: string; event_id: string; user_id: string; body: string; upvotes: number;
      answered: boolean; created_at: Date; display_name: string; upvoted_by_me: boolean;
    }>;

    return rows.map((q) => ({
      id: q.id,
      eventId: q.event_id,
      userId: q.user_id,
      displayName: q.display_name,
      body: q.body,
      upvotes: q.upvotes,
      answered: q.answered,
      upvotedByMe: q.upvoted_by_me,
      createdAt: new Date(q.created_at).toISOString(),
    }));
  }

  async upvoteQuestion(userId: string, questionId: string): Promise<{ id: string; upvotes: number }> {
    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const inserted = await qr.query(
        `INSERT INTO event_question_upvotes (question_id, user_id)
              VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING question_id`,
        [questionId, userId],
      );
      // Only bump the cached count when this is a new (deduped) upvote. The
      // UPDATE carries no RETURNING — queryRunner.query returns a tuple for
      // UPDATE ... RETURNING (see rsvp) — so read the final count with a SELECT.
      if (inserted.length > 0) {
        await qr.query(
          `UPDATE event_questions SET upvotes = upvotes + 1 WHERE id = $1`,
          [questionId],
        );
      }
      const [row] = await qr.query(`SELECT upvotes FROM event_questions WHERE id = $1`, [questionId]);
      if (!row) {
        throw new NotFoundException({ code: 'question.not_found', message: 'Question not found.' });
      }
      await qr.commitTransaction();
      return { id: questionId, upvotes: row.upvotes };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async assertHost(userId: string, eventId: string): Promise<void> {
    const [event] = await this.db.query(
      `SELECT host_id FROM events WHERE id = $1 AND deleted_at IS NULL`,
      [eventId],
    );
    if (!event) throw new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });
    if (event.host_id !== userId) {
      throw new ForbiddenException({
        code: 'event.not_host',
        message: 'Only the host can do that.',
      });
    }
  }

  private async pollResult(userId: string, pollId: string): Promise<PollResult> {
    const [poll] = await this.db.query(
      `SELECT id, event_id, question, closed_at FROM event_polls WHERE id = $1`,
      [pollId],
    );
    if (!poll) throw new NotFoundException({ code: 'poll.not_found', message: 'Poll not found.' });

    const options = (await this.db.query(
      `SELECT o.id, o.label, COUNT(v.user_id)::int AS votes
         FROM event_poll_options o
         LEFT JOIN event_poll_votes v ON v.option_id = o.id
        WHERE o.poll_id = $1
        GROUP BY o.id, o.label, o.position
        ORDER BY o.position ASC`,
      [pollId],
    )) as Array<{ id: string; label: string; votes: number }>;

    const [mine] = await this.db.query(
      `SELECT option_id FROM event_poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId],
    );

    return {
      id: poll.id,
      eventId: poll.event_id,
      question: poll.question,
      options,
      totalVotes: options.reduce((sum, o) => sum + o.votes, 0),
      closedAt: poll.closed_at ? new Date(poll.closed_at).toISOString() : null,
      myVote: mine?.option_id ?? null,
    };
  }

  private toSummary(row: EventRow): EventSummary {
    return {
      id: row.id,
      hostId: row.host_id,
      title: row.title,
      coverUrl: row.cover_url,
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
      location: { lat: row.lat, lng: row.lng },
      capacity: row.capacity,
      attendeeCount: row.attendee_count,
      visibility: row.visibility,
      myRsvp: row.my_rsvp,
    };
  }
}

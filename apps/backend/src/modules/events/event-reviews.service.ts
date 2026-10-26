import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { EventAttendancePage, EventReview, EventReviewEligibility, EventReviewPage, EventReviewReport, MyEventReview } from '@g88/shared';
import { ReportEventReviewDto, ReviewPageDto, SaveEventReviewDto } from './review.dto';

interface EventGate {
  host_id: string; started: boolean; ended: boolean; going: boolean; confirmed: boolean;
}
interface ReviewRow {
  id: string; event_id: string; user_id: string; display_name: string;
  rating: number; tags: EventReview['tags']; comment: string;
  created_at: Date; updated_at: Date; editable_until: Date; hidden_at: Date | null;
}
const notFound = (): NotFoundException => new NotFoundException({ code: 'event.not_found', message: 'Event not found.' });

@Injectable()
export class EventReviewsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Event row lock serializes attendance, completion, review writes and existing RSVP mutations. */
  private async gate(tx: EntityManager, actor: string, eventId: string, lock = false): Promise<EventGate> {
    const [event] = await tx.query<EventGate[]>(
      `SELECT e.host_id, false AS started, false AS ended, false AS going, false AS confirmed
       FROM events e WHERE e.id = $2 AND e.deleted_at IS NULL
       AND (e.visibility = 'public' OR e.host_id = $1)
       AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
         (b.blocker_id = $1 AND b.blocked_id = e.host_id) OR
         (b.blocker_id = e.host_id AND b.blocked_id = $1)) ${lock ? 'FOR UPDATE OF e' : ''}`, [actor, eventId]);
    if (!event) throw notFound();
    // For writes, read timing AFTER acquiring the lock; transaction-start NOW() can be stale after a wait.
    const [state] = await tx.query<EventGate[]>(
      `SELECT e.host_id, e.starts_at <= clock_timestamp() AS started,
         e.ends_at IS NOT NULL AND e.ends_at <= clock_timestamp() AS ended,
         EXISTS (SELECT 1 FROM event_attendees a WHERE a.event_id = e.id AND a.user_id = $1 AND a.status = 'going') AS going,
         EXISTS (SELECT 1 FROM event_attendance_confirmations a WHERE a.event_id = e.id AND a.user_id = $1) AS confirmed
       FROM events e WHERE e.id = $2`, [actor, eventId]);
    if (!state) throw notFound();
    return state;
  }

  private eligibility(event: EventGate, actor: string): EventReviewEligibility {
    if (event.host_id === actor) return 'own_event';
    if (!event.ended) return 'event_ongoing';
    if (!event.going || !event.confirmed) return 'attendance_unconfirmed';
    return 'eligible';
  }

  private toReview(r: ReviewRow): EventReview {
    return { id: r.id, eventId: r.event_id, userId: r.user_id, displayName: r.display_name,
      rating: r.rating, tags: r.tags, comment: r.comment, createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(), editableUntil: r.editable_until.toISOString() };
  }

  private async mine(tx: EntityManager, actor: string, eventId: string, event: EventGate): Promise<MyEventReview> {
    const [r] = await tx.query<ReviewRow[]>(`SELECT r.*, u.display_name FROM event_reviews r
      JOIN users u ON u.id = r.user_id WHERE r.event_id = $1 AND r.user_id = $2`, [eventId, actor]);
    const [clock] = await tx.query<Array<{ now: Date }>>('SELECT clock_timestamp() AS now');
    return { eligibility: r?.hidden_at ? 'moderated' : this.eligibility(event, actor),
      myReview: r && !r.hidden_at ? this.toReview(r) : null, serverNow: clock!.now.toISOString() };
  }

  me(actor: string, eventId: string): Promise<MyEventReview> {
    return this.db.transaction('REPEATABLE READ', async tx => this.mine(tx, actor, eventId, await this.gate(tx, actor, eventId)));
  }

  save(actor: string, eventId: string, dto: SaveEventReviewDto, edit: boolean): Promise<MyEventReview> {
    return this.db.transaction(async tx => {
      const event = await this.gate(tx, actor, eventId, true);
      if (this.eligibility(event, actor) !== 'eligible') {
        throw new ForbiddenException({ code: 'review.ineligible', message: 'Only confirmed attendees can review a completed event.' });
      }
      if (edit) {
        // SELECT via CTE avoids TypeORM's UPDATE ... RETURNING tuple result shape.
        const changed = await tx.query<Array<{ id: string }>>(`WITH changed AS (
          UPDATE event_reviews SET rating = $3, tags = $4, comment = $5, updated_at = clock_timestamp()
          WHERE event_id = $1 AND user_id = $2 AND hidden_at IS NULL AND editable_until > clock_timestamp()
          RETURNING id) SELECT id FROM changed`, [eventId, actor, dto.rating, dto.tags, dto.comment.trim()]);
        if (!changed.length) throw new ConflictException({ code: 'review.edit_window_closed', message: 'This review is unavailable or its editing period has ended.' });
      } else {
        const rows = await tx.query<Array<{ id: string }>>(`INSERT INTO event_reviews (event_id, user_id, rating, tags, comment)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_id,user_id) DO NOTHING RETURNING id`,
        [eventId, actor, dto.rating, dto.tags, dto.comment.trim()]);
        if (!rows.length) throw new ConflictException({ code: 'review.exists', message: 'You have already reviewed this event.' });
      }
      return this.mine(tx, actor, eventId, event);
    }).catch((error: unknown) => {
      if (error !== null && typeof error === 'object' && 'driverError' in error) {
        const driver = error.driverError;
        if (driver !== null && typeof driver === 'object' && 'code' in driver && driver.code === 'P0409') {
          throw new ConflictException({ code: 'review.edit_window_closed', message: 'The editing period has ended.' });
        }
      }
      throw error;
    });
  }

  confirm(actor: string, eventId: string, participant: string): Promise<{ confirmedAt: string }> {
    return this.db.transaction(async tx => {
      const event = await this.gate(tx, actor, eventId, true);
      if (event.host_id !== actor) throw new ForbiddenException({ code: 'event.not_host', message: 'Only the host can confirm attendance.' });
      if (!event.started || event.ended || participant === actor) {
        throw new ConflictException({ code: 'attendance.unavailable', message: 'Confirm a participant during the event.' });
      }
      const [row] = await tx.query<Array<{ confirmed_at: Date }>>(`INSERT INTO event_attendance_confirmations
        (event_id, user_id, confirmed_by)
        SELECT a.event_id, a.user_id, $3 FROM event_attendees a JOIN users u ON u.id = a.user_id
        JOIN events e ON e.id = a.event_id
        WHERE a.event_id = $1 AND a.user_id = $2 AND a.status = 'going' AND u.deleted_at IS NULL
        AND e.starts_at <= clock_timestamp() AND (e.ends_at IS NULL OR e.ends_at > clock_timestamp())
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = $3 AND b.blocked_id = a.user_id) OR (b.blocker_id = a.user_id AND b.blocked_id = $3))
        ON CONFLICT (event_id,user_id) DO NOTHING RETURNING confirmed_at`, [eventId, participant, actor]);
      if (row) return { confirmedAt: row.confirmed_at.toISOString() };
      const [existing] = await tx.query<Array<{ confirmed_at: Date }>>(`SELECT c.confirmed_at FROM event_attendance_confirmations c
        JOIN event_attendees a USING (event_id,user_id) JOIN users u ON u.id = a.user_id
        WHERE c.event_id = $1 AND c.user_id = $2 AND a.status = 'going' AND u.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = $3 AND b.blocked_id = c.user_id) OR (b.blocker_id = c.user_id AND b.blocked_id = $3))`, [eventId, participant, actor]);
      if (!existing) throw notFound();
      return { confirmedAt: existing.confirmed_at.toISOString() };
    });
  }

  attendance(actor: string, eventId: string, dto: ReviewPageDto): Promise<EventAttendancePage> {
    return this.db.transaction('REPEATABLE READ', async tx => {
      const event = await this.gate(tx, actor, eventId);
      if (event.host_id !== actor) throw new ForbiddenException({ code: 'event.not_host', message: 'Only the host can manage attendance.' });
      const limit = dto.limit ?? 20;
      const rows = await tx.query<Array<{ user_id: string; display_name: string; confirmed_at: Date | null }>>(`SELECT a.user_id, u.display_name, c.confirmed_at
        FROM event_attendees a JOIN users u ON u.id = a.user_id
        LEFT JOIN event_attendance_confirmations c USING(event_id,user_id)
        WHERE a.event_id = $1 AND a.status = 'going' AND a.user_id <> $2 AND u.deleted_at IS NULL
        AND ($3::uuid IS NULL OR a.user_id > $3)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = $2 AND b.blocked_id = a.user_id) OR (b.blocker_id = a.user_id AND b.blocked_id = $2))
        ORDER BY a.user_id LIMIT $4`, [eventId, actor, dto.cursor ?? null, limit + 1]);
      const items = rows.slice(0, limit).map(r => ({ userId: r.user_id, displayName: r.display_name, confirmedAt: r.confirmed_at?.toISOString() ?? null }));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1]!.userId : null };
    });
  }

  end(actor: string, eventId: string): Promise<{ endsAt: string }> {
    return this.db.transaction(async tx => {
      const event = await this.gate(tx, actor, eventId, true);
      if (event.host_id !== actor) throw new ForbiddenException({ code: 'event.not_host', message: 'Only the host can end the event.' });
      if (!event.started) throw new ConflictException({ code: 'event.not_started', message: 'The event has not started.' });
      await tx.query(`UPDATE events SET ends_at = clock_timestamp() WHERE id = $1 AND (ends_at IS NULL OR ends_at > clock_timestamp())`, [eventId]);
      const [row] = await tx.query<Array<{ ends_at: Date }>>('SELECT ends_at FROM events WHERE id = $1', [eventId]);
      return { endsAt: row!.ends_at.toISOString() };
    });
  }

  list(actor: string, eventId: string, dto: ReviewPageDto): Promise<EventReviewPage> {
    return this.db.transaction('REPEATABLE READ', async tx => {
      await this.gate(tx, actor, eventId);
      const visible = `FROM event_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.event_id = $1 AND r.hidden_at IS NULL AND u.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = $2 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $2))`;
      const limit = dto.limit ?? 20;
      const rows = await tx.query<ReviewRow[]>(`SELECT r.*, u.display_name ${visible}
        AND ($3::uuid IS NULL OR r.id > $3) ORDER BY r.id LIMIT $4`, [eventId, actor, dto.cursor ?? null, limit + 1]);
      const [stats] = await tx.query<Array<{ count: number; average: number | null }>>(`SELECT count(*)::int AS count, avg(r.rating)::float AS average ${visible}`, [eventId, actor]);
      const items = rows.slice(0, limit).map(r => this.toReview(r));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1]!.id : null, count: stats!.count, average: stats!.average };
    });
  }

  report(actor: string, eventId: string, reviewId: string, dto: ReportEventReviewDto): Promise<{ reported: true }> {
    return this.db.transaction(async tx => {
      await this.gate(tx, actor, eventId, true);
      const [row] = await tx.query<Array<{ id: string }>>(`SELECT r.id FROM event_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.id = $1 AND r.event_id = $2 AND r.hidden_at IS NULL AND u.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = $3 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $3))`, [reviewId, eventId, actor]);
      if (!row) throw notFound();
      await tx.query(`INSERT INTO event_review_reports(review_id,reporter_id,reason) VALUES ($1,$2,$3)
        ON CONFLICT(review_id,reporter_id) DO NOTHING`, [reviewId, actor, dto.reason]);
      return { reported: true };
    });
  }

  async reports(dto: ReviewPageDto): Promise<{ items: EventReviewReport[]; nextCursor: string | null }> {
    const limit = dto.limit ?? 20;
    const rows = await this.db.query<Array<{ id: string; review_id: string; event_id: string; reason: EventReviewReport['reason']; created_at: Date }>>(`SELECT p.id, p.review_id, r.event_id, p.reason, p.created_at
      FROM event_review_reports p JOIN event_reviews r ON r.id = p.review_id
      WHERE r.hidden_at IS NULL AND ($1::uuid IS NULL OR p.id > $1) ORDER BY p.id LIMIT $2`, [dto.cursor ?? null, limit + 1]);
    const items = rows.slice(0, limit).map(r => ({ id: r.id, eventId: r.event_id, reviewId: r.review_id, reason: r.reason, createdAt: r.created_at.toISOString() }));
    return { items, nextCursor: rows.length > limit ? items[items.length - 1]!.id : null };
  }

  async hide(eventId: string, reviewId: string): Promise<{ hidden: true }> {
    await this.db.transaction(async tx => {
      // Same lock order as normal writes. The controller requires AdminGuard.
      const [event] = await tx.query<Array<{ id: string }>>('SELECT id FROM events WHERE id = $1 FOR UPDATE', [eventId]);
      if (!event) throw notFound();
      const [review] = await tx.query<Array<{ id: string }>>('SELECT id FROM event_reviews WHERE id = $1 AND event_id = $2', [reviewId, eventId]);
      if (!review) throw notFound();
      await tx.query('UPDATE event_reviews SET hidden_at = COALESCE(hidden_at, clock_timestamp()) WHERE id = $1', [reviewId]);
    });
    return { hidden: true };
  }
}

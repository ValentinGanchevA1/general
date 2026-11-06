/**
 * Real PostgreSQL verification for the RSVP event-row lock and ended-event
 * guard. Uses the same disposable CI PostgreSQL service as event reviews.
 */
import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { EventsService } from './events.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { RealtimeGateway } from '../../realtime/realtime.gateway';

const url = process.env.EVENT_RSVP_TEST_DATABASE_URL
  ?? process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Event RSVP lifecycle PostgreSQL integration', () => {
  const schema = `rsvp_${randomUUID().replaceAll('-', '')}`;
  const eventId = randomUUID();
  const hostId = randomUUID();
  const viewerA = randomUUID();
  const viewerB = randomUUID();

  let bootstrap: DataSource;
  let db: DataSource;
  let events: EventsService;

  beforeAll(async () => {
    bootstrap = await new DataSource({ type: 'postgres', url, entities: [] }).initialize();
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    db = await new DataSource({
      type: 'postgres',
      url,
      entities: [],
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();
    await db.query(`
      CREATE TABLE events (
        id uuid PRIMARY KEY,
        host_id uuid NOT NULL,
        capacity integer,
        visibility text NOT NULL DEFAULT 'public',
        deleted_at timestamptz,
        ends_at timestamptz,
        attendee_count integer NOT NULL DEFAULT 0
      );
      CREATE TABLE event_attendees (
        event_id uuid NOT NULL REFERENCES events(id),
        user_id uuid NOT NULL,
        status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY (event_id, user_id)
      );
      CREATE TABLE user_blocks (
        blocker_id uuid NOT NULL,
        blocked_id uuid NOT NULL
      );
    `);
    events = new EventsService(
      db,
      {} as NotificationsService,
      {} as RealtimeGateway,
    );
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await bootstrap.destroy();
    }
  });

  beforeEach(async () => {
    await db.query('TRUNCATE event_attendees, events, user_blocks CASCADE');
    await db.query(`
      INSERT INTO events(id, host_id, capacity, visibility, ends_at)
      VALUES ($1, $2, 1, 'public', clock_timestamp() + interval '1 hour')
    `, [eventId, hostId]);
  });

  it.each(['going', 'maybe', 'declined'] as const)(
    'rejects %s after the database event end, without changing attendance',
    async (status) => {
      await db.query(`
        UPDATE events SET ends_at = clock_timestamp() - interval '1 second'
        WHERE id = $1
      `, [eventId]);

      await expect(events.rsvp(viewerA, eventId, { status } as never))
        .rejects.toBeInstanceOf(ConflictException);
      const [count] = await db.query(
        'SELECT attendee_count FROM events WHERE id = $1', [eventId],
      ) as Array<{ attendee_count: number }>;
      expect(count?.attendee_count).toBe(0);
      const attendance = await db.query(
        'SELECT user_id FROM event_attendees WHERE event_id = $1', [eventId],
      ) as Array<{ user_id: string }>;
      expect(attendance).toHaveLength(0);
    },
  );

  it('allows an open-ended event without inventing a deadline', async () => {
    await db.query('UPDATE events SET ends_at = NULL WHERE id = $1', [eventId]);
    const saved = await events.rsvp(viewerA, eventId, { status: 'going' } as never);
    expect(saved).toMatchObject({ eventId, status: 'going', attendeeCount: 1 });
  });

  it('preserves the atomic final-seat capacity check under concurrent Going RSVPs', async () => {
    const outcomes = await Promise.allSettled([
      events.rsvp(viewerA, eventId, { status: 'going' } as never),
      events.rsvp(viewerB, eventId, { status: 'going' } as never),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((r) =>
      r.status === 'rejected' && r.reason instanceof ConflictException,
    )).toHaveLength(1);
    const [count] = await db.query(
      'SELECT attendee_count FROM events WHERE id = $1', [eventId],
    ) as Array<{ attendee_count: number }>;
    expect(count?.attendee_count).toBe(1);
    const [saved] = await db.query(
      "SELECT COUNT(*)::int AS going FROM event_attendees WHERE event_id=$1 AND status='going'",
      [eventId],
    ) as Array<{ going: number }>;
    expect(saved?.going).toBe(1);
  });

  it('keeps hidden and bilateral-blocked events indistinguishable from missing events', async () => {
    await db.query("UPDATE events SET visibility='private' WHERE id=$1", [eventId]);
    await expect(events.rsvp(viewerA, eventId, { status: 'going' } as never))
      .rejects.toBeInstanceOf(NotFoundException);

    await db.query("UPDATE events SET visibility='public' WHERE id=$1", [eventId]);
    for (const [blocker, blocked] of [
      [hostId, viewerA],
      [viewerA, hostId],
    ]) {
      await db.query(
        'INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)',
        [blocker, blocked],
      );
      await expect(events.rsvp(viewerA, eventId, { status: 'going' } as never))
        .rejects.toBeInstanceOf(NotFoundException);
      await db.query('TRUNCATE user_blocks');
    }
  });
});

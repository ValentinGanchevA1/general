/** Isolated PostgreSQL schema; CI supplies a disposable PostgreSQL service. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventReviewsService } from './event-reviews.service';

const url = process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('Event reviews PostgreSQL integration', () => {
  let db: DataSource;
  let bootstrap: DataSource;
  let service: EventReviewsService;
  const schema = `reviews_${randomUUID().replaceAll('-', '')}`;
  const host = randomUUID(); const attendee = randomUUID(); const other = randomUUID(); const event = randomUUID();
  const dto = { rating: 4, tags: ['welcoming' as const], comment: 'Helpful event' };
  beforeAll(async () => {
    bootstrap = await new DataSource({ type: 'postgres', url, entities: [] }).initialize();
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    db = await new DataSource({ type: 'postgres', url, entities: [], extra: { options: `-c search_path=${schema},public` } }).initialize();
    await db.query(`CREATE TABLE users (id uuid PRIMARY KEY, display_name text NOT NULL, deleted_at timestamptz);
      CREATE TABLE events (id uuid PRIMARY KEY, host_id uuid REFERENCES users(id) ON DELETE CASCADE, starts_at timestamptz NOT NULL, ends_at timestamptz, visibility text, deleted_at timestamptz);
      CREATE TABLE event_attendees (event_id uuid REFERENCES events(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id) ON DELETE CASCADE, status text, PRIMARY KEY(event_id,user_id));
      CREATE TABLE user_blocks (blocker_id uuid, blocked_id uuid);`);
    await db.query(readFileSync(join(__dirname, '../../..', 'migrations/0052_event_reviews.sql'), 'utf8'));
    service = new EventReviewsService(db);
  }, 30_000);
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) { await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await bootstrap.destroy(); }
  });
  beforeEach(async () => {
    await db.query('TRUNCATE users, events, event_attendees, user_blocks, event_reviews, event_attendance_confirmations, event_review_reports CASCADE');
    await db.query(`INSERT INTO users(id,display_name) VALUES ($1,'Host'),($2,'Attendee'),($3,'Other')`, [host, attendee, other]);
    await db.query(`INSERT INTO events VALUES ($1,$2,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour','public',NULL)`, [event, host]);
    await db.query(`INSERT INTO event_attendees VALUES ($1,$2,'going'),($1,$3,'going')`, [event, attendee, other]);
  });
  const complete = async (): Promise<void> => { await service.confirm(host, event, attendee); await service.end(host, event); };
  it('confirms attendance idempotently without replacing provenance', async () => {
    const first = await service.confirm(host, event, attendee);
    expect(await service.confirm(host, event, attendee)).toEqual(first);
    const [row] = await db.query('SELECT confirmed_by FROM event_attendance_confirmations');
    expect(row.confirmed_by).toBe(host);
  });
  it('Going alone, host and nonparticipant cannot review; confirmed attendance opens only after completion', async () => {
    expect((await service.me(attendee, event)).eligibility).toBe('event_ongoing');
    await service.confirm(host, event, attendee);
    await expect(service.save(attendee, event, dto, false)).rejects.toBeInstanceOf(ForbiddenException);
    await service.end(host, event);
    for (const actor of [host, other, randomUUID()]) await expect(service.save(actor, event, dto, false)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.save(attendee, event, dto, false)).myReview?.rating).toBe(4);
  });
  it('enforces one review under concurrent submissions and preserves its deadline', async () => {
    await complete();
    const results = await Promise.allSettled([service.save(attendee, event, dto, false), service.save(attendee, event, dto, false)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(ConflictException);
    const original = (await service.me(attendee, event)).myReview!;
    const edited = (await service.save(attendee, event, { ...dto, rating: 5 }, true)).myReview!;
    expect(edited.editableUntil).toBe(original.editableUntil);
    expect(edited.createdAt).toBe(original.createdAt);
    expect((await db.query('SELECT * FROM event_reviews')).length).toBe(1);
  });
  it('requires explicit completion when ends_at is NULL', async () => {
    await db.query('UPDATE events SET ends_at = NULL');
    await service.confirm(host, event, attendee);
    expect((await service.me(attendee, event)).eligibility).toBe('event_ongoing');
    await service.end(host, event);
    expect((await service.me(attendee, event)).eligibility).toBe('eligible');
  });
  it('uses DB boundaries for expired reviews and prevents resetting deadlines', async () => {
    await complete();
    await db.query(`INSERT INTO event_reviews(event_id,user_id,rating,created_at,updated_at,editable_until)
      VALUES($1,$2,4,statement_timestamp()-interval '24 hours',statement_timestamp(),statement_timestamp())`, [event, attendee]);
    await expect(service.save(attendee, event, dto, true)).rejects.toBeInstanceOf(ConflictException);
    await expect(db.query("UPDATE event_reviews SET editable_until = editable_until + interval '24 hours'")).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(db.query('UPDATE event_reviews SET rating = 5')).rejects.toMatchObject({ driverError: { code: 'P0409' } });
  });
  it('rejects another attendee editing the author review and current Declined/Maybe states', async () => {
    await complete(); await service.save(attendee, event, dto, false);
    await db.query(`INSERT INTO event_attendance_confirmations(event_id,user_id,confirmed_by) VALUES($1,$2,$3)`, [event, other, host]);
    await expect(service.save(other, event, dto, true)).rejects.toBeInstanceOf(ConflictException);
    for (const status of ['declined', 'maybe']) {
      await db.query('UPDATE event_attendees SET status=$1 WHERE user_id=$2', [status, attendee]);
      await expect(service.save(attendee, event, dto, true)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
  it('hides blocked, hidden and deleted authors from lists and aggregates; hiding preserves uniqueness', async () => {
    await complete(); const review = (await service.save(attendee, event, dto, false)).myReview!;
    expect((await service.list(other, event, {})).count).toBe(1);
    for (const pair of [[other, attendee], [attendee, other]]) {
      await db.query('INSERT INTO user_blocks VALUES($1,$2)', pair);
      expect((await service.list(other, event, {})).count).toBe(0);
      await expect(service.report(other, event, review.id, { reason: 'spam' })).rejects.toBeInstanceOf(NotFoundException);
      await db.query('TRUNCATE user_blocks');
    }
    await service.report(other, event, review.id, { reason: 'spam' });
    await service.report(other, event, review.id, { reason: 'spam' });
    expect((await service.reports({})).items).toHaveLength(1);
    await db.query('UPDATE users SET deleted_at=clock_timestamp() WHERE id=$1', [attendee]);
    expect((await service.list(other, event, {})).count).toBe(0);
    await db.query('UPDATE users SET deleted_at=NULL WHERE id=$1', [attendee]);
    await service.hide(event, review.id);
    expect(await service.list(other, event, {})).toMatchObject({ count: 0, average: null, items: [] });
    expect((await service.me(attendee, event)).eligibility).toBe('moderated');
    await expect(service.save(attendee, event, dto, false)).rejects.toBeInstanceOf(ConflictException);
    expect((await service.reports({})).items).toHaveLength(0);
  });
  it('preserves private/deleted event and both host block directions without leaking existence', async () => {
    await complete();
    for (const pair of [[other, host], [host, other]]) {
      await db.query('INSERT INTO user_blocks VALUES($1,$2)', pair);
      await expect(service.list(other, event, {})).rejects.toBeInstanceOf(NotFoundException);
      await db.query('TRUNCATE user_blocks');
    }
    await db.query("UPDATE events SET visibility='private'");
    await expect(service.me(attendee, event)).rejects.toBeInstanceOf(NotFoundException);
    await db.query("UPDATE events SET visibility='public', deleted_at=clock_timestamp()");
    await expect(service.save(attendee, event, dto, false)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('pages through all participants and reviews without using the attendee preview', async () => {
    const first = await service.attendance(host, event, { limit: 1 });
    expect(first.items).toHaveLength(1); expect(first.nextCursor).toBeTruthy();
    const next = await service.attendance(host, event, { limit: 1, cursor: first.nextCursor! });
    expect(next.items).toHaveLength(1); expect(next.items[0]?.userId).not.toBe(first.items[0]?.userId); expect(next.nextCursor).toBeNull();
    await service.confirm(host, event, attendee); await service.confirm(host, event, other); await service.end(host, event);
    await service.save(attendee, event, dto, false); await service.save(other, event, dto, false);
    const reviews = await service.list(host, event, { limit: 1 });
    const more = await service.list(host, event, { limit: 1, cursor: reviews.nextCursor! });
    expect(more.items[0]?.id).not.toBe(reviews.items[0]?.id); expect(more.nextCursor).toBeNull();
  });
  it('checks PostgreSQL value constraints and cascades account/event deletion', async () => {
    await complete();
    for (const [rating, tags, comment] of [[0, [], ''], [4, ['bad'], ''], [4, ['welcoming', 'welcoming'], ''], [4, [], 'x'.repeat(501)]]) {
      await expect(db.query('INSERT INTO event_reviews(event_id,user_id,rating,tags,comment) VALUES($1,$2,$3,$4,$5)', [event, attendee, rating, tags, comment])).rejects.toMatchObject({ driverError: { code: '23514' } });
    }
    await service.save(attendee, event, dto, false);
    await db.query('DELETE FROM users WHERE id=$1', [attendee]);
    expect(await db.query('SELECT * FROM event_reviews')).toEqual([]);
    expect(await db.query('SELECT * FROM event_attendance_confirmations')).toEqual([]);
    await db.query('DELETE FROM events WHERE id=$1', [event]);
    expect(await db.query('SELECT * FROM event_attendees')).toEqual([]);
  });
});

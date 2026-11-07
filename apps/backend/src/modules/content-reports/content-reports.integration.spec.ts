/**
 * Full migration + moderation lifecycle against disposable PostgreSQL.
 * CI runs this in an isolated schema; never point EVENT_REVIEWS_TEST_DATABASE_URL
 * at any production or persistent database.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ContentReportsService } from './content-reports.service';

const url = process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('content reports migration and moderation PostgreSQL integration', () => {
  let bootstrap: DataSource;
  let db: DataSource;
  let reports: ContentReportsService;

  const schema = `content_reports_${randomUUID().replaceAll('-', '')}`;
  const authorId = randomUUID();
  const reporterId = randomUUID();
  const moderatorId = randomUUID();
  const storyId = randomUUID();

  beforeAll(async () => {
    bootstrap = await new DataSource({ type: 'postgres', url, entities: [] }).initialize();
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    db = await new DataSource({
      type: 'postgres', url, entities: [],
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();

    await db.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        display_name text NOT NULL,
        deleted_at timestamptz
      );
      CREATE TABLE user_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL);
      CREATE TABLE stories (
        id uuid PRIMARY KEY,
        author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        media_url text NOT NULL,
        caption text,
        expires_at timestamptz NOT NULL,
        deleted_at timestamptz
      );
    `);
    const migration = readFileSync(
      join(__dirname, '../../..', 'migrations/0070_content_abuse_reports.sql'), 'utf8',
    );
    await db.query(migration);
    // Migration retries must not recreate, truncate or lose pending reports.
    await db.query(migration);
    reports = new ContentReportsService(db);
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await bootstrap.destroy();
    }
  });

  beforeEach(async () => {
    await db.query('TRUNCATE content_abuse_reports, user_blocks, stories, users CASCADE');
    await db.query(
      `INSERT INTO users (id,display_name) VALUES ($1,'Author'),($2,'Reporter'),($3,'Moderator')`,
      [authorId, reporterId, moderatorId],
    );
    await db.query(
      `INSERT INTO stories (id,author_id,media_url,caption,expires_at)
       VALUES ($1,$2,'https://example.test/media.jpg','Example for moderator',clock_timestamp()+interval '1 hour')`,
      [storyId, authorId],
    );
  });

  it('deduplicates concurrent user reports and enforces one row per reporter+target', async () => {
    const first = reports.submit(reporterId, { targetType: 'user', targetId: authorId, reason: 'spam' });
    const second = reports.submit(reporterId, { targetType: 'user', targetId: authorId, reason: 'harassment' });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { reported: true }, { reported: true },
    ]);
    const rows = await db.query<Array<{ reason: string; status: string }>>(
      'SELECT reason, status FROM content_abuse_reports',
    );
    expect(rows).toHaveLength(1);
    expect(['spam','harassment']).toContain(rows[0]?.reason);
    expect(rows[0]?.status).toBe('open');
    // Replaying a report never resets an existing moderation decision.
    const [report] = await db.query<Array<{ id: string }>>('SELECT id FROM content_abuse_reports');
    await reports.decide(moderatorId, report!.id, { decision: 'review' });
    await reports.submit(reporterId, { targetType: 'user', targetId: authorId, reason: 'privacy' });
    const [unchanged] = await db.query<Array<{ status: string }>>(
      'SELECT status FROM content_abuse_reports',
    );
    expect(unchanged?.status).toBe('reviewed');
  });

  it('presents story context to moderators and hides story atomically', async () => {
    await reports.submit(reporterId, { targetType: 'story', targetId: storyId, reason: 'privacy' });
    const page = await reports.list({ status: 'open', limit: 10 });
    expect(page.nextOffset).toBeNull();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      reporterId, targetId: storyId, targetType: 'story', reason: 'privacy',
      targetDisplayName: 'Author', targetCaption: 'Example for moderator',
    });
    const reportId = page.items[0]!.id;
    await expect(reports.decide(moderatorId, reportId, {
      decision: 'hide_story', note: 'Location disclosure',
    })).resolves.toEqual({ status: 'hidden' });
    const [story] = await db.query<Array<{ deleted_at: Date | null }>>(
      'SELECT deleted_at FROM stories WHERE id=$1', [storyId],
    );
    expect(story?.deleted_at).toBeInstanceOf(Date);
    expect((await reports.list({ status: 'open' })).items).toHaveLength(0);
    expect((await reports.list({ status: 'hidden' })).items).toHaveLength(1);
    await expect(reports.decide(moderatorId, reportId, {
      decision: 'dismiss',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('permits reporting after an author blocks the reporter or a story expires', async () => {
    await db.query('INSERT INTO user_blocks VALUES ($1,$2)', [authorId, reporterId]);
    await db.query("UPDATE stories SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1", [storyId]);
    await expect(reports.submit(reporterId, {
      targetType: 'story', targetId: storyId, reason: 'harassment',
    })).resolves.toEqual({ reported: true });
    expect((await reports.list({ status: 'open' })).items).toHaveLength(1);
  });

  it('rejects self-reports, deleted stories and deleted authors', async () => {
    await expect(reports.submit(authorId, {
      targetType: 'user', targetId: authorId, reason: 'other',
    })).rejects.toBeInstanceOf(NotFoundException);
    await db.query('UPDATE stories SET deleted_at=clock_timestamp() WHERE id=$1', [storyId]);
    await expect(reports.submit(reporterId, {
      targetType: 'story', targetId: storyId, reason: 'spam',
    })).rejects.toBeInstanceOf(NotFoundException);
    await db.query('UPDATE stories SET deleted_at=NULL WHERE id=$1', [storyId]);
    await db.query('UPDATE users SET deleted_at=clock_timestamp() WHERE id=$1', [authorId]);
    await expect(reports.submit(reporterId, {
      targetType: 'story', targetId: storyId, reason: 'spam',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies story hiding on user reports; cascade erases a deleted reporter\'s report', async () => {
    await reports.submit(reporterId, { targetType: 'user', targetId: authorId, reason: 'hate' });
    const [row] = await db.query<Array<{ id: string }>>('SELECT id FROM content_abuse_reports');
    await expect(reports.decide(moderatorId, row!.id, {
      decision: 'hide_story',
    })).rejects.toBeInstanceOf(BadRequestException);
    await db.query('DELETE FROM users WHERE id=$1', [reporterId]);
    expect(await db.query('SELECT id FROM content_abuse_reports')).toEqual([]);
  });

  it('rejects reason and target corruption at database layer', async () => {
    await expect(db.query(
      `INSERT INTO content_abuse_reports (reporter_id,target_type,target_id,reason)
       VALUES($1,'message',$2,'spam')`, [reporterId, authorId],
    )).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(db.query(
      `INSERT INTO content_abuse_reports (reporter_id,target_type,target_id,reason)
       VALUES($1,'story',$2,'arbitrary')`, [reporterId, storyId],
    )).rejects.toMatchObject({ driverError: { code: '23514' } });
  });
});

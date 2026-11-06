/** PostgreSQL-backed event-room authorization regressions. CI provides disposable Postgres. */
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { EventRoomAccessService } from './event-room-access.service';

const url = process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Event room recipient authorization PostgreSQL integration', () => {
  const schema = `event_room_access_${randomUUID().replaceAll('-', '')}`;
  const hostId = randomUUID();
  const viewerId = randomUUID();
  const otherId = randomUUID();
  const authorId = randomUUID();
  const eventId = randomUUID();
  const questionId = randomUUID();
  let bootstrap: DataSource;
  let db: DataSource;
  let service: EventRoomAccessService;

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
        visibility text NOT NULL,
        deleted_at timestamptz
      );
      CREATE TABLE user_blocks (
        blocker_id uuid NOT NULL,
        blocked_id uuid NOT NULL
      );
      CREATE TABLE event_questions (
        id uuid PRIMARY KEY,
        event_id uuid NOT NULL REFERENCES events(id),
        user_id uuid NOT NULL
      );
    `);
    service = new EventRoomAccessService(db);
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await bootstrap.destroy();
    }
  });

  beforeEach(async () => {
    await db.query('TRUNCATE event_questions, user_blocks, events CASCADE');
    await db.query(
      "INSERT INTO events(id,host_id,visibility) VALUES($1,$2,'public')",
      [eventId, hostId],
    );
    await db.query(
      'INSERT INTO event_questions(id,event_id,user_id) VALUES($1,$2,$3)',
      [questionId, eventId, authorId],
    );
  });

  const recipients = async (): Promise<Set<string>> =>
    service.authorizedViewerIds(eventId, [hostId, viewerId, otherId, viewerId]);

  it('authorizes public viewers and deduplicates repeated socket users', async () => {
    expect(await recipients()).toEqual(new Set([hostId, viewerId, otherId]));
    expect(await service.canView(viewerId, eventId)).toBe(true);
  });

  it('revokes viewers immediately after public-to-private transition', async () => {
    expect((await recipients()).has(viewerId)).toBe(true);
    await db.query("UPDATE events SET visibility='private' WHERE id=$1", [eventId]);
    expect(await recipients()).toEqual(new Set([hostId]));
    expect(await service.canView(viewerId, eventId)).toBe(false);
  });

  it('revokes all recipients when the event is soft-deleted', async () => {
    await db.query('UPDATE events SET deleted_at=NOW() WHERE id=$1', [eventId]);
    expect(await recipients()).toEqual(new Set());
    expect(await service.canView(hostId, eventId)).toBe(false);
  });

  it.each(['viewer-blocks-host', 'host-blocks-viewer'] as const)(
    'enforces bilateral blocks: %s',
    async (direction) => {
      const blocker = direction === 'viewer-blocks-host' ? viewerId : hostId;
      const blocked = direction === 'viewer-blocks-host' ? hostId : viewerId;
      await db.query('INSERT INTO user_blocks VALUES($1,$2)', [blocker, blocked]);
      expect((await recipients()).has(viewerId)).toBe(false);
      expect((await recipients()).has(otherId)).toBe(true);
      expect(await service.canView(viewerId, eventId)).toBe(false);
    },
  );

  it.each(['viewer-blocks-author', 'author-blocks-viewer'] as const)(
    'isolates Q&A author content: %s',
    async (direction) => {
      const blocker = direction === 'viewer-blocks-author' ? viewerId : authorId;
      const blocked = direction === 'viewer-blocks-author' ? authorId : viewerId;
      await db.query('INSERT INTO user_blocks VALUES($1,$2)', [blocker, blocked]);
      expect((await service.authorizedViewerIds(eventId, [viewerId, otherId], { authorId })).has(viewerId)).toBe(false);
      expect((await service.authorizedViewerIds(eventId, [viewerId, otherId], { questionId })).has(viewerId)).toBe(false);
      expect((await service.authorizedViewerIds(eventId, [viewerId, otherId], { questionId })).has(otherId)).toBe(true);
      // A block against a question author must not suppress unrelated poll updates.
      expect((await service.authorizedViewerIds(eventId, [viewerId])).has(viewerId)).toBe(true);
    },
  );

  it('fails closed for missing questions and unknown events', async () => {
    expect(await service.authorizedViewerIds(eventId, [viewerId], { questionId: randomUUID() })).toEqual(new Set());
    expect(await service.authorizedViewerIds(randomUUID(), [viewerId])).toEqual(new Set());
  });
});

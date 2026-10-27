import { DataSource } from 'typeorm';

import type { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

const url = process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('LocationShareService sweepExpired — PostgreSQL', () => {
  let db: DataSource;
  let service: LocationShareService;

  beforeAll(async () => {
    db = new DataSource({ type: 'postgres', url: url!, synchronize: false, entities: [] });
    await db.initialize();
    await db.query(`
      DROP TABLE IF EXISTS chat_location_sessions;
      CREATE TABLE chat_location_sessions (
        id text PRIMARY KEY,
        conversation_id text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        ends_at timestamptz,
        last_updated_at timestamptz NOT NULL DEFAULT NOW(),
        ended_at timestamptz,
        end_reason text
      );
    `);
    service = new LocationShareService(db, {} as ChatService);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE chat_location_sessions');
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query('DROP TABLE IF EXISTS chat_location_sessions');
      await db.destroy();
    }
  });

  it('closes each eligible row once and preserves expiry precedence', async () => {
    await db.query(`
      INSERT INTO chat_location_sessions
        (id, conversation_id, status, ends_at, last_updated_at)
      VALUES
        ('expired', 'conversation-a', 'active', NOW() - interval '1 minute', NOW()),
        ('timeout', 'conversation-b', 'active', NULL, NOW() - interval '10 minutes'),
        ('both', 'conversation-c', 'active', NOW() - interval '1 minute', NOW() - interval '10 minutes'),
        ('fresh', 'conversation-d', 'active', NOW() + interval '1 hour', NOW());
    `);

    const first = await service.sweepExpired();
    const second = await service.sweepExpired();

    expect(first).toHaveLength(3);
    expect(first.find((row) => row.id === 'expired')?.reason).toBe('expired');
    expect(first.find((row) => row.id === 'timeout')?.reason).toBe('timeout');
    expect(first.find((row) => row.id === 'both')?.reason).toBe('expired');
    expect(second).toEqual([]);

    const rows = (await db.query(
      `SELECT id, status, end_reason
         FROM chat_location_sessions
        ORDER BY id`,
    )) as Array<{ id: string; status: string; end_reason: string | null }>;

    expect(rows).toEqual([
      { id: 'both', status: 'ended', end_reason: 'expired' },
      { id: 'expired', status: 'ended', end_reason: 'expired' },
      { id: 'fresh', status: 'active', end_reason: null },
      { id: 'timeout', status: 'ended', end_reason: 'timeout' },
    ]);
  });

  it('bounds parallel sweep work and never returns duplicate sessions', async () => {
    await db.query(
      `INSERT INTO chat_location_sessions
         (id, conversation_id, status, ends_at, last_updated_at)
       SELECT 'stale-' || n::text,
              'conversation-' || n::text,
              'active',
              NULL,
              NOW() - interval '10 minutes'
         FROM generate_series(1, 250) AS n`,
    );

    const secondDb = new DataSource({ type: 'postgres', url: url!, synchronize: false, entities: [] });
    await secondDb.initialize();
    const secondService = new LocationShareService(secondDb, {} as ChatService);

    try {
      const [left, right] = await Promise.all([
        service.sweepExpired(),
        secondService.sweepExpired(),
      ]);
      const ids = [...left, ...right].map((row) => row.id);

      expect(left.length).toBeLessThanOrEqual(LocationShareService.SWEEP_BATCH_SIZE);
      expect(right.length).toBeLessThanOrEqual(LocationShareService.SWEEP_BATCH_SIZE);
      expect(ids).toHaveLength(250);
      expect(new Set(ids).size).toBe(250);
      await expect(service.sweepExpired()).resolves.toEqual([]);
    } finally {
      await secondDb.destroy();
    }
  });
});

/** Disposable PostgreSQL schema integration. Never supply a production URL. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { TermsService } from './terms.service';

const url = process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('versioned Terms acceptance — PostgreSQL', () => {
  let bootstrap: DataSource;
  let db: DataSource;
  let service: TermsService;
  const schema = `terms_${randomUUID().replaceAll('-', '')}`;
  const id = randomUUID();
  const prev = {
    version: process.env.NEXUS_TERMS_VERSION,
    url: process.env.NEXUS_TERMS_URL,
    enforced: process.env.NEXUS_REQUIRE_UGC_TERMS,
  };

  beforeAll(async () => {
    process.env.NEXUS_TERMS_VERSION = '2026-11-v1';
    process.env.NEXUS_TERMS_URL = 'https://g88-legal.onrender.com/terms';
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    bootstrap = await new DataSource({ type: 'postgres', url, entities: [] }).initialize();
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    db = await new DataSource({
      type: 'postgres', url, entities: [],
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();
    await db.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await db.query('INSERT INTO users (id) VALUES($1)', [id]);
    const migration = readFileSync(join(__dirname, '../../..', 'migrations/0072_ugc_terms_acceptance.sql'), 'utf8');
    await db.query(migration);
    await db.query(migration);
    service = new TermsService(db);
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await bootstrap.destroy();
    }
    for (const [key, value] of [
      ['NEXUS_TERMS_VERSION', prev.version],
      ['NEXUS_TERMS_URL', prev.url],
      ['NEXUS_REQUIRE_UGC_TERMS', prev.enforced],
    ] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it('rejects UGC until affirmative acceptance and then allows it', async () => {
    await expect(service.assertAccepted(id)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'terms.acceptance_required' }),
    });
    const first = await service.accept(id, '2026-11-v1', true, 'mobile');
    const second = await service.accept(id, '2026-11-v1', true, 'web');
    expect(second.acceptedAt).toBe(first.acceptedAt);
    await expect(service.assertAccepted(id)).resolves.toBeUndefined();
    const rows = await db.query<Array<{ channel: string }>>('SELECT channel FROM user_terms_acceptances');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.channel).toBe('mobile');
  });

  it('does not consider old policy acceptance valid when version changes', async () => {
    await service.accept(id, '2026-11-v1', true, 'mobile');
    process.env.NEXUS_TERMS_VERSION = '2026-11-v2';
    try {
      await expect(service.assertAccepted(id)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'terms.acceptance_required', version: '2026-11-v2' }),
      });
    } finally {
      process.env.NEXUS_TERMS_VERSION = '2026-11-v1';
    }
  });

  it('cascades user data deletion', async () => {
    await service.accept(id, '2026-11-v1', true, 'api');
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    expect(await db.query('SELECT * FROM user_terms_acceptances')).toEqual([]);
  });
});

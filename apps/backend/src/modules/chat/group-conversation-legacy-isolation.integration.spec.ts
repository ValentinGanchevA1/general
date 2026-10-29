/**
 * PostgreSQL integration coverage for the P4.G legacy-isolation invariant.
 * Group membership lives only in conversation_members; participant_ids remains
 * a DM compatibility key and must stay empty for groups.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const url =
  process.env.CHAT_MEMBERSHIP_TEST_DATABASE_URL ??
  process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Group conversation legacy participant isolation PostgreSQL integration', () => {
  let db: DataSource;
  let bootstrap: DataSource;
  const schema = `group_isolation_${randomUUID().replaceAll('-', '')}`;

  const userA = randomUUID();
  const userB = randomUUID();
  const userC = randomUUID();
  const legacyGroupId = randomUUID();

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
      CREATE TABLE users (
        id uuid PRIMARY KEY
      );

      CREATE TABLE conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        participant_ids uuid[] NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        last_message_at timestamptz,
        status text NOT NULL DEFAULT 'accepted'
      );
    `);

    await db.query(`INSERT INTO users (id) VALUES ($1), ($2), ($3)`, [userA, userB, userC]);

    const schemaPrep = readFileSync(
      join(__dirname, '../../..', 'migrations/0038_conversation_kind_members.sql'),
      'utf8',
    );
    await db.query(schemaPrep);

    const dmMembershipSync = readFileSync(
      join(__dirname, '../../..', 'migrations/0066_dm_conversation_membership_sync.sql'),
      'utf8',
    );
    await db.query(dmMembershipSync);

    // Model a prep-era group created before 0067. Its normalized rows are the
    // authoritative membership we must preserve while removing the legacy array.
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status, kind, title, created_by)
       VALUES ($1, $2::uuid[], 'accepted', 'group', 'Legacy group', $3)`,
      [legacyGroupId, [userA, userB, userC], userA],
    );
    await db.query(
      `INSERT INTO conversation_members (conversation_id, user_id, role)
       VALUES ($1, $2, 'owner'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [legacyGroupId, userA, userB, userC],
    );

    const groupIsolation = readFileSync(
      join(__dirname, '../../..', 'migrations/0067_group_conversation_legacy_participant_isolation.sql'),
      'utf8',
    );
    await db.query(groupIsolation);
    // Deployment retries must remain safe.
    await db.query(groupIsolation);
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await bootstrap.destroy();
    }
  });

  it('normalizes a legacy group to an empty participant_ids compatibility array', async () => {
    const [row] = await db.query<Array<{ participant_ids: string[] }>>(
      `SELECT participant_ids FROM conversations WHERE id = $1`,
      [legacyGroupId],
    );

    expect(row?.participant_ids).toEqual([]);
  });

  it('preserves authoritative normalized group membership and roles', async () => {
    const rows = await db.query<Array<{ user_id: string; role: string; left_at: Date | null }>>(
      `SELECT user_id, role, left_at
         FROM conversation_members
        WHERE conversation_id = $1
        ORDER BY role DESC, user_id`,
      [legacyGroupId],
    );

    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining([
      { user_id: userA, role: 'owner', left_at: null },
      { user_id: userB, role: 'member', left_at: null },
      { user_id: userC, role: 'member', left_at: null },
    ]));
  });

  it('prevents future group rows from carrying legacy participant arrays', async () => {
    await expect(
      db.query(
        `INSERT INTO conversations (id, participant_ids, status, kind, title, created_by)
         VALUES ($1, $2::uuid[], 'accepted', 'group', 'Invalid group', $3)`,
        [randomUUID(), [userA, userB], userA],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
  });

  it('allows a future group with an empty compatibility array', async () => {
    const conversationId = randomUUID();
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status, kind, title, created_by)
       VALUES ($1, ARRAY[]::uuid[], 'accepted', 'group', 'Normalized group', $2)`,
      [conversationId, userA],
    );

    const [row] = await db.query<Array<{ participant_ids: string[] }>>(
      `SELECT participant_ids FROM conversations WHERE id = $1`,
      [conversationId],
    );
    expect(row?.participant_ids).toEqual([]);
  });

  it('keeps the 0066 DM mirror working for exact two-person DMs', async () => {
    const conversationId = randomUUID();
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status, kind)
       VALUES ($1, $2::uuid[], 'accepted', 'dm')`,
      [conversationId, [userA, userB]],
    );

    const rows = await db.query<Array<{ user_id: string; left_at: Date | null }>>(
      `SELECT user_id, left_at
         FROM conversation_members
        WHERE conversation_id = $1
        ORDER BY user_id`,
      [conversationId],
    );
    expect(rows.map((row) => row.user_id)).toEqual([userA, userB].sort());
    expect(rows.every((row) => row.left_at === null)).toBe(true);
  });

  it('keeps legacy participant-array cleanup from matching normalized groups', async () => {
    const rows = await db.query<Array<{ id: string }>>(
      `SELECT id FROM conversations WHERE $1 = ANY(participant_ids)`,
      [userA],
    );

    expect(rows.some((row) => row.id === legacyGroupId)).toBe(false);
  });
});

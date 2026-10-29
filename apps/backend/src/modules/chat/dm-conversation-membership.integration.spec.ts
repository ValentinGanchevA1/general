/**
 * PostgreSQL integration coverage for normalized conversation membership.
 * CI reuses its disposable PostgreSQL service; local runs may provide the
 * dedicated CHAT_MEMBERSHIP_TEST_DATABASE_URL instead.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const url =
  process.env.CHAT_MEMBERSHIP_TEST_DATABASE_URL ??
  process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Conversation membership PostgreSQL integration', () => {
  let db: DataSource;
  let bootstrap: DataSource;
  const schema = `conversation_members_${randomUUID().replaceAll('-', '')}`;

  const userA = randomUUID();
  const userB = randomUUID();
  const userC = randomUUID();
  const preRepairConversation = randomUUID();
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

    // Simulate a DM created after 0038 but before the repair migration. No
    // normalized member rows exist yet for this conversation.
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status)
       VALUES ($1, $2::uuid[], 'accepted')`,
      [preRepairConversation, [userA, userB]],
    );
    expect(
      await db.query(
        `SELECT user_id FROM conversation_members WHERE conversation_id = $1`,
        [preRepairConversation],
      ),
    ).toEqual([]);

    // Model a prep-era group created before 0067. Group membership already lives
    // in conversation_members and must survive legacy array normalization.
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

    const membershipSync = readFileSync(
      join(__dirname, '../../..', 'migrations/0066_dm_conversation_membership_sync.sql'),
      'utf8',
    );
    await db.query(membershipSync);
    // Release retries must remain safe.
    await db.query(membershipSync);

    const groupIsolation = readFileSync(
      join(__dirname, '../../..', 'migrations/0067_group_conversation_legacy_participant_isolation.sql'),
      'utf8',
    );
    await db.query(groupIsolation);
    // Release retries must remain safe.
    await db.query(groupIsolation);
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await bootstrap.destroy();
    }
  });

  it('repairs DMs created after the original 0038 backfill', async () => {
    const rows = await db.query<Array<{ user_id: string; left_at: Date | null }>>(
      `SELECT user_id, left_at
         FROM conversation_members
        WHERE conversation_id = $1
        ORDER BY user_id`,
      [preRepairConversation],
    );

    expect(rows).toEqual([
      { user_id: [userA, userB].sort()[0], left_at: null },
      { user_id: [userA, userB].sort()[1], left_at: null },
    ]);
  });

  it('atomically mirrors every newly inserted DM pair', async () => {
    const conversationId = randomUUID();
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status)
       VALUES ($1, $2::uuid[], 'accepted')`,
      [conversationId, [userA, userC]],
    );

    const rows = await db.query<Array<{ user_id: string; left_at: Date | null }>>(
      `SELECT user_id, left_at
         FROM conversation_members
        WHERE conversation_id = $1
        ORDER BY user_id`,
      [conversationId],
    );
    expect(rows.map((row) => row.user_id)).toEqual([userA, userC].sort());
    expect(rows.every((row) => row.left_at === null)).toBe(true);
  });

  it('soft-leaves stale DM members and activates the replacement pair on update', async () => {
    const conversationId = randomUUID();
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status)
       VALUES ($1, $2::uuid[], 'accepted')`,
      [conversationId, [userA, userB]],
    );
    await db.query(
      `UPDATE conversations SET participant_ids = $2::uuid[] WHERE id = $1`,
      [conversationId, [userA, userC]],
    );

    const rows = await db.query<Array<{ user_id: string; active: boolean }>>(
      `SELECT user_id, left_at IS NULL AS active
         FROM conversation_members
        WHERE conversation_id = $1
        ORDER BY user_id`,
      [conversationId],
    );
    const activeByUser = new Map(rows.map((row) => [row.user_id, row.active]));
    expect(activeByUser.get(userA)).toBe(true);
    expect(activeByUser.get(userB)).toBe(false);
    expect(activeByUser.get(userC)).toBe(true);
  });

  it('normalizes legacy group participant_ids without changing normalized membership', async () => {
    const [conversation] = await db.query<Array<{ participant_ids: string[] }>>(
      `SELECT participant_ids FROM conversations WHERE id = $1`,
      [legacyGroupId],
    );
    expect(conversation?.participant_ids).toEqual([]);

    const members = await db.query<Array<{ user_id: string; role: string; left_at: Date | null }>>(
      `SELECT user_id, role, left_at
         FROM conversation_members
        WHERE conversation_id = $1`,
      [legacyGroupId],
    );
    expect(members).toEqual(expect.arrayContaining([
      { user_id: userA, role: 'owner', left_at: null },
      { user_id: userB, role: 'member', left_at: null },
      { user_id: userC, role: 'member', left_at: null },
    ]));
  });

  it('does not apply the DM mirror to future normalized group conversations', async () => {
    const conversationId = randomUUID();
    await db.query(
      `INSERT INTO conversations (id, participant_ids, status, kind, title, created_by)
       VALUES ($1, ARRAY[]::uuid[], 'accepted', 'group', 'Test group', $2)`,
      [conversationId, userA],
    );

    expect(
      await db.query(
        `SELECT user_id FROM conversation_members WHERE conversation_id = $1`,
        [conversationId],
      ),
    ).toEqual([]);
  });

  it('fails closed when a future group tries to populate the legacy participant array', async () => {
    await expect(
      db.query(
        `INSERT INTO conversations (id, participant_ids, status, kind, title, created_by)
         VALUES ($1, $2::uuid[], 'accepted', 'group', 'Invalid group', $3)`,
        [randomUUID(), [userA, userB], userA],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
  });

  it('keeps legacy participant-array cleanup from matching normalized groups', async () => {
    const rows = await db.query<Array<{ id: string }>>(
      `SELECT id FROM conversations WHERE $1 = ANY(participant_ids)`,
      [userA],
    );
    expect(rows.some((row) => row.id === legacyGroupId)).toBe(false);
  });

  it('fails closed when a DM row does not contain exactly two participants', async () => {
    await expect(
      db.query(
        `INSERT INTO conversations (id, participant_ids, status)
         VALUES ($1, $2::uuid[], 'accepted')`,
        [randomUUID(), [userA, userB, userC]],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
  });
});

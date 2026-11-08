/**
 * Real PostgreSQL lifecycle on a disposable schema.
 * Never point EVENT_REVIEWS_TEST_DATABASE_URL at production or persistent data.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PersonalLabelsService } from './personal-labels.service';

const url = process.env.EVENT_REVIEWS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Personal Labels: migration and moderation (PostgreSQL)', () => {
  let bootstrap: DataSource;
  let db: DataSource;
  let service: PersonalLabelsService;
  const schema = 'personal_labels_' + randomUUID().replaceAll('-', '');
  const userA = randomUUID();
  const userB = randomUUID();
  const moderator = randomUUID();
  const users = { getPublicProfile: jest.fn().mockResolvedValue({ id: userA }) };
  const priorFlag = process.env.NEXA_PERSONAL_LABELS_ENABLED;

  beforeAll(async () => {
    process.env.NEXA_PERSONAL_LABELS_ENABLED = 'true';
    bootstrap = await new DataSource({ type: 'postgres', url, entities: [] }).initialize();
    await bootstrap.query('CREATE SCHEMA ' + schema);
    db = await new DataSource({
      type: 'postgres', url, entities: [],
      extra: { options: '-c search_path=' + schema + ',public' },
    }).initialize();
    await db.query('CREATE TABLE users (id uuid PRIMARY KEY, deleted_at timestamptz)');
    const sql = readFileSync(
      join(__dirname, '../../..', 'migrations/0072_personal_labels.sql'), 'utf8',
    );
    await db.query(sql);
    await db.query(sql);
    service = new PersonalLabelsService(db, users as never);
  }, 30_000);

  afterAll(async () => {
    if (priorFlag === undefined) delete process.env.NEXA_PERSONAL_LABELS_ENABLED;
    else process.env.NEXA_PERSONAL_LABELS_ENABLED = priorFlag;
    if (db?.isInitialized) await db.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
      await bootstrap.destroy();
    }
  });

  beforeEach(async () => {
    process.env.NEXA_PERSONAL_LABELS_ENABLED = 'true';
    users.getPublicProfile.mockReset().mockResolvedValue({ id: userA });
    await db.query('TRUNCATE personal_label_proposals, user_personal_labels, users CASCADE');
    await db.query(
      "DELETE FROM personal_labels WHERE key NOT IN ('night_owl','sarcastic','good_listener','spontaneous')",
    );
    await db.query('INSERT INTO users (id) VALUES ($1),($2),($3)', [userA, userB, moderator]);
  });

  it('seeds the four agreed bilingual labels and is repeat-safe', async () => {
    const bg = await service.catalog('bg');
    const en = await service.catalog('en');
    expect(bg.items).toHaveLength(4);
    expect(bg.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'night_owl', label: 'Нощна сова' }),
    ]));
    expect(en.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'good_listener', label: 'Good listener' }),
    ]));
  });

  it('enforces 0–5 selections, active labels and stable ordering', async () => {
    const result = await service.setMine(userA, {
      keys: ['night_owl', 'spontaneous', 'good_listener', 'sarcastic'],
    });
    expect(result.items.map(item => item.key)).toEqual([
      'night_owl', 'spontaneous', 'good_listener', 'sarcastic',
    ]);
    await expect(service.setMine(userA, { keys: ['not_approved'] }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect((await service.myLabels(userA)).items).toHaveLength(4);
    await expect(service.setMine(userA, { keys: [] })).resolves.toEqual({ items: [] });
    await expect(db.query(
      'INSERT INTO user_personal_labels (user_id,label_key,position) VALUES ($1,$2,5)',
      [userA, 'night_owl'],
    )).rejects.toMatchObject({ driverError: { code: '23514' } });
  });

  it('keeps pending proposals private and prevents duplicates', async () => {
    const submitted = await service.submit(userA, { text: '  Deep    thinker ', locale: 'en' });
    expect(submitted).toMatchObject({ status: 'pending', text: 'Deep thinker' });
    expect((await service.catalog()).items).toHaveLength(4);
    expect((await service.myProposals(userA)).items).toHaveLength(1);
    expect((await service.myProposals(userB)).items).toHaveLength(0);
    await expect(service.submit(userB, { text: 'deep thinker', locale: 'en' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect((await service.queue({ status: 'pending' })).items).toHaveLength(1);
  });

  it('publishes only after human bilingual approval; prevents double decisions', async () => {
    const proposal = await service.submit(userA, { text: 'Deep thinker', locale: 'en' });
    expect(await service.review(moderator, proposal.id, {
      decision: 'approve', key: 'deep_thinker',
      labelBg: 'Дълбок мислител', labelEn: 'Deep thinker', category: 'character',
    })).toEqual({ status: 'approved', key: 'deep_thinker' });
    expect((await service.catalog('bg')).items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'deep_thinker', label: 'Дълбок мислител' }),
    ]));
    await expect(service.review(moderator, proposal.id, { decision: 'reject' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect((await service.setMine(userB, { keys: ['deep_thinker'] })).items[0]?.key)
      .toBe('deep_thinker');
  });

  it('merges duplicates without a new catalog entry', async () => {
    const proposal = await service.submit(userA, { text: 'Late night person', locale: 'en' });
    await expect(service.review(moderator, proposal.id, {
      decision: 'merge', existingKey: 'night_owl',
    })).resolves.toEqual({ status: 'merged', key: 'night_owl' });
    expect((await service.catalog()).items).toHaveLength(4);
  });

  it('rolls back conflicting labels; cannot select inactive ones', async () => {
    const proposal = await service.submit(userA, { text: 'Different text', locale: 'en' });
    await expect(service.review(moderator, proposal.id, {
      decision: 'approve', key: 'other_key', labelBg: 'Нощна сова',
      labelEn: 'Different text', category: 'rhythm',
    })).rejects.toMatchObject({ driverError: { code: '23505' } });
    expect((await service.queue({ status: 'pending' })).items).toHaveLength(1);
    await db.query("UPDATE personal_labels SET active=false WHERE key='night_owl'");
    await expect(service.setMine(userA, { keys: ['night_owl'] }))
      .rejects.toBeInstanceOf(BadRequestException);
    await db.query("UPDATE personal_labels SET active=true WHERE key='night_owl'");
  });

  it('cascades proposals and selected labels on account deletion', async () => {
    await service.setMine(userA, { keys: ['night_owl'] });
    await service.submit(userA, { text: 'Deep thinker', locale: 'en' });
    await db.query('DELETE FROM users WHERE id=$1', [userA]);
    expect(await db.query('SELECT id FROM personal_label_proposals WHERE user_id=$1', [userA]))
      .toEqual([]);
    expect(await db.query('SELECT user_id FROM user_personal_labels WHERE user_id=$1', [userA]))
      .toEqual([]);
  });

  it('reuses public profile privacy checks', async () => {
    await service.setMine(userA, { keys: ['night_owl'] });
    users.getPublicProfile.mockRejectedValueOnce(new NotFoundException('Blocked or private'));
    await expect(service.publicLabels(userA, userB)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.publicLabels(userA, userB)).items[0]?.key).toBe('night_owl');
  });
});
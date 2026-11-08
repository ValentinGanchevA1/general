import {
  BadRequestException, ConflictException, HttpException, NotFoundException,
} from '@nestjs/common';
import { PersonalLabelsService } from './personal-labels.service';

describe('PersonalLabelsService', () => {
  const original = process.env.NEXA_PERSONAL_LABELS_ENABLED;
  const owner = '11111111-1111-4111-8111-111111111111';
  const admin = '22222222-2222-4222-8222-222222222222';
  const proposalId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => { process.env.NEXA_PERSONAL_LABELS_ENABLED = 'true'; });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXA_PERSONAL_LABELS_ENABLED;
    else process.env.NEXA_PERSONAL_LABELS_ENABLED = original;
  });

  const make = () => {
    const query = jest.fn();
    const transaction = jest.fn(async (fn: (tx: { query: typeof query }) => Promise<unknown>) => fn({ query }));
    const db = { query, transaction };
    const users = { getPublicProfile: jest.fn().mockResolvedValue({ id: owner }) };
    const service = new PersonalLabelsService(db as never, users as never);
    return { query, transaction, users, service };
  };
  const row = {
    id: proposalId, user_id: owner, proposed_text: 'Deep thinker',
    locale: 'en', status: 'pending', reviewed_at: null, reviewed_by: null,
    review_note: null, created_at: new Date('2026-11-08T00:00:00Z'),
  };

  it('fails closed without server flag before accessing the database', async () => {
    delete process.env.NEXA_PERSONAL_LABELS_ENABLED;
    const { query, service } = make();
    await expect(service.catalog()).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.myLabels(owner)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.submit(owner, { text: 'Deep thinker', locale: 'en' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
  });

  it('serves only active localised labels', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ key: 'night_owl', label: 'Нощна сова', category: 'rhythm', emoji: '🌙' }]);
    await expect(service.catalog('bg')).resolves.toEqual({
      items: [{ key: 'night_owl', label: 'Нощна сова', category: 'rhythm', emoji: '🌙' }],
      maxSelected: 5,
    });
    expect(query.mock.calls[0]?.[0]).toContain('active = true');
    expect(query.mock.calls[0]?.[0]).toContain('label_bg');
  });

  it('rejects duplicate or excessive selections before any mutation', async () => {
    const { query, service } = make();
    await expect(service.setMine(owner, { keys: ['night_owl', 'night_owl'] }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setMine(owner, { keys: ['a', 'b', 'c', 'd', 'e', 'f'] }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('serializes selection changes and only permits approved keys', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ id: owner }]).mockResolvedValueOnce([]);
    await expect(service.setMine(owner, { keys: ['night_owl'] }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls[0]?.[0]).toContain('FOR UPDATE');
    expect(query.mock.calls.find((call: unknown[]) => String(call[0]).includes('DELETE FROM user_personal_labels')))
      .toBeUndefined();
  });

  it('rejects an over-quota suggestion without insertion', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ id: owner }]).mockResolvedValueOnce([{ n: '3' }]);
    await expect(service.submit(owner, { text: 'Deep thinker', locale: 'en' }))
      .rejects.toBeInstanceOf(HttpException);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('stores a normalized proposal privately, not in the public catalog', async () => {
    const { query, service } = make();
    query
      .mockResolvedValueOnce([{ id: owner }])
      .mockResolvedValueOnce([{ n: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row]);
    await expect(service.submit(owner, { text: '  Deep   thinker ', locale: 'en' }))
      .resolves.toMatchObject({ text: 'Deep thinker', status: 'pending' });
    expect(query.mock.calls[3]?.[1]).toEqual([owner, 'Deep thinker', 'deep thinker', 'en']);
  });

  it('prevents reviewing an already processed suggestion', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ ...row, status: 'approved' }]);
    await expect(service.review(admin, proposalId, { decision: 'reject' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('publishes only inside a moderator transaction', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(service.review(admin, proposalId, {
      decision: 'approve', key: 'deep_thinker', labelBg: 'Дълбок мислител',
      labelEn: 'Deep thinker', category: 'character',
    })).resolves.toEqual({ status: 'approved', key: 'deep_thinker' });
    expect(query.mock.calls[0]?.[0]).toContain('FOR UPDATE');
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO personal_labels');
    expect(query.mock.calls[2]?.[0]).toContain('UPDATE personal_label_proposals');
  });

  it('reuses canonical public profile privacy checks', async () => {
    const { query, service, users } = make();
    users.getPublicProfile.mockRejectedValueOnce(new NotFoundException('Hidden'));
    await expect(service.publicLabels(owner, admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
  });
});

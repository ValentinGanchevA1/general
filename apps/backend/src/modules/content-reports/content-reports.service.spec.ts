import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContentReportsService } from './content-reports.service';

describe('ContentReportsService', () => {
  const reporter = '11111111-1111-4111-8111-111111111111';
  const target = '22222222-2222-4222-8222-222222222222';
  const admin = '33333333-3333-4333-8333-333333333333';

  const make = () => {
    const query = jest.fn();
    const transaction = jest.fn(async (fn: (tx: { query: typeof query }) => Promise<unknown>) => fn({ query }));
    const db = { query, transaction };
    const service = new ContentReportsService(db as never);
    return { query, transaction, service };
  };

  it('persists a validated user report after confirming a live target', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ id: target }]).mockResolvedValueOnce([]);
    await expect(service.submit(reporter, { targetType: 'user', targetId: target, reason: 'spam' }))
      .resolves.toEqual({ reported: true });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain('ON CONFLICT (reporter_id,target_type,target_id) DO NOTHING');
    expect(query.mock.calls[1]?.[1]).toEqual([reporter, 'user', target, 'spam']);
  });

  it('fails closed when a story is no longer available', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([]);
    await expect(service.submit(reporter, { targetType: 'story', targetId: target, reason: 'privacy' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('hides reported stories in the same admin transaction as resolution', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ target_type: 'story', target_id: target, status: 'open' }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(service.decide(admin, target, { decision: 'hide_story', note: 'Unsafe content.' }))
      .resolves.toEqual({ status: 'hidden' });
    expect(query.mock.calls[1]?.[0]).toContain('UPDATE stories SET deleted_at');
    expect(query.mock.calls[2]?.[1]).toEqual([target, 'hidden', admin, 'Unsafe content.']);
  });

  it('rejects story hide operations on user reports', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ target_type: 'user', target_id: target, status: 'open' }]);
    await expect(service.decide(admin, target, { decision: 'hide_story' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('prevents double administrative handling', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([{ target_type: 'story', target_id: target, status: 'dismissed' }]);
    await expect(service.decide(admin, target, { decision: 'review' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('only returns bounded queue entries', async () => {
    const { query, service } = make();
    query.mockResolvedValueOnce([]);
    await expect(service.list({ limit: 10, offset: 0 })).resolves.toEqual({ items: [], nextOffset: null });
    expect(query.mock.calls[0]?.[1]).toEqual(['open', 11, 0]);
  });
});

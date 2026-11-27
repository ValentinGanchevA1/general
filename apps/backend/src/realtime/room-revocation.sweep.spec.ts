import type { DataSource } from 'typeorm';
import { ChatRealtimeAccessService } from '../modules/chat/chat-realtime-access.service';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { RoomRevocationSweepService } from './room-revocation.sweep';

const item = {
  id: '42',
  conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  attempts: 1,
};

describe('RoomRevocationSweepService', () => {
  const query = jest.fn();
  const evictAndVerify = jest.fn();
  const getRecipientIds = jest.fn();
  const worker = new RoomRevocationSweepService(
    { query } as unknown as DataSource,
    { evictAndVerify } as unknown as RealtimeEmitterService,
    { getRecipientIds } as unknown as ChatRealtimeAccessService,
  );

  beforeEach(() => {
    query.mockReset().mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
    evictAndVerify.mockReset().mockResolvedValue(true);
    getRecipientIds.mockReset().mockResolvedValue([]);
  });

  it('claims with a lease and completes only after verification', async () => {
    await worker.runOnce();
    expect(query.mock.calls[0]?.[0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[0]?.[0]).toContain('LIMIT 16');
    // TypeORM DataSource.query returns [rows, count] for UPDATE RETURNING.
    // The outer SELECT forces the expected rows-only response shape.
    expect(query.mock.calls[0]?.[0]).toContain(
      'SELECT id, "conversationId", "userId", attempts FROM claimed',
    );
    expect(evictAndVerify).toHaveBeenCalledWith(item.userId, `convo:${item.conversationId}`);
    expect(query.mock.calls[1]?.[0]).toContain('SET completed_at = NOW()');
    expect(query.mock.calls[1]?.[1]).toEqual([item.id, item.attempts]);
  });

  it('retries synchronous Redis eviction errors without marking completed', async () => {
    evictAndVerify.mockRejectedValueOnce(new Error('Redis unavailable'));
    await worker.runOnce();
    expect(query.mock.calls[1]?.[0]).toContain('SET available_at = NOW()');
    expect(query.mock.calls[1]?.[1]).toEqual([item.id, item.attempts, 2]);
  });

  it('retries a failed cross-node verification', async () => {
    evictAndVerify.mockResolvedValueOnce(false);
    await worker.runOnce();
    expect(query.mock.calls[1]?.[0]).toContain('SET available_at = NOW()');
  });

  it('does not evict a user whose authorization was restored', async () => {
    getRecipientIds.mockResolvedValueOnce([item.userId]);
    await worker.runOnce();
    expect(evictAndVerify).not.toHaveBeenCalled();
    expect(query.mock.calls[1]?.[0]).toContain('SET completed_at = NOW()');
  });

  it('caps exponential retry intervals without discarding privacy tasks', async () => {
    query.mockReset().mockResolvedValueOnce([{ ...item, attempts: 100 }])
      .mockResolvedValueOnce([]);
    evictAndVerify.mockRejectedValueOnce(new Error('Redis unavailable'));
    await worker.runOnce();
    expect(query.mock.calls[1]?.[1]).toEqual([item.id, 100, 256]);
  });
});

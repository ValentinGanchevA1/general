import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DatingService } from './dating.service';

describe('DatingService release gate', () => {
  const original = process.env.NEXUS_DATING_ENABLED;
  let service: DatingService;
  let query: jest.Mock;
  let transaction: jest.Mock;
  let isBlocked: jest.Mock;

  beforeEach(() => {
    delete process.env.NEXUS_DATING_ENABLED;
    query = jest.fn();
    transaction = jest.fn();
    isBlocked = jest.fn();
    service = new DatingService(
      { query, transaction } as unknown as DataSource,
      {} as never,
      { isBlocked } as never,
    );
  });

  afterAll(() => {
    if (original === undefined) delete process.env.NEXUS_DATING_ENABLED;
    else process.env.NEXUS_DATING_ENABLED = original;
  });

  it('blocks like before any DB or block lookup when disabled', async () => {
    await expect(service.like('user-a', { toUserId: 'user-b' })).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(isBlocked).not.toHaveBeenCalled();
  });

  it('blocks pass before any DB write when disabled', async () => {
    await expect(service.pass('user-a', 'user-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
    expect(isBlocked).not.toHaveBeenCalled();
  });

  it('allows service entry only after an explicit server opt-in', async () => {
    process.env.NEXUS_DATING_ENABLED = 'true';
    isBlocked.mockResolvedValue(true);
    await expect(service.like('user-a', { toUserId: 'user-b' })).rejects.toMatchObject({
      response: { code: 'dating.like.blocked' },
    });
    expect(isBlocked).toHaveBeenCalledTimes(1);
  });
});

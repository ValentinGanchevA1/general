import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DatingService } from './dating.service';

describe('DatingService release gate', () => {
  const originalEnabled = process.env.NEXUS_DATING_ENABLED;
  const originalApproval = process.env.NEXUS_DATING_RC1_APPROVED;
  let service: DatingService;
  let query: jest.Mock;
  let transaction: jest.Mock;
  let isBlocked: jest.Mock;

  beforeEach(() => {
    delete process.env.NEXUS_DATING_ENABLED;
    delete process.env.NEXUS_DATING_RC1_APPROVED;
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
    if (originalEnabled === undefined) delete process.env.NEXUS_DATING_ENABLED;
    else process.env.NEXUS_DATING_ENABLED = originalEnabled;
    if (originalApproval === undefined) delete process.env.NEXUS_DATING_RC1_APPROVED;
    else process.env.NEXUS_DATING_RC1_APPROVED = originalApproval;
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

  it('does not enable Dating from the legacy flag alone', async () => {
    process.env.NEXUS_DATING_ENABLED = 'true';
    await expect(service.like('user-a', { toUserId: 'user-b' })).rejects.toBeInstanceOf(NotFoundException);
    expect(isBlocked).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows service entry only after an explicit server opt-in', async () => {
    process.env.NEXUS_DATING_ENABLED = 'true';
    process.env.NEXUS_DATING_RC1_APPROVED = 'true';
    isBlocked.mockResolvedValue(true);
    await expect(service.like('user-a', { toUserId: 'user-b' })).rejects.toMatchObject({
      response: { code: 'dating.like.blocked' },
    });
    expect(isBlocked).toHaveBeenCalledTimes(1);
  });
});

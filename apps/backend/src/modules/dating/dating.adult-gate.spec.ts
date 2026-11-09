import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BlocksService } from '../blocks/blocks.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { DatingService } from './dating.service';

describe('DatingService adult-eligibility guard', () => {
  const sender = '11111111-1111-4111-8111-111111111111';
  const peer = '22222222-2222-4222-8222-222222222222';

  // Adult eligibility must be tested independently from the RC1 release hold.
  const originalDatingFlag = process.env.NEXUS_DATING_RELEASE_ENABLED;
  beforeAll(() => { process.env.NEXUS_DATING_RELEASE_ENABLED = 'true'; });
  afterAll(() => {
    if (originalDatingFlag === undefined) delete process.env.NEXUS_DATING_RELEASE_ENABLED;
    else process.env.NEXUS_DATING_RELEASE_ENABLED = originalDatingFlag;
  });

  const setup = () => {
    const query = jest.fn();
    const transaction = jest.fn();
    const isBlocked = jest.fn().mockResolvedValue(false);
    const service = new DatingService(
      { query, transaction } as unknown as DataSource,
      {} as RealtimeGateway,
      { isBlocked } as unknown as BlocksService,
    );
    return { query, transaction, isBlocked, service };
  };

  it('denies a dating like when either adult DOB is missing or underage', async () => {
    const { query, transaction, service } = setup();
    query.mockResolvedValueOnce([
      { id: sender, open_to_dating: true, adult: true, display_name: 'Sender', avatar_url: null },
      { id: peer, open_to_dating: true, adult: false, display_name: 'Peer', avatar_url: null },
    ]);
    await expect(service.like(sender, { toUserId: peer }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls[0]?.[0]).toContain('date_of_birth');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('denies a dating pass when the backend cannot verify both participants as adults', async () => {
    const { query, service } = setup();
    query.mockResolvedValueOnce([{ eligible: false }]);
    await expect(service.pass(sender, peer)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("INTERVAL '18 years'");
  });
});

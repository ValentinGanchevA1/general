import { ForbiddenException } from '@nestjs/common';
import { DatingService } from './dating.service';
import { assertDatingReleaseEnabled, isDatingReleaseEnabled } from './dating-release-gate';

describe('Dating release gate', () => {
  const initial = process.env.NEXUS_DATING_RELEASE_ENABLED;
  afterAll(() => {
    if (initial === undefined) delete process.env.NEXUS_DATING_RELEASE_ENABLED;
    else process.env.NEXUS_DATING_RELEASE_ENABLED = initial;
  });

  it('defaults to denied, including for self-declared adult profiles', () => {
    delete process.env.NEXUS_DATING_RELEASE_ENABLED;
    expect(isDatingReleaseEnabled()).toBe(false);
    expect(assertDatingReleaseEnabled).toThrow(ForbiddenException);
    process.env.NEXUS_DATING_RELEASE_ENABLED = 'false';
    expect(isDatingReleaseEnabled()).toBe(false);
    process.env.NEXUS_DATING_RELEASE_ENABLED = 'TRUE';
    expect(isDatingReleaseEnabled()).toBe(false);
  });

  it('requires an explicit exactly-true operations setting', () => {
    process.env.NEXUS_DATING_RELEASE_ENABLED = 'true';
    expect(isDatingReleaseEnabled()).toBe(true);
    expect(assertDatingReleaseEnabled).not.toThrow();
  });

  it('blocks Dating likes and passes before block checks, SQL or realtime calls', async () => {
    delete process.env.NEXUS_DATING_RELEASE_ENABLED;
    const db = { query: jest.fn(), transaction: jest.fn() };
    const blocks = { isBlocked: jest.fn() };
    const realtime = { emitDatingLikeReceived: jest.fn() };
    const service = new DatingService(db as never, realtime as never, blocks as never);
    const adultId = '11111111-1111-4111-8111-111111111111';
    const otherId = '22222222-2222-4222-8222-222222222222';
    await expect(service.like(adultId, { toUserId: otherId })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'dating.release_disabled' }),
    });
    await expect(service.pass(adultId, otherId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'dating.release_disabled' }),
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(blocks.isBlocked).not.toHaveBeenCalled();
  });
});

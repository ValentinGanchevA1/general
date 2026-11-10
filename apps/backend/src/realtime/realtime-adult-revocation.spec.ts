import 'reflect-metadata';

import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway — idle outbound socket eligibility sweep', () => {
  const flag = 'NEXUS_REQUIRE_ADULT_AGE';
  const initial = process.env[flag];

  function mockSocket(id: string, userId?: string) {
    return {
      id,
      data: { userId },
      disconnect: jest.fn(),
    };
  }

  function setup(sockets: ReturnType<typeof mockSocket>[]) {
    const local = {
      fetchSockets: jest.fn().mockResolvedValue(sockets),
      disconnectSockets: jest.fn(),
    };
    const adultEligibility = {
      eligibleUserIds: jest.fn().mockResolvedValue(new Set(['adult-user'])),
    };
    const logger = { error: jest.fn() };
    // Keep the declared class type; Object.assign's inferred intersection
    // with the private logger field would otherwise become 'never'.
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    Object.assign(gateway, {
      server: { local },
      adultEligibility,
      logger,
      ageSweepRunning: false,
      ageSweepTimer: null,
    });
    return { gateway, local, adultEligibility, logger };
  }

  beforeEach(() => {
    process.env[flag] = 'true';
  });

  afterAll(() => {
    if (initial === undefined) delete process.env[flag];
    else process.env[flag] = initial;
  });

  it('evicts an idle ineligible recipient without waiting for another inbound event', async () => {
    const adult = mockSocket('s1', 'adult-user');
    const revoked = mockSocket('s2', 'revoked-user');
    const missing = mockSocket('s3');
    const { gateway, adultEligibility, local } = setup([adult, revoked, missing]);

    await gateway.sweepAdultSockets();

    expect(adultEligibility.eligibleUserIds).toHaveBeenCalledWith(['adult-user', 'revoked-user']);
    expect(adult.disconnect).not.toHaveBeenCalled();
    expect(revoked.disconnect).toHaveBeenCalledWith(true);
    expect(missing.disconnect).toHaveBeenCalledWith(true);
    expect(local.disconnectSockets).not.toHaveBeenCalled();
  });

  it('disconnects every local socket if the eligibility database is unavailable', async () => {
    const { gateway, adultEligibility, local } = setup([mockSocket('s1', 'adult-user')]);
    adultEligibility.eligibleUserIds.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(gateway.sweepAdultSockets()).resolves.toBeUndefined();

    expect(local.disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('disconnects on a socket adapter read failure', async () => {
    const { gateway, local } = setup([]);
    local.fetchSockets.mockRejectedValueOnce(new Error('adapter failure'));

    await gateway.sweepAdultSockets();

    expect(local.disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('does not hit PostgreSQL when no sockets are connected', async () => {
    const { gateway, adultEligibility } = setup([]);

    await gateway.sweepAdultSockets();

    expect(adultEligibility.eligibleUserIds).not.toHaveBeenCalled();
  });

  it('does not sweep when adult eligibility is disabled', async () => {
    delete process.env[flag];
    const { gateway, local, adultEligibility } = setup([mockSocket('s1', 'revoked-user')]);

    await gateway.sweepAdultSockets();

    expect(local.fetchSockets).not.toHaveBeenCalled();
    expect(adultEligibility.eligibleUserIds).not.toHaveBeenCalled();
  });

  it('does not overlap sweeps when a query is still in flight', async () => {
    const { gateway, local, adultEligibility } = setup([mockSocket('s1', 'adult-user')]);
    let resolveEligibility: ((users: Set<string>) => void) | undefined;
    adultEligibility.eligibleUserIds.mockImplementationOnce(
      () => new Promise<Set<string>>((resolve) => { resolveEligibility = resolve; }),
    );

    const first = gateway.sweepAdultSockets();
    await Promise.resolve();
    await Promise.resolve();
    await gateway.sweepAdultSockets();

    expect(local.fetchSockets).toHaveBeenCalledTimes(1);
    expect(adultEligibility.eligibleUserIds).toHaveBeenCalledTimes(1);

    resolveEligibility?.(new Set(['adult-user']));
    await first;
  });

  it('never starts an eligibility interval when the release flag is OFF', () => {
    delete process.env[flag];
    const { gateway } = setup([]);
    const timer = jest.spyOn(global, 'setInterval');
    try {
      gateway.afterInit();
      expect(timer).not.toHaveBeenCalled();
    } finally {
      gateway.onModuleDestroy();
      timer.mockRestore();
    }
  });

  it('starts a bounded periodic sweep only when enabled and clears it on destroy', () => {
    const { gateway } = setup([]);
    const timer = jest.spyOn(global, 'setInterval');
    const clear = jest.spyOn(global, 'clearInterval');
    try {
      gateway.afterInit();
      expect(timer).toHaveBeenCalledWith(expect.any(Function), 10_000);
      gateway.onModuleDestroy();
      expect(clear).toHaveBeenCalled();
    } finally {
      gateway.onModuleDestroy();
      timer.mockRestore();
      clear.mockRestore();
    }
  });
});

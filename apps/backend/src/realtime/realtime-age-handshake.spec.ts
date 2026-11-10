import 'reflect-metadata';
import { JwtService } from '@nestjs/jwt';

import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway — age checked before joining rooms', () => {
  const key = 'NEXUS_REQUIRE_ADULT_AGE';
  const initial = process.env[key];

  const jwt = {
    verify: jest.fn(() => ({ sub: 'user-1', email: 'test@example.test' })),
  };
  const eligibility = {
    assertEligible: jest.fn<Promise<void>, [string]>(),
  };
  const logger = { log: jest.fn() };

  function gateway(): RealtimeGateway {
    // Isolate handleConnection without constructing unrelated chat/event services.
    return Object.assign(Object.create(RealtimeGateway.prototype) as RealtimeGateway, {
      jwt: jwt as unknown as JwtService,
      adultEligibility: eligibility,
      logger,
    });
  }

  function socket() {
    return {
      id: 'sid-1',
      handshake: { auth: { token: 'valid-token' } },
      data: { userId: '', rooms: new Set<string>() },
      disconnect: jest.fn(),
      join: jest.fn(),
    };
  }

  beforeEach(() => {
    process.env[key] = 'true';
    jwt.verify.mockReset().mockReturnValue({ sub: 'user-1', email: 'test@example.test' });
    eligibility.assertEligible.mockReset().mockResolvedValue(undefined);
    logger.log.mockClear();
  });

  afterAll(() => {
    if (initial === undefined) delete process.env[key];
    else process.env[key] = initial;
  });

  it('blocks unknown DOB before user-room join', async () => {
    eligibility.assertEligible.mockRejectedValueOnce(new Error('age missing'));
    const client = socket();
    await gateway().handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
    expect(eligibility.assertEligible).toHaveBeenCalledWith('user-1');
  });

  it('does not join a room if the age database is unavailable', async () => {
    eligibility.assertEligible.mockRejectedValueOnce(new Error('database unavailable'));
    const client = socket();
    await gateway().handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('joins the authenticated user room only after eligibility succeeds', async () => {
    const client = socket();
    await gateway().handleConnection(client as never);
    expect(eligibility.assertEligible).toHaveBeenCalledWith('user-1');
    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('keeps prior behavior when the adult flag is disabled', async () => {
    delete process.env[key];
    const client = socket();
    await gateway().handleConnection(client as never);
    expect(eligibility.assertEligible).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('user:user-1');
  });

  it('disconnects invalid JWTs before accessing age eligibility', async () => {
    jwt.verify.mockImplementationOnce(() => { throw new Error('invalid token'); });
    const client = socket();
    await gateway().handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(eligibility.assertEligible).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });
});

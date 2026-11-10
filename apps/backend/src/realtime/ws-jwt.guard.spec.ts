import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AdultEligibilityService } from '../modules/auth/adult-eligibility.service';
import { WsJwtGuard } from './ws-jwt.guard';

describe('WsJwtGuard — adult eligibility on every event', () => {
  let verify: jest.Mock;
  let eligibility: jest.Mock;
  let disconnect: jest.Mock;
  let data: { userId?: string };
  let guard: WsJwtGuard;

  function context(token?: string): ExecutionContext {
    return {
      switchToWs: () => ({
        getClient: () => ({
          handshake: { auth: { token } },
          data,
          disconnect,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    verify = jest.fn().mockReturnValue({ sub: 'user-1', email: 'test@example.test' });
    eligibility = jest.fn().mockResolvedValue(undefined);
    disconnect = jest.fn();
    data = {};
    guard = new WsJwtGuard(
      { verify } as unknown as JwtService,
      { assertEligible: eligibility } as unknown as AdultEligibilityService,
    );
  });

  it('rejects missing bearer token without a database read', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(false);
    expect(disconnect).toHaveBeenCalledWith(true);
    expect(eligibility).not.toHaveBeenCalled();
  });

  it('revalidates eligible DOB every time, even for an existing socket', async () => {
    await expect(guard.canActivate(context('valid-token'))).resolves.toBe(true);
    await expect(guard.canActivate(context('valid-token'))).resolves.toBe(true);
    expect(eligibility).toHaveBeenCalledTimes(2);
    expect(eligibility).toHaveBeenCalledWith('user-1');
    expect(data.userId).toBe('user-1');
  });

  it('disconnects an already authorized socket when DOB is revoked', async () => {
    await expect(guard.canActivate(context('token'))).resolves.toBe(true);
    eligibility.mockRejectedValueOnce(new Error('age missing'));
    await expect(guard.canActivate(context('token'))).resolves.toBe(false);
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('fails closed on unavailable eligibility database', async () => {
    eligibility.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(guard.canActivate(context('token'))).resolves.toBe(false);
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects malformed payloads and expired tokens before the DB lookup', async () => {
    verify.mockReturnValueOnce({ email: 'test@example.test' })
      .mockImplementationOnce(() => { throw new Error('jwt expired'); });
    await expect(guard.canActivate(context('bad-payload'))).resolves.toBe(false);
    await expect(guard.canActivate(context('expired-token'))).resolves.toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(eligibility).not.toHaveBeenCalled();
  });
});

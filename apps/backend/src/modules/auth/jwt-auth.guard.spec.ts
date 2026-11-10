import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { SkipAdultEligibility } from './age-eligibility.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class AuthenticatedController {
  social(): void {}

  @SkipAdultEligibility()
  completeAge(): void {}
}

describe('JwtAuthGuard — adult eligibility', () => {
  const flag = 'NEXUS_REQUIRE_ADULT_AGE';
  const initial = process.env[flag];
  const controller = new AuthenticatedController();
  const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
    canActivate: (context: ExecutionContext) => Promise<boolean>;
  };
  let authStub: jest.SpyInstance;
  let query: jest.Mock;
  let guard: JwtAuthGuard;

  function context(method: 'social' | 'completeAge', id?: string): ExecutionContext {
    return {
      getHandler: () => controller[method],
      getClass: () => AuthenticatedController,
      switchToHttp: () => ({
        getRequest: () => ({ user: id ? { id } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    process.env[flag] = 'true';
    authStub = jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    query = jest.fn().mockResolvedValue([{ eligible: true }]);
    guard = new JwtAuthGuard(
      { query } as unknown as DataSource,
      new Reflector(),
    );
  });

  afterEach(() => {
    authStub.mockRestore();
    if (initial === undefined) delete process.env[flag];
    else process.env[flag] = initial;
  });

  it('checks database eligibility on ordinary authenticated routes', async () => {
    await expect(guard.canActivate(context('social', 'user-1'))).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('date_of_birth IS NOT NULL'),
      ['user-1'],
    );
  });

  it('exempts only annotated safe bootstrap routes', async () => {
    await expect(guard.canActivate(context('completeAge', 'user-1'))).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a valid token when the stored user has no eligible DOB', async () => {
    query.mockResolvedValueOnce([{ eligible: false }]);
    await expect(guard.canActivate(context('social', 'user-1')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not let an unauthorized JWT bypass the age gate', async () => {
    authStub.mockResolvedValueOnce(false);
    await expect(guard.canActivate(context('social', 'user-1'))).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('fails closed when the eligibility database query fails', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(guard.canActivate(context('social', 'user-1')))
      .rejects.toThrow('database unavailable');
  });
});

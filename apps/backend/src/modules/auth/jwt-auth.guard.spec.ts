import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdultEligibilityService } from './adult-eligibility.service';
import { SkipAdultEligibility } from './age-eligibility.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class AuthenticatedController {
  social(): void {}

  @SkipAdultEligibility()
  completeAge(): void {}
}

describe('JwtAuthGuard — adult eligibility', () => {
  const controller = new AuthenticatedController();
  const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
    canActivate: (context: ExecutionContext) => Promise<boolean>;
  };
  let authStub: jest.SpyInstance;
  let eligibility: { assertEligible: jest.Mock };
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
    authStub = jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    eligibility = { assertEligible: jest.fn().mockResolvedValue(undefined) };
    guard = new JwtAuthGuard(
      eligibility as unknown as AdultEligibilityService,
      new Reflector(),
    );
  });

  afterEach(() => {
    authStub.mockRestore();
  });

  it('checks database-backed eligibility on ordinary authenticated routes', async () => {
    await expect(guard.canActivate(context('social', 'user-1'))).resolves.toBe(true);
    expect(eligibility.assertEligible).toHaveBeenCalledWith('user-1');
  });

  it('allows only explicitly annotated bootstrap routes without adult eligibility', async () => {
    await expect(guard.canActivate(context('completeAge', 'user-1'))).resolves.toBe(true);
    expect(eligibility.assertEligible).not.toHaveBeenCalled();
  });

  it('does not let an unauthorized JWT bypass age eligibility', async () => {
    authStub.mockResolvedValueOnce(false);
    await expect(guard.canActivate(context('social', 'user-1'))).resolves.toBe(false);
    expect(eligibility.assertEligible).not.toHaveBeenCalled();
  });
});

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { RequireCurrentTerms } from './require-terms.decorator';
import { TermsInterceptor } from './terms.interceptor';
import { TermsService } from './terms.service';

class SampleController {
  @RequireCurrentTerms() publish() { return undefined; }
  browse() { return undefined; }
}

describe('TermsInterceptor', () => {
  const assertAccepted = jest.fn();
  const interceptor = new TermsInterceptor(
    new Reflector(), { assertAccepted } as unknown as TermsService,
  );
  const next = { handle: jest.fn(() => of('saved')) };
  const ctx = (method: 'publish' | 'browse', userId?: string): ExecutionContext => ({
    getHandler: () => SampleController.prototype[method],
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => ({ user: userId ? { id: userId } : undefined }) }),
  } as unknown as ExecutionContext);

  beforeEach(() => { jest.clearAllMocks(); assertAccepted.mockResolvedValue(undefined); });

  it('permits read-only browse without requiring Terms', async () => {
    await expect(lastValueFrom(interceptor.intercept(ctx('browse'), next))).resolves.toBe('saved');
    expect(assertAccepted).not.toHaveBeenCalled();
  });

  it('blocks UGC before controller invocation when no JWT user is present', () => {
    expect(() => interceptor.intercept(ctx('publish'), next)).toThrow(UnauthorizedException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('checks the authenticated user before calling publishing handler', async () => {
    await expect(lastValueFrom(interceptor.intercept(ctx('publish', 'u1'), next))).resolves.toBe('saved');
    expect(assertAccepted).toHaveBeenCalledWith('u1');
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('fails closed if acceptance validation rejects', async () => {
    assertAccepted.mockRejectedValue(new Error('Terms required'));
    await expect(lastValueFrom(interceptor.intercept(ctx('publish', 'u2'), next)))
      .rejects.toThrow('Terms required');
    expect(next.handle).not.toHaveBeenCalled();
  });
});

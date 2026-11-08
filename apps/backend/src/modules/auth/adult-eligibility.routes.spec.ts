import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DataSource } from 'typeorm';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthController } from './auth.controller';
import { UsersController } from '../users/users.controller';
import { BlocksController } from '../blocks/blocks.controller';
import { ContentReportsController } from '../content-reports/content-reports.controller';

describe('adult-only HTTP API guard', () => {
  const previous = process.env.NEXUS_REQUIRE_ADULT_AGE;
  const query = jest.fn();
  const db = { query } as unknown as DataSource;
  const makeContext = (
    target: object, method: string, body?: unknown,
  ): ExecutionContext => {
    const req: { user?: { id: string }; body?: unknown } = {
      user: { id: '11111111-1111-4111-8111-111111111111' },
      body,
    };
    return {
      getHandler: () => (target as Record<string, unknown>)[method],
      getClass: () => (target as { constructor: new (...args: never[]) => object }).constructor,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  };

  let passportStub: jest.SpyInstance;
  beforeEach(() => {
    process.env.NEXUS_REQUIRE_ADULT_AGE = 'true';
    query.mockReset();
    const passportParent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (context: ExecutionContext) => boolean;
    };
    passportStub = jest.spyOn(passportParent, 'canActivate').mockImplementation(context => {
      const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
      req.user = { id: '11111111-1111-4111-8111-111111111111' };
      return true;
    });
  });
  afterEach(() => {
    passportStub.mockRestore();
    if (previous === undefined) delete process.env.NEXUS_REQUIRE_ADULT_AGE;
    else process.env.NEXUS_REQUIRE_ADULT_AGE = previous;
  });

  const guard = (): JwtAuthGuard => new JwtAuthGuard(new Reflector(), db);

  it('denies protected API calls for accounts without an adult DOB', async () => {
    query.mockResolvedValueOnce([{ date_of_birth: null }]);
    await expect(guard().canActivate(makeContext(UsersController.prototype, 'setCover')))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('allows protected API calls after backend confirms adult DOB', async () => {
    query.mockResolvedValueOnce([{ date_of_birth: '1988-03-18' }]);
    await expect(guard().canActivate(makeContext(UsersController.prototype, 'setCover')))
      .resolves.toBe(true);
  });

  it('keeps safety reports, blocks and account recovery available to excluded accounts', async () => {
    for (const [controller, method] of [
      [ContentReportsController.prototype, 'submit'],
      [BlocksController.prototype, 'block'],
      [UsersController.prototype, 'deleteAccount'],
      [AuthController.prototype, 'ageStatus'],
    ] as const) {
      await expect(guard().canActivate(makeContext(controller, method))).resolves.toBe(true);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('permits an adult DOB to be registered without exposing unrelated UGC writes', async () => {
    await expect(guard().canActivate(makeContext(UsersController.prototype, 'updateProfile',
      { dateOfBirth: '1990-03-22' }))).resolves.toBe(true);
    query.mockResolvedValueOnce([{ date_of_birth: null }]);
    await expect(guard().canActivate(makeContext(UsersController.prototype, 'updateProfile',
      { dateOfBirth: '2016-02-03', bio: 'still too young' })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

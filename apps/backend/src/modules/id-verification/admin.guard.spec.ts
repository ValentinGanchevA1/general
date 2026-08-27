import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';

import { AdminGuard } from './admin.guard';

function mockContext(user: { id?: string; sub?: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();
  const adminId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  afterEach(() => {
    delete process.env.ADMIN_USER_IDS;
  });

  it('allows when req.user.id is listed in ADMIN_USER_IDS', () => {
    process.env.ADMIN_USER_IDS = `${adminId},${otherId}`;
    expect(guard.canActivate(mockContext({ id: adminId }))).toBe(true);
  });

  it('allows when identity is only on req.user.sub', () => {
    process.env.ADMIN_USER_IDS = adminId;
    expect(guard.canActivate(mockContext({ sub: adminId }))).toBe(true);
  });

  it('trims whitespace around comma-separated admin ids', () => {
    process.env.ADMIN_USER_IDS = ` ${adminId} , ${otherId} `;
    expect(guard.canActivate(mockContext({ id: adminId }))).toBe(true);
  });

  it('denies when user is authenticated but not an admin', () => {
    process.env.ADMIN_USER_IDS = adminId;
    expect(() => guard.canActivate(mockContext({ id: otherId }))).toThrow(ForbiddenException);
  });

  it('denies when ADMIN_USER_IDS is unset', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(() => guard.canActivate(mockContext({ id: adminId }))).toThrow(ForbiddenException);
  });

  it('denies when request has no user', () => {
    process.env.ADMIN_USER_IDS = adminId;
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException);
  });
});

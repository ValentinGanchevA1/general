import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../id-verification/admin.guard';
import { AdminContentReportsController, ContentReportsController } from './content-reports.controller';

describe('content reports authentication boundaries', () => {
  const saved = process.env.ADMIN_USER_IDS;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = saved;
  });

  it('allows public report submission only after JWT authentication', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ContentReportsController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(AdminGuard);
  });

  it('requires both JWT authentication and administrator permission for moderation', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminContentReportsController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(AdminGuard);
  });

  it('fails closed without ADMIN_USER_IDS, and rejects ordinary users', () => {
    delete process.env.ADMIN_USER_IDS;
    const actor = '11111111-1111-4111-8111-111111111111';
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: actor } }) }),
    } as unknown as ExecutionContext;
    const guard = new AdminGuard();
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    process.env.ADMIN_USER_IDS = '22222222-2222-4222-8222-222222222222';
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permits a specifically allow-listed administrator', () => {
    const actor = '33333333-3333-4333-8333-333333333333';
    process.env.ADMIN_USER_IDS = actor;
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: actor } }) }),
    } as unknown as ExecutionContext;
    expect(new AdminGuard().canActivate(context)).toBe(true);
  });
});

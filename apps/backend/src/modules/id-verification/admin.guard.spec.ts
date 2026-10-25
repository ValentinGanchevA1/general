import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

interface RequestUser {
  id?: string;
  sub?: string;
}

function createContext(user?: RequestUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const originalAdminUserIds = process.env.ADMIN_USER_IDS;
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  afterEach(() => {
    if (originalAdminUserIds === undefined) {
      delete process.env.ADMIN_USER_IDS;
    } else {
      process.env.ADMIN_USER_IDS = originalAdminUserIds;
    }
  });

  it('allows a canonical user id present in ADMIN_USER_IDS', () => {
    process.env.ADMIN_USER_IDS = 'user-a,user-b';

    expect(guard.canActivate(createContext({ id: 'user-b' }))).toBe(true);
  });

  it('falls back to the JWT subject when id is absent', () => {
    process.env.ADMIN_USER_IDS = 'subject-admin';

    expect(guard.canActivate(createContext({ sub: 'subject-admin' }))).toBe(true);
  });

  it('prefers canonical id over subject when both are present', () => {
    process.env.ADMIN_USER_IDS = 'subject-admin';

    expect(() => guard.canActivate(createContext({ id: 'non-admin', sub: 'subject-admin' })))
      .toThrow(ForbiddenException);
  });

  it('trims configured ids and ignores empty entries', () => {
    process.env.ADMIN_USER_IDS = '  user-a , , user-b  ,';

    expect(guard.canActivate(createContext({ id: 'user-a' }))).toBe(true);
    expect(guard.canActivate(createContext({ id: 'user-b' }))).toBe(true);
  });

  it('fails closed when ADMIN_USER_IDS is missing', () => {
    delete process.env.ADMIN_USER_IDS;

    expect(() => guard.canActivate(createContext({ id: 'user-a' })))
      .toThrow(new ForbiddenException('Admin access required'));
  });

  it('rejects a request without an authenticated user id', () => {
    process.env.ADMIN_USER_IDS = 'user-a';

    expect(() => guard.canActivate(createContext()))
      .toThrow(new ForbiddenException('Admin access required'));
  });

  it('re-reads ADMIN_USER_IDS for each authorization decision', () => {
    process.env.ADMIN_USER_IDS = 'user-a';
    expect(guard.canActivate(createContext({ id: 'user-a' }))).toBe(true);

    process.env.ADMIN_USER_IDS = 'user-b';
    expect(() => guard.canActivate(createContext({ id: 'user-a' })))
      .toThrow(ForbiddenException);
    expect(guard.canActivate(createContext({ id: 'user-b' }))).toBe(true);
  });
});

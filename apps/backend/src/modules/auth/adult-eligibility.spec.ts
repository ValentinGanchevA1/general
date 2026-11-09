import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { isAdultDateOfBirth } from '@g88/shared';
import { assertAdultAge, getAdultAgeStatus, isAdultGateEnforced } from './adult-eligibility';
import type { DataSource } from 'typeorm';

describe('NEXUS 18+ launch gate', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const previous = process.env.NEXUS_REQUIRE_ADULT_AGE;
  const query = jest.fn();
  const db = { query } as unknown as DataSource;

  beforeEach(() => { jest.clearAllMocks(); process.env.NEXUS_REQUIRE_ADULT_AGE = 'true'; });
  afterAll(() => {
    if (previous == null) delete process.env.NEXUS_REQUIRE_ADULT_AGE;
    else process.env.NEXUS_REQUIRE_ADULT_AGE = previous;
  });

  it('evaluates exact calendar birthdays in UTC, rejecting malformed dates and underage', () => {
    const now = new Date('2026-11-08T14:00:00.000Z');
    expect(isAdultDateOfBirth('2008-11-08', now)).toBe(true);
    expect(isAdultDateOfBirth('2008-11-09', now)).toBe(false);
    expect(isAdultDateOfBirth('2008-02-29', now)).toBe(true);
    expect(isAdultDateOfBirth('2009-02-29', now)).toBe(false);
    expect(isAdultDateOfBirth('1990-13-01', now)).toBe(false);
    expect(isAdultDateOfBirth('1990-02-30', now)).toBe(false);
    expect(isAdultDateOfBirth('1900-01-01', now)).toBe(false); // > 120 years old
    expect(isAdultDateOfBirth('garbage', now)).toBe(false);
  });

  it('blocks missing or underage DOB and permits verified-adult declaration', async () => {
    query.mockResolvedValueOnce([{ date_of_birth: null }]);
    await expect(assertAdultAge(db, userId)).rejects.toMatchObject({
      response: { code: 'auth.age_declaration_required' },
    });
    query.mockResolvedValueOnce([{ date_of_birth: '2010-01-01' }]);
    await expect(assertAdultAge(db, userId)).rejects.toBeInstanceOf(ForbiddenException);
    query.mockResolvedValueOnce([{ date_of_birth: '1994-02-02' }]);
    await expect(assertAdultAge(db, userId)).resolves.toBeUndefined();
  });

  it('denies deleted/nonexistent users when account checks are requested', async () => {
    query.mockResolvedValueOnce([]);
    await expect(getAdultAgeStatus(db, userId)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('honors the staged backend rollout flag before the Android 18+ release', async () => {
    delete process.env.NEXUS_REQUIRE_ADULT_AGE;
    expect(isAdultGateEnforced()).toBe(false);
    await expect(assertAdultAge(db, userId)).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });
});

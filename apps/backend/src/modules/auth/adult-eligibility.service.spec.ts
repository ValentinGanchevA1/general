import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { AdultEligibilityService, adultAgeGateEnabled, assertAdultDateOfBirth } from './adult-eligibility.service';
import { AuthService } from './auth.service';

const FLAG = 'NEXUS_REQUIRE_ADULT_AGE';
const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('Adult eligibility policy', () => {
  const previous = process.env[FLAG];
  afterEach(() => {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  });

  it('uses opt-in behavior; unset is never implicitly ON', () => {
    delete process.env[FLAG];
    expect(adultAgeGateEnabled()).toBe(false);
    process.env[FLAG] = 'true';
    expect(adultAgeGateEnabled()).toBe(true);
  });

  it('accepts exactly eighteen on the UTC calendar boundary', () => {
    expect(() => assertAdultDateOfBirth('2008-11-10', new Date('2026-11-10T00:00:00Z')))
      .not.toThrow();
    expect(() => assertAdultDateOfBirth('2008-11-11', new Date('2026-11-10T23:59:59Z')))
      .toThrow(BadRequestException);
  });

  it('rejects calendar rollover, malformed dates and future birthdays', () => {
    for (const dob of ['2008-02-30', '2008-11-1', 'not-a-date', '2040-01-01']) {
      expect(() => assertAdultDateOfBirth(dob, new Date('2026-11-10T00:00:00Z')))
        .toThrow(BadRequestException);
    }
  });

  it('checks stored DOB from PostgreSQL, not from token claims', async () => {
    process.env[FLAG] = 'true';
    const query = jest.fn().mockResolvedValueOnce([{ eligible: true }]);
    const service = new AdultEligibilityService({ query } as unknown as DataSource);

    await service.assertEligible(USER_ID);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("timezone('UTC', NOW())"),
      [USER_ID],
    );
  });

  it('fails closed for unknown DOB, missing user and database failures', async () => {
    process.env[FLAG] = 'true';
    const query = jest.fn().mockResolvedValueOnce([{ eligible: false }])
      .mockRejectedValueOnce(new Error('database unavailable'));
    const service = new AdultEligibilityService({ query } as unknown as DataSource);

    await expect(service.assertEligible(USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertEligible(undefined)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
    await expect(service.assertEligible(USER_ID)).rejects.toThrow('database unavailable');
  });

  it('does not query the database when the release flag is OFF', async () => {
    delete process.env[FLAG];
    const query = jest.fn();
    const service = new AdultEligibilityService({ query } as unknown as DataSource);

    await expect(service.assertEligible(USER_ID)).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('AuthService — adult onboarding', () => {
  const previous = process.env[FLAG];
  afterEach(() => {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  });

  function setup(): { service: AuthService; query: jest.Mock } {
    const query = jest.fn().mockResolvedValue([]);
    const service = new AuthService({ query } as unknown as DataSource, {} as JwtService);
    return { service, query };
  }

  it('rejects email signup without DOB when the gate is ON', async () => {
    process.env[FLAG] = 'true';
    const { service, query } = setup();
    await expect(service.register('test@example.test', 'Password123!', 'Test'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('never inserts underage DOB, even if the flag is OFF', async () => {
    delete process.env[FLAG];
    const { service, query } = setup();
    await expect(service.register('test@example.test', 'Password123!', 'Test', '2014-11-10'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('creates a private account with an adult DOB before token issuance', async () => {
    process.env[FLAG] = 'true';
    const { service, query } = setup();
    // Empty INSERT RETURNING intentionally stops before token issuance.
    await expect(service.register('test@example.test', 'Password123!', 'Test', '2000-01-01'))
      .rejects.toThrow('Failed to create user account');
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('visibility, date_of_birth');
    expect(sql).toContain("'private', $4");
    expect(query.mock.calls[0]?.[1][3]).toBe('2000-01-01');
  });

  it('completes adult onboarding while keeping private visibility', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce([{ id: USER_ID }]);
    await service.completeAge(USER_ID, '2000-01-01');
    expect(String(query.mock.calls[0]?.[0])).toContain("visibility = 'private'");
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, '2000-01-01']);
  });

  it('cannot overwrite a previously recorded DOB through bootstrap', async () => {
    const { service } = setup();
    await expect(service.completeAge(USER_ID, '2000-01-01'))
      .rejects.toBeInstanceOf(ConflictException);
  });
});

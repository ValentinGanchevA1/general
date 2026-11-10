import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UserProfile } from '@g88/shared';

import { UsersService } from './users.service';
import { PresenceService } from '../presence/presence.service';
import { MessagingService } from '../messaging/messaging.service';
import { BlocksService } from '../blocks/blocks.service';
import { S3Service } from '../../common/s3.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';

function setup(): { service: UsersService; query: jest.Mock } {
  const query = jest.fn().mockResolvedValue([]);
  const service = new UsersService(
    { query } as unknown as DataSource,
    {} as PresenceService,
    {} as MessagingService,
    {} as S3Service,
    {} as BlocksService,
  );
  jest.spyOn(service, 'getProfile').mockResolvedValue({} as UserProfile);
  return { service, query };
}

describe('UsersService — public visibility age guard', () => {
  it('rejects a public profile when the stored DOB is missing or underage', async () => {
    const { service, query } = setup();
    await expect(service.updateProfile(USER_ID, { visibility: 'public' }))
      .rejects.toBeInstanceOf(BadRequestException);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')::date RETURNING id");
  });

  it('accepts public visibility when the atomic age predicate returns a row', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce([{ id: USER_ID }]);
    await service.updateProfile(USER_ID, { visibility: 'public' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('checks a supplied DOB in the same atomic UPDATE', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce([{ id: USER_ID }]);
    await service.updateProfile(USER_ID, {
      visibility: 'public', dateOfBirth: '2000-01-01',
    });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('date_of_birth = $3');
    expect(sql).toContain('AND $3::date <=');
    expect(sql).toMatch(/\$\d+::date <= \(CURRENT_DATE - INTERVAL '18 years'\)::date RETURNING id/);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, 'public', '2000-01-01']);
  });

  it('rejects public visibility when DOB is explicitly cleared', async () => {
    const { service, query } = setup();
    await expect(service.updateProfile(USER_ID, {
      visibility: 'public', dateOfBirth: null,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('forces private visibility when removing DOB', async () => {
    const { service, query } = setup();
    await service.updateProfile(USER_ID, { dateOfBirth: null });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("visibility = 'private'");
  });

  it('allows profile visibility private without requiring DOB', async () => {
    const { service, query } = setup();
    await service.updateProfile(USER_ID, { visibility: 'private' });
    expect(String(query.mock.calls[0]?.[0])).not.toContain('AND date_of_birth <=');
  });
});

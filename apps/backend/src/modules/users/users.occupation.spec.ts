import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UserProfile } from '@g88/shared';

import { S3Service } from '../../common/s3.service';
import { BlocksService } from '../blocks/blocks.service';
import { MessagingService } from '../messaging/messaging.service';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from './users.service';

const USER = '11111111-1111-1111-1111-111111111111';

function stubProfile(): UserProfile {
  return {} as UserProfile;
}

function publicRow(showOccupation: boolean) {
  return {
    id: USER,
    display_name: 'Ada',
    avatar_url: null,
    cover_url: null,
    bio: null,
    occupation: 'Software engineer',
    show_occupation: showOccupation,
    verification_level: 'none',
    id_verification_status: 'none',
    goals: [],
    age: null,
    hometown_city: null,
    hometown_country: null,
    show_age: true,
    show_hometown: true,
    gender: null,
    gender_self_describe: null,
    sexual_orientation: null,
    orientation_self_describe: null,
    nationality: null,
    show_gender: true,
    show_orientation: false,
    show_nationality: true,
  };
}

describe('UsersService — occupation', () => {
  let service: UsersService;
  let query: jest.Mock;
  let whichAreOnline: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline } },
        { provide: MessagingService, useValue: {} },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: {} },
      ],
    }).compile();

    service = mod.get(UsersService);
  });

  it('normalizes occupation and persists its visibility preference', async () => {
    jest.spyOn(service, 'getProfile').mockResolvedValue(stubProfile());

    await service.updateProfile(USER, {
      occupation: '  Software engineer  ',
      showOccupation: false,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('occupation = $2');
    expect(sql).toContain('show_occupation = $3');
    expect(params).toEqual([USER, 'Software engineer', false]);
  });

  it('clears whitespace-only occupation values', async () => {
    jest.spyOn(service, 'getProfile').mockResolvedValue(stubProfile());

    await service.updateProfile(USER, { occupation: '   ' });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('occupation = $2');
    expect(params).toEqual([USER, null]);
  });

  it('defensively caps occupation at the database contract length', async () => {
    jest.spyOn(service, 'getProfile').mockResolvedValue(stubProfile());

    await service.updateProfile(USER, { occupation: 'x'.repeat(100) });

    expect(query).toHaveBeenCalledTimes(1);
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([USER, 'x'.repeat(80)]);
  });

  it('omits a saved occupation from the public response when visibility is off', async () => {
    query
      .mockResolvedValueOnce([publicRow(false)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const profile = await service.getPublicProfile(USER);

    expect(profile).not.toHaveProperty('occupation');
  });

  it('includes occupation in the public response when visibility is on', async () => {
    query
      .mockResolvedValueOnce([publicRow(true)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const profile = await service.getPublicProfile(USER);

    expect(profile.occupation).toBe('Software engineer');
  });
});

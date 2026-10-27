import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { S3Service } from '../../common/s3.service';
import { BlocksService } from '../blocks/blocks.service';
import { MessagingService } from '../messaging/messaging.service';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from './users.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';

function profileRow() {
  return {
    id: USER_ID,
    display_name: 'Ada',
    avatar_url: null,
    cover_url: null,
    bio: null,
    occupation: 'Engineer',
    show_occupation: false,
    verification_level: 'none',
    id_verification_status: 'none',
    goals: [],
    age: 28,
    date_of_birth: '1998-02-29',
    hometown_city: 'Varna',
    hometown_country: 'BG',
    show_age: false,
    show_hometown: false,
    gender: 'self_describe',
    gender_self_describe: 'private gender',
    sexual_orientation: 'self_describe',
    orientation_self_describe: 'private orientation',
    nationality: 'Bulgarian',
    show_gender: false,
    show_orientation: false,
    show_nationality: false,
  };
}

describe('UsersService public profile privacy regression', () => {
  let service: UsersService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline: jest.fn().mockResolvedValue(new Set<string>()) } },
        { provide: MessagingService, useValue: {} },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: {} },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  function arrange(row: ReturnType<typeof profileRow>): void {
    query.mockResolvedValueOnce([row]);
  }

  it('omits exact DOB and every hidden profile field from the public JSON', async () => {
    arrange(profileRow());
    const response = await service.getPublicProfile(USER_ID);
    const json = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;

    for (const key of [
      'dateOfBirth', 'age', 'hometownCity', 'hometownCountry',
      'occupation', 'gender', 'genderSelfDescribe',
      'sexualOrientation', 'orientationSelfDescribe', 'nationality',
    ]) {
      expect(json).not.toHaveProperty(key);
    }
    expect(JSON.stringify(json)).not.toContain('private orientation');
    expect(JSON.stringify(json)).not.toContain('private gender');
  });

  it('returns explicitly visible fields without exposing exact DOB', async () => {
    const row = profileRow();
    row.show_age = true;
    row.show_hometown = true;
    row.show_occupation = true;
    row.show_gender = true;
    row.show_orientation = true;
    row.show_nationality = true;
    arrange(row);

    const response = await service.getPublicProfile(USER_ID);
    expect(response).toMatchObject({
      age: 28,
      hometownCity: 'Varna',
      hometownCountry: 'BG',
      occupation: 'Engineer',
      gender: 'self_describe',
      genderSelfDescribe: 'private gender',
      sexualOrientation: 'self_describe',
      orientationSelfDescribe: 'private orientation',
      nationality: 'Bulgarian',
    });
    expect(response).not.toHaveProperty('dateOfBirth');
  });

  it('never selects raw date of birth in the public-profile SQL query', async () => {
    arrange(profileRow());
    await service.getPublicProfile(USER_ID);
    const [sql] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("date_part('year', age(date_of_birth))");
    expect(sql).not.toMatch(/date_of_birth\s+AS\s+date_of_birth/i);
  });
});

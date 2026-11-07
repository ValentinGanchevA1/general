import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BlocksService } from '../blocks/blocks.service';
import { MessagingService } from '../messaging/messaging.service';
import { PresenceService } from '../presence/presence.service';
import { S3Service } from '../../common/s3.service';
import { UsersService } from './users.service';

describe('UsersService dating age safeguards', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  let service: UsersService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: {} },
        { provide: MessagingService, useValue: {} },
        { provide: BlocksService, useValue: {} },
        { provide: S3Service, useValue: {} },
      ],
    }).compile();
    service = mod.get(UsersService);
  });

  it('refuses dating opt-in for legacy profiles with no birth date', async () => {
    query.mockResolvedValueOnce([{ date_of_birth: null, open_to_dating: false }]);
    await expect(service.updateProfile(userId, { openToDating: true }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]: [string]) => sql.startsWith('UPDATE users')))
      .toBe(false);
  });

  it('refuses an underage birth date even when a client requests dating', async () => {
    query.mockResolvedValueOnce([{ date_of_birth: '2014-06-01', open_to_dating: false }])
      .mockResolvedValueOnce([{ adult: false }]);
    await expect(service.updateProfile(userId, { openToDating: true }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls[1]?.[0]).toContain("INTERVAL '18 years'");
  });

  it('does not allow an opted-in user to clear their DOB', async () => {
    query.mockResolvedValueOnce([{ date_of_birth: '1990-01-01', open_to_dating: true }]);
    await expect(service.updateProfile(userId, { dateOfBirth: null }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]: [string]) => sql.startsWith('UPDATE users')))
      .toBe(false);
  });
});

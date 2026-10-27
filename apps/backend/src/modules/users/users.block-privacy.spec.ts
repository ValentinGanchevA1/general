import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { S3Service } from '../../common/s3.service';
import { BlocksService } from '../blocks/blocks.service';
import { MessagingService } from '../messaging/messaging.service';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from './users.service';

describe('UsersService public profile block privacy', () => {
  const viewerId = '11111111-1111-1111-1111-111111111111';
  const subjectId = '22222222-2222-2222-2222-222222222222';
  let service: UsersService;
  let query: jest.Mock;
  let isBlocked: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    isBlocked = jest.fn().mockResolvedValue(true);
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline: jest.fn() } },
        { provide: MessagingService, useValue: {} },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: { isBlocked, hasBlocked: jest.fn() } },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('rejects a blocked viewer before reading profile or precise coordinates', async () => {
    await expect(service.getPublicProfile(subjectId, viewerId)).rejects.toBeInstanceOf(NotFoundException);
    expect(isBlocked).toHaveBeenCalledWith(viewerId, subjectId);
    expect(query).not.toHaveBeenCalled();
  });

  it('does not run a block check for the owner viewing their own profile', async () => {
    await expect(service.getPublicProfile(subjectId, subjectId)).rejects.toBeInstanceOf(NotFoundException);
    expect(isBlocked).not.toHaveBeenCalled();
  });
});

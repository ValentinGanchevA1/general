import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { S3Service } from '../../common/s3.service';
import { BlocksService } from '../blocks/blocks.service';
import { MessagingService } from '../messaging/messaging.service';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from './users.service';

const USER = '11111111-1111-1111-1111-111111111111';
const VIEWER = '22222222-2222-2222-2222-222222222222';

describe('UsersService public map pin privacy', () => {
  let service: UsersService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('visibility = \'public\'')) {
        return Promise.resolve([{
          id: USER,
          display_name: 'Ada',
          avatar_url: null,
          verification_level: 'none',
          id_verification_status: 'none',
          goals: [],
        }]);
      }
      if (sql.includes('ST_SnapToGrid')) return Promise.resolve([{ lat: 43.2, lng: 27.92 }]);
      if (sql.includes('ST_Distance')) return Promise.resolve([{ meters: 1432 }]);
      return Promise.resolve([]);
    });
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline: jest.fn().mockResolvedValue(new Set<string>()) } },
        { provide: MessagingService, useValue: { permissionFor: jest.fn().mockResolvedValue({
          matched: false, sharedInterests: [], canMessage: 'none',
        }) } },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: {
          isBlocked: jest.fn().mockResolvedValue(false),
          hasBlocked: jest.fn().mockResolvedValue(false),
        } },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('returns snapped public coordinates and rounded distance for a peer viewer', async () => {
    const profile = await service.getPublicProfile(USER, VIEWER);
    expect(profile.mapLat).toBe(43.2);
    expect(profile.mapLng).toBe(27.92);
    expect(profile.distanceMeters).toBe(1000);
    const pinQuery = query.mock.calls.find(([sql]: [string]) => sql.includes('ST_SnapToGrid'));
    expect(pinQuery).toBeDefined();
    expect(pinQuery?.[0]).toContain('ST_SnapToGrid(location::geometry, 0.02)');
    expect(pinQuery?.[0]).not.toContain('ST_Y(location::geometry)');
    expect(pinQuery?.[0]).not.toContain('ST_X(location::geometry)');
  });

  it('does not expose peer coordinates when no location is available', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('visibility = \'public\'')) return Promise.resolve([{
        id: USER, display_name: 'Ada', avatar_url: null,
        verification_level: 'none', id_verification_status: 'none', goals: [],
      }]);
      return Promise.resolve([]);
    });
    const profile = await service.getPublicProfile(USER, VIEWER);
    expect(profile.mapLat).toBeUndefined();
    expect(profile.mapLng).toBeUndefined();
    expect(profile.distanceMeters).toBeUndefined();
  });
});

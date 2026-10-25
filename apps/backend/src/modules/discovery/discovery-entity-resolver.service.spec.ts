import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { DiscoveryEntityResolver } from './discovery-entity-resolver.service';
import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';

describe('DiscoveryEntityResolver', () => {
  let resolver: DiscoveryEntityResolver;
  let query: jest.Mock;
  let listFriendIds: jest.Mock;
  let listWhoAllowFriendsOnline: jest.Mock;
  let whichAreOnline: jest.Mock;
  let lastSeenMap: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    listFriendIds = jest.fn().mockResolvedValue([]);
    listWhoAllowFriendsOnline = jest.fn().mockResolvedValue(new Set<string>());
    whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
    lastSeenMap = jest.fn().mockResolvedValue(new Map<string, string>());

    const mod = await Test.createTestingModule({
      providers: [
        DiscoveryEntityResolver,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        {
          provide: FriendsService,
          useValue: { listFriendIds, listWhoAllowFriendsOnline },
        },
        { provide: PresenceService, useValue: { whichAreOnline, lastSeenMap } },
      ],
    }).compile();

    resolver = mod.get(DiscoveryEntityResolver);
  });

  it('applies public visibility, self exclusion and bilateral owner blocking', async () => {
    await resolver.resolveForViewer({ viewerId: 'viewer', kind: 'event', entityId: 'event-1' });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("visibility = 'public'");
    expect(sql).toContain('id <> $3');
    expect(sql).toContain("WHEN 'event' THEN NULLIF(v_discoverable_entity.meta->>'hostId', '')::uuid");
    expect(sql).toContain("WHEN 'listing' THEN NULLIF(v_discoverable_entity.meta->>'sellerId', '')::uuid");
    expect(sql).toContain('ub.blocker_id = $3');
    expect(sql).toContain('ub.blocked_id = $3');
    expect(params).toEqual(['event-1', 'event', 'viewer']);
  });

  it('returns null when the entity is not visible to the viewer', async () => {
    await expect(
      resolver.resolveForViewer({ viewerId: 'viewer', kind: 'user', entityId: 'u1' }),
    ).resolves.toBeNull();
    expect(listFriendIds).not.toHaveBeenCalled();
  });

  it('enriches friend presence only when the friend allows it', async () => {
    query.mockResolvedValueOnce([
      {
        id: 'u1',
        kind: 'user',
        lat: 1.02,
        lng: 1.03,
        meta: { displayName: 'A', avatarUrl: null, verification: 'email' },
      },
    ]);
    listFriendIds.mockResolvedValueOnce(['u1']);
    listWhoAllowFriendsOnline.mockResolvedValueOnce(new Set(['u1']));
    whichAreOnline.mockResolvedValueOnce(new Set(['u1']));
    lastSeenMap.mockResolvedValueOnce(new Map([['u1', '2026-10-25T12:00:00.000Z']]));

    const point = await resolver.resolveForViewer({
      viewerId: 'viewer',
      kind: 'user',
      entityId: 'u1',
    });

    expect(point).toMatchObject({
      kind: 'user',
      id: 'u1',
      meta: {
        isFriend: true,
        online: true,
        lastSeenAt: '2026-10-25T12:00:00.000Z',
      },
    });
  });

  it('does not read presence when the friend hides online status', async () => {
    query.mockResolvedValueOnce([
      {
        id: 'u1',
        kind: 'user',
        lat: 1.02,
        lng: 1.03,
        meta: { displayName: 'A', avatarUrl: null, verification: 'email' },
      },
    ]);
    listFriendIds.mockResolvedValueOnce(['u1']);

    const point = await resolver.resolveForViewer({
      viewerId: 'viewer',
      kind: 'user',
      entityId: 'u1',
    });

    expect(point).toMatchObject({
      meta: { isFriend: true, online: false, lastSeenAt: null },
    });
    expect(whichAreOnline).not.toHaveBeenCalled();
    expect(lastSeenMap).not.toHaveBeenCalled();
  });
});

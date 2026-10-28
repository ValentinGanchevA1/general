import { DataSource } from 'typeorm';

import type { FeedResponse } from '@g88/shared';

import { PlaceActivityLinkService } from './place-activity-link.service';

const baseResponse: FeedResponse = {
  nextSince: '2026-10-28T03:30:00.000Z',
  items: [
    {
      id: 'place:11111111-1111-4111-8111-111111111111',
      type: 'place',
      category: null,
      title: 'Sea Garden',
      preview: 'Shared nearby',
      actorId: 'user-1',
      actorName: 'Maria',
      distanceM: 400,
      createdAt: '2026-10-28T03:30:00.000Z',
      unread: false,
      deepLink: { screen: 'Main', params: { screen: 'Map' } },
    },
    {
      id: 'place_trending:22222222-2222-4222-8222-222222222222',
      type: 'place',
      category: null,
      title: 'Sea Garden',
      preview: 'Recent nearby check-ins are picking up',
      actorId: null,
      actorName: null,
      distanceM: 400,
      createdAt: '2026-10-28T03:29:00.000Z',
      unread: false,
      deepLink: { screen: 'Main', params: { screen: 'Map' } },
    },
  ],
};

describe('PlaceActivityLinkService', () => {
  it('links canonical check-ins and trends to the NEXA place entity', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        activity_id: 'place:11111111-1111-4111-8111-111111111111',
        place_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      {
        activity_id: 'place_trending:22222222-2222-4222-8222-222222222222',
        place_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ]);
    const service = new PlaceActivityLinkService({ query } as unknown as DataSource);

    const result = await service.enrich(baseResponse);

    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: baseResponse.items[0]?.id,
        placeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        deepLink: {
          screen: 'PlaceDetail',
          params: { placeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        },
      }),
      expect.objectContaining({
        id: baseResponse.items[1]?.id,
        placeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    ]));
  });

  it('keeps free-text place activity on the safe map fallback', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new PlaceActivityLinkService({ query } as unknown as DataSource);

    const result = await service.enrich({ ...baseResponse, items: [baseResponse.items[0]!] });

    expect(result.items[0]).toMatchObject({
      placeId: null,
      deepLink: { screen: 'Main', params: { screen: 'Map' } },
    });
  });
});

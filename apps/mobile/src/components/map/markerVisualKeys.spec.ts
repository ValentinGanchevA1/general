import type { EntityPoint } from '@g88/shared';

import { entityVisualKey } from './markerVisualKeys';

function userPoint(avatarUrl: string | null): EntityPoint {
  return {
    id: 'user-1',
    kind: 'user',
    lat: 42.1,
    lng: 27.9,
    meta: {
      displayName: 'Nexa User',
      avatarUrl,
      verification: 'id',
      online: true,
      lastSeenAt: null,
      verifiedBadge: true,
    },
  };
}

describe('entityVisualKey', () => {
  it('changes when a painted person avatar changes', () => {
    expect(entityVisualKey(userPoint('https://cdn.example.com/a.jpg'))).not.toBe(
      entityVisualKey(userPoint('https://cdn.example.com/b.jpg')),
    );
  });

  it('changes when a person avatar is removed', () => {
    expect(entityVisualKey(userPoint('https://cdn.example.com/a.jpg'))).not.toBe(
      entityVisualKey(userPoint(null)),
    );
  });

  it('does not include event cover media that map markers do not paint', () => {
    const a: EntityPoint = {
      id: 'event-1',
      kind: 'event',
      lat: 42.1,
      lng: 27.9,
      meta: {
        title: 'Launch',
        coverUrl: 'https://cdn.example.com/a.jpg',
        startsAt: '2026-10-27T18:00:00.000Z',
        attendeeCount: 12,
        capacity: 40,
      },
    };
    const b: EntityPoint = {
      ...a,
      meta: { ...a.meta, coverUrl: 'https://cdn.example.com/b.jpg' },
    };

    expect(entityVisualKey(a)).toBe(entityVisualKey(b));
  });
});

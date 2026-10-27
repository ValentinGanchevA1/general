import type { EntityPoint } from '@g88/shared';

import { resolvePersonMarkerAvatarUrl } from './nexaPersonMarkerMedia';

const userPoint: EntityPoint = {
  id: 'user-1',
  kind: 'user',
  lat: 42.1,
  lng: 27.9,
  meta: {
    displayName: 'Nexa User',
    avatarUrl: ' https://cdn.example.com/avatar.jpg ',
    verification: 'id',
    online: true,
    lastSeenAt: null,
  },
};

describe('resolvePersonMarkerAvatarUrl', () => {
  it('uses avatar media at standard density', () => {
    expect(resolvePersonMarkerAvatarUrl(userPoint, 'standard', false)).toBe(
      'https://cdn.example.com/avatar.jpg',
    );
  });

  it('keeps avatar media at compact density to preserve marker identity', () => {
    expect(resolvePersonMarkerAvatarUrl(userPoint, 'compact', false)).toBe(
      'https://cdn.example.com/avatar.jpg',
    );
  });

  it('keeps the same avatar when compact marker becomes selected', () => {
    expect(resolvePersonMarkerAvatarUrl(userPoint, 'compact', true)).toBe(
      'https://cdn.example.com/avatar.jpg',
    );
  });

  it('falls back when the avatar URL is blank', () => {
    const point: EntityPoint = {
      ...userPoint,
      meta: { ...userPoint.meta, avatarUrl: '   ' },
    };
    expect(resolvePersonMarkerAvatarUrl(point, 'standard', false)).toBeNull();
  });

  it('never requests avatar media for non-person entities', () => {
    const eventPoint: EntityPoint = {
      id: 'event-1',
      kind: 'event',
      lat: 42.1,
      lng: 27.9,
      meta: {
        title: 'Launch',
        coverUrl: 'https://cdn.example.com/event.jpg',
        startsAt: '2026-10-27T18:00:00.000Z',
        attendeeCount: 12,
        capacity: 40,
      },
    };
    expect(resolvePersonMarkerAvatarUrl(eventPoint, 'selected', true)).toBeNull();
  });
});

import type { ActivityItem } from '@g88/shared';

import { getActivitySentence } from './activityNarrative';

function item(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'event:e1',
    type: 'event',
    category: null,
    title: 'Sunset Meetup',
    preview: 'Tonight',
    actorId: 'u1',
    actorName: 'Maria',
    distanceM: 450,
    createdAt: '2026-10-27T17:00:00.000Z',
    unread: false,
    deepLink: { screen: 'EventDetail', params: { eventId: 'e1' } },
    ...overrides,
  };
}

describe('getActivitySentence', () => {
  it('returns null for legacy feed rows without narrative metadata', () => {
    expect(getActivitySentence(item())).toBeNull();
  });

  it('returns actor, action and object for timeline rendering', () => {
    expect(getActivitySentence(item({
      narrative: {
        kind: 'event_created',
        verb: 'created',
        objectLabel: 'Sunset Meetup',
        placeLabel: null,
      },
    }))).toEqual({
      actor: 'Maria',
      verb: 'created',
      objectLabel: 'Sunset Meetup',
      placeLabel: null,
    });
  });

  it('keeps opt-in place context human-readable and coordinate-free', () => {
    expect(getActivitySentence(item({
      actorName: 'Valentin',
      narrative: {
        kind: 'place_visit',
        verb: 'visited',
        objectLabel: 'Sea Garden',
        placeLabel: 'Varna',
      },
    }))).toEqual({
      actor: 'Valentin',
      verb: 'visited',
      objectLabel: 'Sea Garden',
      placeLabel: 'Varna',
    });
  });

  it('renders place trends without inventing an actor identity', () => {
    expect(getActivitySentence(item({
      type: 'place',
      actorId: null,
      actorName: null,
      narrative: {
        kind: 'place_trending',
        verb: 'is active at',
        objectLabel: 'Sea Garden',
        placeLabel: null,
      },
    }))).toEqual({
      actor: 'Sea Garden',
      verb: 'is getting active',
      objectLabel: null,
      placeLabel: null,
    });
  });
});

import type { ActivityItem, FeedResponse } from '@g88/shared';

import pulseReducer, { activityReceived, activityRemoved, fetchFeed } from './pulseSlice';

const activity = (id: string, createdAt: string): ActivityItem => ({
  id,
  type: 'place',
  category: null,
  title: 'Sea Garden',
  preview: 'Shared nearby',
  actorId: 'user-1',
  actorName: 'Valentin',
  distanceM: 300,
  createdAt,
  unread: false,
  narrative: {
    kind: 'place_visit',
    verb: 'visited',
    objectLabel: 'Sea Garden',
    placeLabel: null,
  },
  deepLink: { screen: 'Main', params: { screen: 'Map' } },
});

describe('pulse error presentation', () => {
  it('never copies raw thunk error.message into user-facing Redux state', () => {
    const action = fetchFeed.rejected(
      new Error('Request failed with status code 500'),
      'pulse-request-1',
      undefined,
    );

    const state = pulseReducer(undefined, action);

    expect(action.error.message).toBe('Request failed with status code 500');
    expect(state.error).toBe('Failed to load Pulse');
    expect(state.error).not.toContain('status code 500');
  });
});

describe('pulse realtime activity', () => {
  it('dedupes socket activity by stable item id', () => {
    const first = pulseReducer(undefined, activityReceived(activity(
      'place:check-in-1',
      '2026-10-28T01:00:00.000Z',
    )));
    const updated = activity('place:check-in-1', '2026-10-28T01:00:00.000Z');
    updated.distanceM = 120;

    const second = pulseReducer(first, activityReceived(updated));

    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.distanceM).toBe(120);
  });

  it('preserves activity that arrived after a REST fetch started', () => {
    const pending = pulseReducer(undefined, fetchFeed.pending('request-1', undefined));
    const live = activity('place:live', new Date(Date.now() + 1_000).toISOString());
    const withRealtime = pulseReducer(pending, activityReceived(live));
    const response: FeedResponse = {
      items: [activity('place:rest', '2026-10-27T23:00:00.000Z')],
      nextSince: '2026-10-27T23:00:00.000Z',
    };

    const fulfilled = pulseReducer(
      withRealtime,
      fetchFeed.fulfilled(response, 'request-1', undefined),
    );

    expect(fulfilled.items.map((item) => item.id)).toEqual(['place:live', 'place:rest']);
  });

  it('does not resurrect activity removed while a REST fetch is in flight', () => {
    const id = 'event_join:event-1:user-2';
    const existing = pulseReducer(undefined, activityReceived(activity(
      id,
      '2026-10-28T01:10:00.000Z',
    )));
    const pending = pulseReducer(existing, fetchFeed.pending('request-2', undefined));
    const removed = pulseReducer(pending, activityRemoved(id));
    const staleResponse: FeedResponse = {
      items: [activity(id, '2026-10-28T01:10:00.000Z')],
      nextSince: '2026-10-28T01:10:00.000Z',
    };

    const fulfilled = pulseReducer(
      removed,
      fetchFeed.fulfilled(staleResponse, 'request-2', undefined),
    );

    expect(fulfilled.items).toHaveLength(0);
  });
});

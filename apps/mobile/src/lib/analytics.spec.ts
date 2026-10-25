import axios from 'axios';

import { tokenStore } from '@/api/tokenStore';
import {
  productEventsForApiSuccess,
  sanitizeProductAnalyticsProperties,
  track,
  trackProduct,
} from './analytics';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: undefined })) },
}));

jest.mock('@/api/tokenStore', () => ({
  tokenStore: {
    getAccessToken: jest.fn(() => Promise.resolve('test-access-token')),
  },
}));

const axiosPost = axios.post as jest.MockedFunction<typeof axios.post>;
const getAccessToken = tokenStore.getAccessToken as jest.MockedFunction<typeof tokenStore.getAccessToken>;

async function flushAsyncAnalytics(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('product analytics', () => {
  beforeEach(() => {
    axiosPost.mockClear();
    getAccessToken.mockClear();
    getAccessToken.mockResolvedValue('test-access-token');
  });

  it('drops identifiers, coordinates and arbitrary free text before upload', () => {
    expect(
      sanitizeProductAnalyticsProperties('entity.opened', {
        entityType: 'person',
        surface: 'map',
        userId: 'u1',
        lat: 43.2,
        lng: 27.9,
        body: 'hello',
      }),
    ).toEqual({ entityType: 'person', surface: 'map' });
  });

  it('derives successful wave + connection without persisting route identifiers', () => {
    expect(
      productEventsForApiSuccess('post', '/interactions/wave', {
        conversationId: 'conversation-secret',
      }),
    ).toEqual([
      { event: 'interaction.wave_sent', properties: { mutual: true } },
      { event: 'connection.created', properties: { mechanism: 'wave' } },
    ]);
  });

  it('derives RSVP and offer events while dropping entity IDs and amounts', () => {
    expect(
      productEventsForApiSuccess('put', '/events/event-secret/rsvp', {
        eventId: 'event-secret',
        status: 'going',
        attendeeCount: 42,
      }),
    ).toEqual([{ event: 'event.rsvp_confirmed', properties: { status: 'going' } }]);

    expect(
      productEventsForApiSuccess('post', '/listings/listing-secret/offers', {
        id: 'offer-secret',
        amount: 999,
      }),
    ).toEqual([{ event: 'marketplace.offer_sent', properties: {} }]);
  });

  it('does not derive product events for unrelated diagnostic/API calls', () => {
    expect(productEventsForApiSuccess('post', '/discovery/viewport', {})).toEqual([]);
    expect(productEventsForApiSuccess('post', '/analytics/events', {})).toEqual([]);
  });

  it('uploads explicit product events through isolated raw transport', async () => {
    trackProduct('interaction.wave_sent', {
      mutual: true,
      recipientId: 'peer-id',
    });
    await flushAsyncAnalytics();

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(axiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/analytics/events'),
      {
        event: 'interaction.wave_sent',
        properties: { mutual: true },
      },
      expect.objectContaining({
        timeout: 3_000,
        headers: expect.objectContaining({ Authorization: 'Bearer test-access-token' }),
      }),
    );
  });

  it('keeps arbitrary diagnostic events out of product analytics', async () => {
    track('map.longpress_create', { lat: 43.2, lng: 27.9 });
    await flushAsyncAnalytics();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('maps launch completion to the coarse session retention event only', async () => {
    track('nexa_launch_complete', {
      path: 'map',
      totalMs: 1234,
      mapReadyMs: 500,
    });
    await flushAsyncAnalytics();

    expect(axiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/analytics/events'),
      {
        event: 'app.session_started',
        properties: { path: 'map' },
      },
      expect.any(Object),
    );
  });
});

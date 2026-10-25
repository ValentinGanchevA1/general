import { api } from '@/api/client';
import {
  sanitizeProductAnalyticsProperties,
  track,
  trackProduct,
} from './analytics';

jest.mock('@/api/client', () => ({
  api: { post: jest.fn(() => Promise.resolve({ data: undefined })) },
}));

const postMock = api.post as jest.MockedFunction<typeof api.post>;

describe('product analytics', () => {
  beforeEach(() => {
    postMock.mockClear();
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

  it('uploads only the explicit product event payload', () => {
    trackProduct('interaction.wave_sent', {
      mutual: true,
      surface: 'map',
      recipientId: 'peer-id',
    });

    expect(postMock).toHaveBeenCalledWith('/analytics/events', {
      event: 'interaction.wave_sent',
      properties: { mutual: true, surface: 'map' },
    });
  });

  it('keeps arbitrary diagnostic events out of the product analytics endpoint', () => {
    track('map.longpress_create', { lat: 43.2, lng: 27.9 });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('maps launch completion to the coarse session retention event only', () => {
    track('nexa_launch_complete', {
      path: 'map',
      totalMs: 1234,
      mapReadyMs: 500,
    });

    expect(postMock).toHaveBeenCalledWith('/analytics/events', {
      event: 'app.session_started',
      properties: { path: 'map' },
    });
  });
});

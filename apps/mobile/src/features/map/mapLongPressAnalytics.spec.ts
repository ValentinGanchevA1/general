import { track } from '@/lib/analytics';
import { trackMapLongPressCreate } from './mapLongPressAnalytics';

jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
}));

describe('trackMapLongPressCreate', () => {
  it('tracks intent without precise location properties', () => {
    trackMapLongPressCreate();

    expect(track).toHaveBeenCalledWith('map.longpress_create');
    expect(track).not.toHaveBeenCalledWith(
      'map.longpress_create',
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
    );
  });
});

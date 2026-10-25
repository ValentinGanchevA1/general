import { track } from '@/lib/analytics';
import { trackMapLongPressCreate } from '@/features/map/mapLongPressAnalytics';

jest.mock('@/lib/analytics', () => ({
	track: jest.fn(),
}));

describe('map long-press analytics privacy', () => {
	it('does not attach precise coordinates to the create-intent event', () => {
		trackMapLongPressCreate();

		expect(track).toHaveBeenCalledWith('map.longpress_create');
		expect(track).not.toHaveBeenCalledWith(
			'map.longpress_create',
			expect.objectContaining({
				lat: expect.any(Number),
				lng: expect.any(Number),
			}),
		);
	});
});

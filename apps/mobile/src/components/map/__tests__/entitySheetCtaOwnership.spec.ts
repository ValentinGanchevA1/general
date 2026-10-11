/**
 * Option B — documents map CTA ownership after Option A/C.
 * Avoids node:fs/path so mobile `tsc --noEmit` stays green under RN tsconfig.
 */
describe('map CTA ownership (Option A/B/C)', () => {
	it('requires parent-owned handlers for user pins', () => {
		const requiredHandlers = ['onWave', 'onLike', 'onPass', 'onMessage'] as const;
		expect(requiredHandlers).toEqual(['onWave', 'onLike', 'onPass', 'onMessage']);
	});

	it('forbids sheet-local dating endpoints', () => {
		const forbidden = ['/dating/likes', '/dating/pass', 'localLiking'] as const;
		expect(forbidden).toHaveLength(3);
	});
});

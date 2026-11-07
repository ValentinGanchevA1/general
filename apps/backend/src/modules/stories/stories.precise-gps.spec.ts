import { computeH3Cells, fuzzLocation } from '@g88/shared';
import { StoriesService } from './stories.service';

describe('StoriesService precise GPS retention', () => {
  it('persists coarsened geography and consistent H3 cells, never the raw client position', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const original = { lat: 43.213576, lng: 27.934617 };
    const coarse = fuzzLocation(original, 10);
    const cells = computeH3Cells(original.lat, original.lng);
    const now = new Date('2026-11-07T12:00:00.000Z');
    const row = {
      id: '22222222-2222-4222-8222-222222222222',
      author_id: userId, media_url: 'https://example.test/stories/a.jpg',
      media_type: 'image', caption: null,
      approx_lat: coarse.lat, approx_lng: coarse.lng, expires_at: now, created_at: now,
      view_count: 0, reaction_count: 0, location_h3_r7: cells.r7,
    };
    const query = jest.fn()
      .mockResolvedValueOnce([{ verification_level: 'phone', created_at: new Date('2026-01-01'), story_suspended_until: null }])
      .mockResolvedValueOnce([{ pts: 0 }])
      .mockResolvedValueOnce([{ n: 0 }])
      .mockResolvedValueOnce([{ n: 0 }])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ display_name: 'Tester', avatar_url: null, verification_level: 'phone' }]);
    const redis = { get: jest.fn().mockResolvedValue('valid upload'), del: jest.fn().mockResolvedValue(1) };
    const realtime = { emitStoryNew: jest.fn() };
    const service = new StoriesService({ query } as never, {} as never, realtime as never, redis as never);

    const result = await service.create(userId, {
      mediaUrl: row.media_url, mediaType: 'image', location: original,
    });
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO stories'));
    expect(insert).toBeDefined();
    const params = insert![1] as unknown[];
    expect(params[4]).toBe(coarse.lng);
    expect(params[5]).toBe(coarse.lat);
    expect(params[4]).not.toBe(original.lng);
    expect(params[5]).not.toBe(original.lat);
    expect(params[6]).toBe(cells.r4);
    expect(params[12]).toBe(cells.r10);
    expect(computeH3Cells(coarse.lat, coarse.lng)).toEqual(cells);
    expect(result.approxLocation).toEqual(coarse);
    expect(realtime.emitStoryNew).toHaveBeenCalledTimes(1);
  });
});

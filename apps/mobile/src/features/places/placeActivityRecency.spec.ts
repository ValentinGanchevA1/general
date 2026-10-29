import { formatPlaceActivityRecency } from './placeActivityRecency';

const NOW = Date.parse('2026-10-29T08:00:00.000Z');

describe('formatPlaceActivityRecency', () => {
  it('hides recency when the thresholded trend is inactive', () => {
    expect(
      formatPlaceActivityRecency(false, '2026-10-29T07:59:00.000Z', NOW),
    ).toBeNull();
  });

  it('hides missing or invalid timestamps', () => {
    expect(formatPlaceActivityRecency(true, null, NOW)).toBeNull();
    expect(formatPlaceActivityRecency(true, 'not-a-date', NOW)).toBeNull();
  });

  it('uses coarse buckets instead of exposing exact time', () => {
    expect(
      formatPlaceActivityRecency(true, '2026-10-29T07:58:00.000Z', NOW),
    ).toBe('Active moments ago');
    expect(
      formatPlaceActivityRecency(true, '2026-10-29T07:45:00.000Z', NOW),
    ).toBe('Active within the last 30 min');
    expect(
      formatPlaceActivityRecency(true, '2026-10-29T07:00:00.000Z', NOW),
    ).toBe('Active recently');
  });

  it('fails closed for stale trend timestamps', () => {
    expect(
      formatPlaceActivityRecency(true, '2026-10-29T05:30:00.000Z', NOW),
    ).toBeNull();
  });
});

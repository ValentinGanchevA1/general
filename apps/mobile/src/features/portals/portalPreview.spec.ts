import type { EventMeta } from '@g88/shared';

import { portalSheetInitialIndex, resolvePortalPreview } from './portalPreview';

const meta: EventMeta = {
  title: 'Nearby meetup',
  coverUrl: null,
  startsAt: '2026-11-10T18:00:00.000Z',
  attendeeCount: 4,
  capacity: 10,
};

describe('resolvePortalPreview', () => {
  const now = Date.parse('2026-11-06T09:00:00.000Z');

  it('shows an upcoming event without suggesting attendance or live presence', () => {
    expect(resolvePortalPreview(meta, now)).toEqual({
      status: 'upcoming',
      statusLabel: 'Upcoming',
      goingLabel: '4 going',
      capacityLabel: '10 capacity',
    });
  });

  it('does not assume a started event is currently live', () => {
    const result = resolvePortalPreview({ ...meta, startsAt: '2026-11-05T18:00:00.000Z' }, now);
    expect(result.status).toBe('started');
    expect(result.statusLabel).toContain('check event details');
    expect(result.statusLabel.toLowerCase()).not.toContain('live');
  });

  it('clearly flags an event at or above capacity', () => {
    expect(resolvePortalPreview({ ...meta, attendeeCount: 10 }, now).status).toBe('at-capacity');
    expect(resolvePortalPreview({ ...meta, attendeeCount: 12 }, now).status).toBe('at-capacity');
  });

  it('handles invalid schedules without claiming a start time', () => {
    const result = resolvePortalPreview({ ...meta, startsAt: 'invalid-date', capacity: null }, now);
    expect(result.status).toBe('schedule-unavailable');
    expect(result.capacityLabel).toBeNull();
  });

  it('opens Portal events on the existing expanded sheet, not on a new map surface', () => {
    expect(portalSheetInitialIndex('event')).toBe(1);
    expect(portalSheetInitialIndex('user')).toBe(0);
    expect(portalSheetInitialIndex('listing')).toBe(0);
    expect(portalSheetInitialIndex(null)).toBe(0);
  });

  it('never shows a negative count for bad discovery data', () => {
    const result = resolvePortalPreview({ ...meta, attendeeCount: -3, capacity: 0 }, now);
    expect(result.goingLabel).toBe('0 going');
    expect(result.capacityLabel).toBeNull();
  });
});

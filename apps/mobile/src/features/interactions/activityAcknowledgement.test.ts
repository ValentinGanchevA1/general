import type { InboxItem } from '@g88/shared';

import { activityAcknowledgementAt, hasUnseenActivity } from './activityAcknowledgement';

function item(id: string, createdAt: string): InboxItem {
  return {
    id,
    type: 'wave',
    createdAt,
    fromUser: { id: `peer-${id}`, displayName: `Peer ${id}`, avatarUrl: null },
  };
}

describe('activityAcknowledgementAt', () => {
  it('acknowledges only through the newest activity in the captured projection', () => {
    expect(
      activityAcknowledgementAt([
        item('older', '2026-10-20T08:00:00.000Z'),
        item('newer', '2026-10-20T08:05:00.000Z'),
      ]),
    ).toBe(new Date('2026-10-20T08:05:00.000Z').getTime());
  });

  it('ignores malformed timestamps and returns null for an unusable projection', () => {
    expect(activityAcknowledgementAt([item('bad', 'not-a-date')])).toBeNull();
    expect(activityAcknowledgementAt([])).toBeNull();
  });

  it('leaves activity arriving after the acknowledgement snapshot unseen', () => {
    const captured = [item('captured', '2026-10-20T08:05:00.000Z')];
    const acknowledgedAt = activityAcknowledgementAt(captured);
    expect(acknowledgedAt).not.toBeNull();

    const withLaterSocketActivity = [
      item('later', '2026-10-20T08:06:00.000Z'),
      ...captured,
    ];
    expect(hasUnseenActivity(withLaterSocketActivity, acknowledgedAt!)).toBe(true);
  });

  it('does not offer acknowledgement when the watermark already covers the projection', () => {
    const items = [item('seen', '2026-10-20T08:05:00.000Z')];
    expect(hasUnseenActivity(items, new Date('2026-10-20T08:05:00.000Z').getTime())).toBe(false);
  });
});

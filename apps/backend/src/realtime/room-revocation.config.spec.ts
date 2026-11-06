import { roomRevocationOutboxEnabled } from './room-revocation.config';

describe('roomRevocationOutboxEnabled', () => {
  it('defaults to disabled for safe schema-before-code rollout', () => {
    expect(roomRevocationOutboxEnabled({})).toBe(false);
    expect(roomRevocationOutboxEnabled({ ROOM_REVOCATION_OUTBOX_ENABLED: 'false' })).toBe(false);
  });

  it('only activates after an explicit true setting', () => {
    expect(roomRevocationOutboxEnabled({ ROOM_REVOCATION_OUTBOX_ENABLED: 'true' })).toBe(true);
    expect(roomRevocationOutboxEnabled({ ROOM_REVOCATION_OUTBOX_ENABLED: ' TRUE ' })).toBe(true);
  });

  it('rejects invalid values rather than silently changing the privacy rollout', () => {
    expect(() => roomRevocationOutboxEnabled({ ROOM_REVOCATION_OUTBOX_ENABLED: 'on' }))
      .toThrow('ROOM_REVOCATION_OUTBOX_ENABLED');
  });
});

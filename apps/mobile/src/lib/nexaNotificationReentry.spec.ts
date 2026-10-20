import { resolveNexaNotificationReentry } from './nexaNotificationReentry';

describe('resolveNexaNotificationReentry', () => {
  it('routes a v2 wave back to the peer on the map', () => {
    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'interaction.wave',
        actorUserId: 'user_123',
      }),
    ).toEqual({ type: 'map', focusUserId: 'user_123' });
  });

  it('routes messages only with a safe conversation id', () => {
    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'interaction.message',
        conversationId: 'conversation-42',
      }),
    ).toEqual({ type: 'chat', conversationId: 'conversation-42' });

    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'interaction.message',
        conversationId: '../bad',
      }),
    ).toEqual({ type: 'interactions' });
  });

  it('routes nearby event and listing entities to their canonical detail screens', () => {
    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'event.nearby',
        entityId: 'event_1',
      }),
    ).toEqual({ type: 'event-detail', eventId: 'event_1' });

    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'marketplace.nearby-listing',
        entityId: 'listing_1',
      }),
    ).toEqual({ type: 'listing-detail', listingId: 'listing_1' });
  });

  it('uses NEXA map-first destinations for live and trust notifications', () => {
    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'live.nearby-alert',
      }),
    ).toEqual({ type: 'pulse-nearby' });

    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'trust.id-rejected',
      }),
    ).toEqual({ type: 'trust-center' });
  });

  it('keeps legacy payloads working during the v2 migration', () => {
    expect(
      resolveNexaNotificationReentry({ type: 'event', eventId: 'event_legacy' }),
    ).toEqual({ type: 'event-detail', eventId: 'event_legacy' });

    expect(
      resolveNexaNotificationReentry({
        type: 'friend_accepted',
        peerUserId: 'peer_legacy',
      }),
    ).toEqual({ type: 'map', focusUserId: 'peer_legacy' });
  });

  it('falls back to the Map for malformed or unsupported payloads', () => {
    expect(resolveNexaNotificationReentry(undefined)).toEqual({ type: 'map' });
    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'event.unknown',
        entityId: 'x',
      }),
    ).toEqual({ type: 'map' });
    expect(
      resolveNexaNotificationReentry({
        schemaVersion: '2',
        kind: 'event.nearby',
        entityId: 'not/a/safe/id',
      }),
    ).toEqual({ type: 'map' });
  });
});

import { buildNexaPushData, nexaLockScreenCopy } from './notificationIdentity';

describe('NEXA notification identity v2', () => {
  it('builds a semantic envelope while retaining the legacy type', () => {
    expect(
      buildNexaPushData('event.nearby', {
        entityId: 'event_1',
        eventId: 'event_1',
      }),
    ).toEqual({
      schemaVersion: '2',
      kind: 'event.nearby',
      pillar: 'event',
      privacy: 'ambient',
      target: 'event-detail',
      type: 'event',
      entityId: 'event_1',
      eventId: 'event_1',
    });
  });

  it('does not expose arbitrary private fields through the builder API', () => {
    const data = buildNexaPushData('interaction.message', {
      conversationId: 'conversation_1',
    });
    expect(data).toMatchObject({
      privacy: 'sensitive',
      target: 'chat',
      conversationId: 'conversation_1',
    });
    expect(data).not.toHaveProperty('preview');
    expect(data).not.toHaveProperty('lat');
    expect(data).not.toHaveProperty('lng');
    expect(data).not.toHaveProperty('address');
  });

  it('keeps sensitive lock-screen copy generic', () => {
    const message = nexaLockScreenCopy('interaction.message');
    const rejected = nexaLockScreenCopy('trust.id-rejected');

    expect(message).toEqual({ title: 'New message', body: 'Open NEXA to read it.' });
    expect(rejected.body).not.toContain('rejected');
    expect(rejected.body).not.toContain('reason');
  });
});

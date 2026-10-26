import type { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import { DiscoveryPresencePublisher } from './discovery-presence.publisher';

describe('DiscoveryPresencePublisher', () => {
  const createSubject = () => {
    const publishEntityChangeToSubscribers = jest.fn().mockResolvedValue(1);
    const publishEntityMovement = jest.fn().mockResolvedValue(1);
    const discovery = {
      publishEntityChangeToSubscribers,
      publishEntityMovement,
    } as unknown as DiscoveryRealtimePublisher;
    return {
      subject: new DiscoveryPresencePublisher(discovery),
      publishEntityChangeToSubscribers,
      publishEntityMovement,
    };
  };

  it('publishes the first heartbeat as a current-location update', async () => {
    const { subject, publishEntityChangeToSubscribers, publishEntityMovement } = createSubject();
    const location = { lat: 43.2, lng: 27.9 };

    await subject.publishHeartbeat('user-1', location);

    expect(publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'user',
      entityId: 'user-1',
      location,
      change: 'update',
    });
    expect(publishEntityMovement).not.toHaveBeenCalled();
  });

  it('routes later heartbeats with the previous location', async () => {
    const { subject, publishEntityMovement } = createSubject();
    const previousLocation = { lat: 43.2, lng: 27.9 };
    const location = { lat: 43.25, lng: 27.95 };

    await subject.publishHeartbeat('user-1', previousLocation);
    await subject.publishHeartbeat('user-1', location);

    expect(publishEntityMovement).toHaveBeenCalledWith({
      kind: 'user',
      entityId: 'user-1',
      previousLocation,
      location,
    });
  });

  it('forgets movement history when presence is cleared', async () => {
    const { subject, publishEntityChangeToSubscribers, publishEntityMovement } = createSubject();

    await subject.publishHeartbeat('user-1', { lat: 43.2, lng: 27.9 });
    subject.clear('user-1');
    await subject.publishHeartbeat('user-1', { lat: 43.25, lng: 27.95 });

    expect(publishEntityChangeToSubscribers).toHaveBeenCalledTimes(2);
    expect(publishEntityMovement).not.toHaveBeenCalled();
  });
});

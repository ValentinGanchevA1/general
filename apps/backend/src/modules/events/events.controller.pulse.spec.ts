import type { RsvpResponse } from '@g88/shared';

import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';
import { EventPulseShareService } from './event-pulse-share.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

const response: RsvpResponse = {
  eventId: 'event-1',
  status: 'declined',
  attendeeCount: 4,
};

const revocation = {
  eventId: 'event-1',
  actorId: 'user-1',
  eventHostId: 'host-1',
  locationH3R7: '871ec91a5ffffff',
};

describe('EventsController Pulse RSVP revocation', () => {
  let rsvp: jest.Mock;
  let prepareJoinRevocation: jest.Mock;
  let revokePreparedJoin: jest.Mock;
  let controller: EventsController;

  beforeEach(() => {
    rsvp = jest.fn().mockResolvedValue(response);
    prepareJoinRevocation = jest.fn().mockResolvedValue(revocation);
    revokePreparedJoin = jest.fn();
    controller = new EventsController(
      { rsvp } as unknown as EventsService,
      { prepareJoinRevocation, revokePreparedJoin } as unknown as EventPulseShareService,
      {} as DiscoveryRealtimePublisher,
    );
  });

  it('revokes a previously shared join only after a successful non-Going RSVP', async () => {
    await expect(controller.rsvp('user-1', 'event-1', { status: 'declined' })).resolves.toEqual(response);

    expect(prepareJoinRevocation).toHaveBeenCalledWith('user-1', 'event-1');
    expect(rsvp).toHaveBeenCalledWith('user-1', 'event-1', { status: 'declined' });
    expect(revokePreparedJoin).toHaveBeenCalledWith(revocation);
  });

  it('does not revoke when the RSVP mutation fails', async () => {
    rsvp.mockRejectedValueOnce(new Error('transaction failed'));

    await expect(controller.rsvp('user-1', 'event-1', { status: 'maybe' })).rejects.toThrow('transaction failed');
    expect(prepareJoinRevocation).toHaveBeenCalledTimes(1);
    expect(revokePreparedJoin).not.toHaveBeenCalled();
  });

  it('does not query revocation state when RSVP remains Going', async () => {
    rsvp.mockResolvedValueOnce({ ...response, status: 'going' });

    await controller.rsvp('user-1', 'event-1', { status: 'going' });

    expect(prepareJoinRevocation).not.toHaveBeenCalled();
    expect(revokePreparedJoin).not.toHaveBeenCalled();
  });
});

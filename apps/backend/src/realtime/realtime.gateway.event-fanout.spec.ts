import type {
  EventPollDelta,
  EventQuestionDelta,
  EventQuestionUpvoteDelta,
} from '@g88/shared';
import { RealtimeGateway } from './realtime.gateway';

const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const allowedUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const revokedUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const questionAuthorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const questionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const poll: EventPollDelta = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  eventId,
  question: 'Where should we meet?',
  options: [],
  totalVotes: 0,
  closedAt: null,
};

const question: EventQuestionDelta = {
  id: questionId,
  eventId,
  userId: questionAuthorId,
  displayName: 'Organizer',
  body: 'Is the venue accessible?',
  upvotes: 0,
  answered: false,
  createdAt: '2026-11-06T08:00:00.000Z',
};

const upvote: EventQuestionUpvoteDelta = {
  eventId,
  questionId,
  upvotes: 1,
};

function setup() {
  const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
  const sockets: Array<{ id: string; data: { userId: string } }> = [
    { id: 'allowed-phone', data: { userId: allowedUserId } },
    { id: 'revoked-phone', data: { userId: revokedUserId } },
  ];
  const fetchSockets = jest.fn(async () => sockets);
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const inRoom = jest.fn().mockReturnValue({ fetchSockets });
  const authorizedViewerIds = jest.fn().mockResolvedValue(new Set([allowedUserId]));
  const logger = { error: jest.fn() };

  Object.assign(gateway, {
    server: { in: inRoom, to },
    eventRoomAccess: { authorizedViewerIds },
    logger,
  });

  return { gateway, sockets, fetchSockets, inRoom, to, emit, authorizedViewerIds, logger };
}

describe('RealtimeGateway authorized event delta fanout', () => {
  it('does not deliver an event poll to a stale room member after access was revoked', async () => {
    const { gateway, inRoom, to, emit, authorizedViewerIds } = setup();

    await expect(gateway.emitEventPoll(poll)).resolves.toBeUndefined();

    expect(inRoom).toHaveBeenCalledWith(`event:${eventId}`);
    expect(authorizedViewerIds).toHaveBeenCalledWith(
      eventId, [allowedUserId, revokedUserId], undefined,
    );
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith('allowed-phone');
    expect(to).not.toHaveBeenCalledWith(`event:${eventId}`);
    expect(emit).toHaveBeenCalledWith('event:poll', poll);
  });

  it('delivers to every authorized socket, including multiple devices', async () => {
    const { gateway, sockets, to, emit } = setup();
    sockets.push({ id: 'allowed-tablet', data: { userId: allowedUserId } });

    await gateway.emitEventPoll(poll);

    expect(to).toHaveBeenCalledTimes(2);
    expect(to).toHaveBeenCalledWith('allowed-phone');
    expect(to).toHaveBeenCalledWith('allowed-tablet');
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('applies the question-author block rule before sending question contents', async () => {
    const { gateway, authorizedViewerIds, to, emit } = setup();

    await gateway.emitEventQuestion(question);

    expect(authorizedViewerIds).toHaveBeenCalledWith(
      eventId, [allowedUserId, revokedUserId], { authorId: questionAuthorId },
    );
    expect(to).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('event:question', question);
  });

  it('resolves question-author access for upvote deltas by question id', async () => {
    const { gateway, authorizedViewerIds, to, emit } = setup();

    await gateway.emitEventQuestionUpvote(upvote);

    expect(authorizedViewerIds).toHaveBeenCalledWith(
      eventId, [allowedUserId, revokedUserId], { questionId },
    );
    expect(to).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('event:question:upvote', upvote);
  });

  it('does not emit any event payload when the access database is unavailable', async () => {
    const { gateway, authorizedViewerIds, to, logger } = setup();
    authorizedViewerIds.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(gateway.emitEventPoll(poll)).resolves.toBeUndefined();

    expect(to).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('skips authorization queries and delivery when no socket is subscribed', async () => {
    const { gateway, sockets, authorizedViewerIds, to } = setup();
    sockets.splice(0, sockets.length);

    await gateway.emitEventQuestion(question);

    expect(authorizedViewerIds).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
  });

  it('never sends an event upvote if the related question is inaccessible', async () => {
    const { gateway, authorizedViewerIds, to } = setup();
    authorizedViewerIds.mockResolvedValueOnce(new Set<string>());

    await gateway.emitEventQuestionUpvote(upvote);

    expect(to).not.toHaveBeenCalled();
  });
});

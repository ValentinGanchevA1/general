import { ModuleRef } from '@nestjs/core';

import { RealtimeEmitterService } from '../../realtime/realtime-emitter.service';
import { GroupConversationsController } from './group-conversations.controller';
import { GroupConversationsService } from './group-conversations.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const conversationId = '33333333-3333-4333-8333-333333333333';

describe('GroupConversationsController realtime membership revocation', () => {
  const removeMember = jest.fn<Promise<void>, [string, string, string]>();
  const leaveRoomForUsers = jest.fn<void, [readonly string[], string]>();
  const get = jest.fn().mockReturnValue({ leaveRoomForUsers });
  const controller = new GroupConversationsController(
    { removeMember } as unknown as GroupConversationsService,
    { get } as unknown as ModuleRef,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    removeMember.mockResolvedValue(undefined);
  });

  it('evicts only the removed member from the conversation on successful commit', async () => {
    await controller.removeMember(conversationId, memberId, actorId);

    expect(removeMember).toHaveBeenCalledWith(actorId, conversationId, memberId);
    expect(get).toHaveBeenCalledWith(RealtimeEmitterService, { strict: false });
    expect(leaveRoomForUsers).toHaveBeenCalledTimes(1);
    expect(leaveRoomForUsers).toHaveBeenCalledWith(
      [memberId],
      `convo:${conversationId}`,
    );
  });

  it('also revokes self-leave sockets, without removing the whole group', async () => {
    await controller.removeMember(conversationId, actorId, actorId);

    expect(leaveRoomForUsers).toHaveBeenCalledWith(
      [actorId],
      `convo:${conversationId}`,
    );
  });

  it('does not evict any device when membership change is rejected', async () => {
    removeMember.mockRejectedValueOnce(new Error('forbidden'));

    await expect(controller.removeMember(conversationId, memberId, actorId))
      .rejects.toThrow('forbidden');
    expect(get).not.toHaveBeenCalled();
    expect(leaveRoomForUsers).not.toHaveBeenCalled();
  });

  it('waits for transaction completion before evicting the former member', async () => {
    let commit: (() => void) | undefined;
    removeMember.mockImplementationOnce(() => new Promise<void>((resolve) => {
      commit = resolve;
    }));

    const removal = controller.removeMember(conversationId, memberId, actorId);
    expect(leaveRoomForUsers).not.toHaveBeenCalled();

    if (commit == null) throw new Error('Missing transaction resolver');
    commit();
    await removal;
    expect(leaveRoomForUsers).toHaveBeenCalledTimes(1);
  });
});

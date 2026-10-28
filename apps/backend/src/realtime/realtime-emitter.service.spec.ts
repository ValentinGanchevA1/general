import type { ModuleRef } from '@nestjs/core';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEmitterService } from './realtime-emitter.service';

describe('RealtimeEmitterService', () => {
  it('revokes every socket for both users from the conversation room via socketsLeave', () => {
    const socketsLeave = jest.fn();
    const inRoom = jest.fn(() => ({ socketsLeave }));
    const server = { in: inRoom };
    const moduleRef = {
      get: jest.fn().mockReturnValue({ server }),
    } as unknown as ModuleRef;
    const service = new RealtimeEmitterService(moduleRef);

    service.leaveRoomForUsers(['user-a', 'user-b', 'user-a'], 'convo:conversation-1');

    expect(moduleRef.get).toHaveBeenCalledWith(RealtimeGateway, { strict: false });
    expect(inRoom).toHaveBeenNthCalledWith(1, 'user:user-a');
    expect(inRoom).toHaveBeenNthCalledWith(2, 'user:user-b');
    expect(inRoom).toHaveBeenCalledTimes(2);
    expect(socketsLeave).toHaveBeenNthCalledWith(1, 'convo:conversation-1');
    expect(socketsLeave).toHaveBeenNthCalledWith(2, 'convo:conversation-1');
  });
});

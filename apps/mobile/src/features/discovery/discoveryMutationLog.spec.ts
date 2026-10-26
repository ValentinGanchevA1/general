import type { DiscoveryPointKey, EntityPoint } from '@g88/shared';

import { createDiscoveryMutationLog } from './discoveryMutationLog';

const userPoint: EntityPoint = {
  kind: 'user',
  id: 'user-1',
  lat: 42,
  lng: 27,
  meta: {
    displayName: 'User',
    avatarUrl: null,
    verification: 'none',
    online: false,
    lastSeenAt: null,
  },
};

describe('createDiscoveryMutationLog', () => {
  it('records only mutations newer than a captured request sequence', () => {
    const log = createDiscoveryMutationLog();
    log.recordUpsert(userPoint);
    const requestSequence = log.currentSequence();

    log.recordRemove('user:user-1' as DiscoveryPointKey);

    expect(log.mutationsAfter(requestSequence)).toEqual([
      {
        sequence: requestSequence + 1,
        type: 'remove',
        key: 'user:user-1',
      },
    ]);
  });

  it('keeps sequence monotonic when retained mutations are reset', () => {
    const log = createDiscoveryMutationLog();
    log.recordUpsert(userPoint);
    const beforeReset = log.currentSequence();

    log.reset();
    log.recordUpsert({ ...userPoint, lat: 43 });

    expect(log.currentSequence()).toBe(beforeReset + 1);
    expect(log.mutationsAfter(beforeReset)).toHaveLength(1);
  });

  it('retains the complete active request window', () => {
    const log = createDiscoveryMutationLog();
    const requestSequence = log.currentSequence();

    for (let index = 0; index < 300; index += 1) {
      log.recordUpsert({ ...userPoint, lat: 42 + index / 1000 });
    }

    expect(log.mutationsAfter(requestSequence)).toHaveLength(300);
  });
});

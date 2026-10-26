import type { DiscoveryPointKey, EntityPoint } from '@g88/shared';

import { createDiscoveryMutationLog } from './discoveryMutationLog';

const userPoint: EntityPoint = {
  kind: 'user',
  id: 'user-1',
  lat: 42,
  lng: 27,
  meta: {},
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

  it('bounds retained mutation history', () => {
    const log = createDiscoveryMutationLog(2);
    log.recordUpsert(userPoint);
    log.recordUpsert({ ...userPoint, lat: 43 });
    log.recordRemove('user:user-1' as DiscoveryPointKey);

    expect(log.mutationsAfter(0)).toHaveLength(2);
  });
});

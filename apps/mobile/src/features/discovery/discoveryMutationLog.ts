import type { DiscoveryPointKey, EntityPoint } from '@g88/shared';

import type { DiscoveryRealtimeMutation } from './discoveryMutationReplay';

export interface DiscoveryMutationLog {
  currentSequence: () => number;
  mutationsAfter: (sequence: number) => readonly DiscoveryRealtimeMutation[];
  recordUpsert: (point: EntityPoint) => void;
  recordRemove: (key: DiscoveryPointKey) => void;
  reset: () => void;
}

/**
 * Keeps the complete mutation history for the active HTTP request window.
 * Callers reset it at request boundaries, so correctness is never traded for
 * a fixed-size buffer while retained memory stays scoped to one request.
 */
export function createDiscoveryMutationLog(): DiscoveryMutationLog {
  let sequence = 0;
  let mutations: DiscoveryRealtimeMutation[] = [];

  return {
    currentSequence: () => sequence,
    mutationsAfter: (afterSequence) =>
      mutations.filter((mutation) => mutation.sequence > afterSequence),
    recordUpsert: (point) => {
      sequence += 1;
      mutations.push({ sequence, type: 'upsert', point });
    },
    recordRemove: (key) => {
      sequence += 1;
      mutations.push({ sequence, type: 'remove', key });
    },
    reset: () => {
      mutations = [];
    },
  };
}

import type { DiscoveryPointKey, EntityPoint } from '@g88/shared';

import type { DiscoveryRealtimeMutation } from './discoveryMutationReplay';

const DEFAULT_MAX_MUTATIONS = 256;

export interface DiscoveryMutationLog {
  currentSequence: () => number;
  mutationsAfter: (sequence: number) => readonly DiscoveryRealtimeMutation[];
  recordUpsert: (point: EntityPoint) => void;
  recordRemove: (key: DiscoveryPointKey) => void;
  reset: () => void;
}

export function createDiscoveryMutationLog(
  maxMutations = DEFAULT_MAX_MUTATIONS,
): DiscoveryMutationLog {
  let sequence = 0;
  let mutations: DiscoveryRealtimeMutation[] = [];

  const append = (mutation: DiscoveryRealtimeMutation): void => {
    mutations.push(mutation);
    if (mutations.length > maxMutations) {
      mutations = mutations.slice(mutations.length - maxMutations);
    }
  };

  return {
    currentSequence: () => sequence,
    mutationsAfter: (afterSequence) =>
      mutations.filter((mutation) => mutation.sequence > afterSequence),
    recordUpsert: (point) => {
      sequence += 1;
      append({ sequence, type: 'upsert', point });
    },
    recordRemove: (key) => {
      sequence += 1;
      append({ sequence, type: 'remove', key });
    },
    reset: () => {
      mutations = [];
    },
  };
}

import { resolveWorldSpatialContext } from './worldSpatialContext';

describe('World spatial context resolver (W2-2)', () => {
  it('maps Pathfinder to Experiences', () => {
    expect(resolveWorldSpatialContext('pathfinder')).toEqual({ lens: 'experiences', reason: 'world-focus' });
  });

  it('maps Bazaar to Opportunities', () => {
    expect(resolveWorldSpatialContext('bazaar')).toEqual({ lens: 'opportunities', reason: 'world-focus' });
  });

  it('maps Nocturne to Experiences without inventing time filters', () => {
    expect(resolveWorldSpatialContext('nocturne')).toEqual({ lens: 'experiences', reason: 'world-focus' });
  });

  it('leaves presentation-only Worlds unmapped', () => {
    for (const id of ['nexus', 'noir', 'profiler', 'diplomat', 'architect', 'vanguard', 'sanctuary'] as const) {
      expect(resolveWorldSpatialContext(id)).toBeNull();
    }
  });
});

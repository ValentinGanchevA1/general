import type { ClusterPoint } from '@g88/shared';

import {
  NEXA_CLUSTER_DOMINANT_SHARE,
  clusterAccessibilityLabel,
  clusterSizeForCount,
  formatClusterCount,
  resolveNexaClusterComposition,
  resolveNexaClusterVisual,
} from './nexaClusterVisuals';

function cluster(
  count: number,
  by: ClusterPoint['by'],
): ClusterPoint {
  return {
    kind: 'cluster',
    cellId: 'cell-1',
    lat: 42.0,
    lng: 27.0,
    count,
    by,
  };
}

describe('NEXA cluster visual grammar', () => {
  it('uses person geometry when people are clearly dominant', () => {
    const visual = resolveNexaClusterVisual(
      cluster(10, { user: 7, event: 2, listing: 1 }),
    );

    expect(visual.mode).toBe('user');
    expect(visual.shape).toBe('circle');
    expect(visual.composition.dominantShare).toBeCloseTo(0.7);
    expect(visual.showCompositionGlyphs).toBe(false);
  });

  it('uses event geometry when events are clearly dominant', () => {
    const visual = resolveNexaClusterVisual(
      cluster(10, { user: 2, event: 7, listing: 1 }),
    );

    expect(visual.mode).toBe('event');
    expect(visual.shape).toBe('star');
  });

  it('uses listing geometry when listings are clearly dominant', () => {
    const visual = resolveNexaClusterVisual(
      cluster(10, { user: 1, event: 1, listing: 8 }),
    );

    expect(visual.mode).toBe('listing');
    expect(visual.shape).toBe('square');
  });

  it('keeps balanced clusters neutral and mixed', () => {
    const visual = resolveNexaClusterVisual(
      cluster(10, { user: 4, event: 3, listing: 3 }),
    );

    expect(visual.mode).toBe('mixed');
    expect(visual.shape).toBe('circle');
    expect(visual.showCompositionGlyphs).toBe(true);
    expect(visual.composition.dominantKind).toBeNull();
  });

  it('accepts the dominance threshold boundary', () => {
    const composition = resolveNexaClusterComposition({
      user: NEXA_CLUSTER_DOMINANT_SHARE * 100,
      event: 20,
      listing: 15,
    });

    expect(composition.mode).toBe('user');
  });

  it('treats a single active category as dominant', () => {
    expect(resolveNexaClusterComposition({ event: 3 }).mode).toBe('event');
  });

  it('ignores invalid and negative breakdown values', () => {
    const composition = resolveNexaClusterComposition({
      user: -3,
      event: Number.NaN,
      listing: 4,
    });

    expect(composition.counts.user).toBe(0);
    expect(composition.counts.event).toBe(0);
    expect(composition.counts.listing).toBe(4);
    expect(composition.mode).toBe('listing');
  });

  it('uses deterministic cluster size tiers', () => {
    expect(clusterSizeForCount(2)).toBe(40);
    expect(clusterSizeForCount(9)).toBe(40);
    expect(clusterSizeForCount(10)).toBe(48);
    expect(clusterSizeForCount(49)).toBe(48);
    expect(clusterSizeForCount(50)).toBe(56);
  });

  it('caps large count labels without changing the underlying count', () => {
    expect(formatClusterCount(999)).toBe('999');
    expect(formatClusterCount(1000)).toBe('999+');
  });

  it('builds a screen-reader label with the semantic breakdown', () => {
    const label = clusterAccessibilityLabel(
      cluster(10, { user: 7, event: 2, listing: 1 }),
    );

    expect(label).toBe(
      'Cluster, 10 nearby: 7 people, 2 events, 1 listing. Double tap to zoom in.',
    );
  });
});

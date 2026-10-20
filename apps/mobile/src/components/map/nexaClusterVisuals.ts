import type { ClusterPoint, EntityKind } from '@g88/shared';

export type NexaClusterMode = EntityKind | 'mixed';
export type NexaClusterShape = 'circle' | 'diamond' | 'square';

export interface NexaClusterComposition {
  mode: NexaClusterMode;
  dominantKind: EntityKind | null;
  dominantShare: number;
  activeKinds: EntityKind[];
  counts: Record<EntityKind, number>;
  classifiedTotal: number;
}

export interface NexaClusterVisual {
  mode: NexaClusterMode;
  shape: NexaClusterShape;
  size: 40 | 48 | 56;
  countLabel: string;
  showCompositionGlyphs: boolean;
  composition: NexaClusterComposition;
}

/**
 * A category must represent at least 65% of classified items before the cluster
 * inherits that entity's geometry. Below that threshold, the cluster stays
 * neutral/mixed and exposes micro geometry for its composition.
 */
export const NEXA_CLUSTER_DOMINANT_SHARE = 0.65;

const ENTITY_KIND_ORDER: readonly EntityKind[] = ['user', 'event', 'listing'];

function safeCount(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function resolveNexaClusterComposition(
  by: ClusterPoint['by'],
): NexaClusterComposition {
  const counts: Record<EntityKind, number> = {
    user: safeCount(by.user),
    event: safeCount(by.event),
    listing: safeCount(by.listing),
  };

  const activeKinds = ENTITY_KIND_ORDER.filter((kind) => counts[kind] > 0);
  const classifiedTotal = activeKinds.reduce((sum, kind) => sum + counts[kind], 0);

  if (classifiedTotal === 0) {
    return {
      mode: 'mixed',
      dominantKind: null,
      dominantShare: 0,
      activeKinds,
      counts,
      classifiedTotal,
    };
  }

  let dominantKind: EntityKind = activeKinds[0] ?? 'user';
  for (const kind of activeKinds) {
    if (counts[kind] > counts[dominantKind]) dominantKind = kind;
  }

  const dominantShare = counts[dominantKind] / classifiedTotal;
  const hasSingleKind = activeKinds.length === 1;
  const isDominant =
    hasSingleKind || dominantShare >= NEXA_CLUSTER_DOMINANT_SHARE;

  return {
    mode: isDominant ? dominantKind : 'mixed',
    dominantKind: isDominant ? dominantKind : null,
    dominantShare,
    activeKinds,
    counts,
    classifiedTotal,
  };
}

export function clusterSizeForCount(count: number): 40 | 48 | 56 {
  if (count >= 50) return 56;
  if (count >= 10) return 48;
  return 40;
}

export function formatClusterCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count > 999) return '999+';
  return String(Math.floor(count));
}

export function resolveNexaClusterVisual(point: ClusterPoint): NexaClusterVisual {
  const composition = resolveNexaClusterComposition(point.by);
  const shape: NexaClusterShape =
    composition.mode === 'event'
      ? 'diamond'
      : composition.mode === 'listing'
        ? 'square'
        : 'circle';

  return {
    mode: composition.mode,
    shape,
    size: clusterSizeForCount(point.count),
    countLabel: formatClusterCount(point.count),
    showCompositionGlyphs: composition.mode === 'mixed' && composition.activeKinds.length > 0,
    composition,
  };
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function clusterAccessibilityLabel(point: ClusterPoint): string {
  const composition = resolveNexaClusterComposition(point.by);
  const parts: string[] = [];

  if (composition.counts.user > 0) {
    parts.push(pluralize(composition.counts.user, 'person', 'people'));
  }
  if (composition.counts.event > 0) {
    parts.push(pluralize(composition.counts.event, 'event', 'events'));
  }
  if (composition.counts.listing > 0) {
    parts.push(pluralize(composition.counts.listing, 'listing', 'listings'));
  }

  const breakdown = parts.length > 0 ? `: ${parts.join(', ')}` : '';
  return `Cluster, ${formatClusterCount(point.count)} nearby${breakdown}. Double tap to zoom in.`;
}

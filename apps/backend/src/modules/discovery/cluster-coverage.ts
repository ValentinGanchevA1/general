import * as h3 from 'h3-js';

import type { ClusterPoint, EntityKind } from '@g88/shared';

/** Already privacy-filtered/grouped SQL input; one row per H3 cell and entity kind. */
export interface ClusterCountRow {
  cell: string;
  kind: EntityKind;
  n: string;
}

export interface ClusterCoverage {
  points: ClusterPoint[];
  resolution: number;
}

interface Counts {
  count: number;
  by: Partial<Record<EntityKind, number>>;
}

interface CellCounts extends Counts {
  cellId: string;
  lat: number;
  lng: number;
}

interface ProjectedCluster extends Counts {
  latWeighted: number;
  lngSinWeighted: number;
  lngCosWeighted: number;
}

/**
 * Never drop a sparsely populated part of the map merely because a denser
 * area consumed the response cap. Coarsen the H3 hierarchy until EVERY
 * authorized source cell contributes to one returned cluster.
 *
 * This operates on the already viewer-filtered SQL counts, so private/blocked
 * entities are never counted (or revealed via an aggregate).
 *
 * The returned resolution is the ACTUAL H3 resolution. The weighted
 * representative position is based on source-cell centers; that keeps
 * boundary clusters anchored to the observed viewport rather than a parent
 * centroid that may be far outside the viewport.
 */
export function completeClusterCoverage(
  rows: readonly ClusterCountRow[],
  sourceResolution: number,
  maxPoints: number,
): ClusterCoverage {
  if (!Number.isInteger(sourceResolution) || sourceResolution < 0 || sourceResolution > 15) {
    throw new RangeError('Invalid cluster source resolution');
  }
  if (!Number.isInteger(maxPoints) || maxPoints <= 0) {
    throw new RangeError('Cluster budget must be positive');
  }

  const bySourceCell = new Map<string, Counts>();
  for (const row of rows) {
    const n = Number(row.n);
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new RangeError('Invalid authorized cluster count');
    }
    if (n === 0) continue;
    const existing = bySourceCell.get(row.cell) ?? { count: 0, by: {} };
    existing.count += n;
    existing.by[row.kind] = (existing.by[row.kind] ?? 0) + n;
    bySourceCell.set(row.cell, existing);
  }

  if (bySourceCell.size === 0) return { points: [], resolution: sourceResolution };

  const originals: CellCounts[] = [...bySourceCell.entries()].map(([cellId, slot]) => {
    const [lat, lng] = h3.cellToLatLng(cellId);
    return { cellId, count: slot.count, by: slot.by, lat, lng };
  });

  for (let resolution = sourceResolution; resolution >= 0; resolution -= 1) {
    const grouped = new Map<string, ProjectedCluster>();
    for (const source of originals) {
      const targetCell =
        resolution === sourceResolution
          ? source.cellId
          : h3.cellToParent(source.cellId, resolution);
      const aggregate = grouped.get(targetCell) ?? {
        count: 0,
        by: {},
        latWeighted: 0,
        lngSinWeighted: 0,
        lngCosWeighted: 0,
      };
      aggregate.count += source.count;
      aggregate.latWeighted += source.lat * source.count;
      const lngRadians = (source.lng * Math.PI) / 180;
      aggregate.lngSinWeighted += Math.sin(lngRadians) * source.count;
      aggregate.lngCosWeighted += Math.cos(lngRadians) * source.count;
      for (const kind of ['user', 'event', 'listing'] as const) {
        const n = source.by[kind] ?? 0;
        if (n > 0) aggregate.by[kind] = (aggregate.by[kind] ?? 0) + n;
      }
      grouped.set(targetCell, aggregate);
    }

    if (grouped.size > maxPoints) continue;

    const points: ClusterPoint[] = [...grouped.entries()]
      .map(([cellId, aggregate]) => ({
        kind: 'cluster' as const,
        cellId,
        lat: aggregate.latWeighted / aggregate.count,
        lng: (Math.atan2(aggregate.lngSinWeighted, aggregate.lngCosWeighted) * 180) / Math.PI,
        count: aggregate.count,
        by: aggregate.by,
      }))
      .sort((a, b) => b.count - a.count || a.cellId.localeCompare(b.cellId));

    return { points, resolution };
  }

  // With NEXA's 500-point budget, H3 resolution 0 has only 122 cells globally.
  // If the budget is ever reduced below the number of occupied base cells,
  // fail rather than quietly fabricate incomplete map coverage.
  throw new RangeError('Cluster budget cannot represent the complete viewport');
}

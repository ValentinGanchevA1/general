import * as h3 from 'h3-js';

import { completeClusterCoverage, type ClusterCountRow } from './cluster-coverage';

function makeCells(
  startLat: number,
  startLng: number,
  rows: number,
  columns: number,
  step = 0.016,
): string[] {
  const cells = new Set<string>();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      let lng = startLng + x * step;
      if (lng > 180) lng -= 360;
      cells.add(h3.latLngToCell(startLat + y * step, lng, 8));
    }
  }
  return [...cells];
}

describe('completeClusterCoverage', () => {
  it('keeps normal sub-budget clusters at their original resolution', () => {
    const cell = h3.latLngToCell(43.2, 27.9, 8);
    const output = completeClusterCoverage([
      { cell, kind: 'user', n: '10000' },
    ], 8, 500);
    expect(output.resolution).toBe(8);
    expect(output.points).toHaveLength(1);
    expect(output.points[0]).toMatchObject({
      kind: 'cluster',
      cellId: cell,
      count: 10000,
      by: { user: 10000 },
    });
  });

  it('coarsens >500 cells without dropping one of 10k+ authorized entities', () => {
    const cells = makeCells(42.1, 23.0, 40, 30);
    expect(cells.length).toBeGreaterThan(500);
    const source: ClusterCountRow[] = cells.flatMap((cell) => [
      { cell, kind: 'user', n: '8' },
      { cell, kind: 'event', n: '3' },
      { cell, kind: 'listing', n: '2' },
    ]);
    const output = completeClusterCoverage(source, 8, 500);
    expect(output.resolution).toBeLessThan(8);
    expect(output.points.length).toBeGreaterThan(0);
    expect(output.points.length).toBeLessThanOrEqual(500);
    expect(output.points.reduce((sum, point) => sum + point.count, 0))
      .toBe(cells.length * 13);
    for (const kind of ['user', 'event', 'listing'] as const) {
      const expected = cells.length * (kind === 'user' ? 8 : kind === 'event' ? 3 : 2);
      expect(output.points.reduce((sum, point) => sum + (point.by[kind] ?? 0), 0))
        .toBe(expected);
    }
    expect(output.points.every((point) => h3.getResolution(point.cellId) === output.resolution))
      .toBe(true);
    // Every eligible source cell belongs to some returned parent; even sparse
    // neighborhoods remain represented by an H3 parent at the effective level.
    const visible = new Set(output.points.map((point) => point.cellId));
    for (const cell of cells) {
      expect(visible.has(h3.cellToParent(cell, output.resolution))).toBe(true);
    }
  });

  it('preserves sparse cells instead of returning only a dense hotspot', () => {
    const cells = makeCells(42.1, 23.0, 40, 30);
    const hotspot = cells[0];
    expect(hotspot).toBeDefined();
    const source: ClusterCountRow[] = cells.map((cell) => ({
      cell,
      kind: 'user',
      n: cell === hotspot ? '10000' : '1',
    }));
    const output = completeClusterCoverage(source, 8, 500);
    expect(output.points.reduce((sum, point) => sum + point.count, 0))
      .toBe(10000 + cells.length - 1);
    expect(output.points.some((point) => point.count < 10000)).toBe(true);
  });

  it('keeps antimeridian cluster display coordinates near the date line', () => {
    const cells = makeCells(-0.2, 179.5, 35, 30, 0.025);
    expect(cells.length).toBeGreaterThan(500);
    const output = completeClusterCoverage(
      cells.map((cell) => ({ cell, kind: 'event', n: '3' })),
      8,
      500,
    );
    expect(output.points.length).toBeLessThanOrEqual(500);
    expect(output.points.every((point) => Math.abs(point.lng) > 170)).toBe(true);
    expect(output.points.reduce((sum, point) => sum + point.count, 0)).toBe(cells.length * 3);
  });

  it('returns no points without changing zoom resolution for an empty viewport', () => {
    expect(completeClusterCoverage([], 7, 500)).toEqual({ points: [], resolution: 7 });
  });

  it('fails closed if a cap below occupied H3 base cells cannot cover the viewport', () => {
    const cellA = h3.latLngToCell(42.7, 23.3, 8);
    const cellB = h3.latLngToCell(-33.9, 151.2, 8);
    expect(() => completeClusterCoverage([
      { cell: cellA, kind: 'user', n: '1' },
      { cell: cellB, kind: 'listing', n: '1' },
    ], 8, 1)).toThrow('Cluster budget cannot represent the complete viewport');
  });

  it('rejects invalid budgets and counts', () => {
    expect(() => completeClusterCoverage([], 8, 0)).toThrow();
    const cell = h3.latLngToCell(43.2, 27.9, 8);
    expect(() => completeClusterCoverage([{ cell, kind: 'user', n: '-1' }], 8, 500))
      .toThrow('Invalid authorized cluster count');
  });
});

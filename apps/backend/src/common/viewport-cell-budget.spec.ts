import {
  MAX_VIEWPORT_CELLS,
  VIEWPORT_CELL_ESTIMATE_MARGIN,
  cellsForViewport,
  estimateViewportCellCount,
  type Viewport,
} from '@g88/shared';

const cityViewport: Viewport = {
  sw: { lat: 43.15, lng: 27.82 },
  ne: { lat: 43.28, lng: 28.02 },
};

const globalViewport: Viewport = {
  sw: { lat: -85, lng: -180 },
  ne: { lat: 85, lng: 180 },
};

describe('viewport H3 cell budget', () => {
  it('allows a normal city viewport and keeps the materialized set bounded', () => {
    const estimate = estimateViewportCellCount(cityViewport, 7);
    const cells = cellsForViewport(cityViewport, 7);

    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThanOrEqual(
      MAX_VIEWPORT_CELLS * VIEWPORT_CELL_ESTIMATE_MARGIN,
    );
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(MAX_VIEWPORT_CELLS);
  });

  it('refuses a world-scale viewport before H3 can materialize it', () => {
    expect(estimateViewportCellCount(globalViewport, 4)).toBeGreaterThan(
      MAX_VIEWPORT_CELLS * VIEWPORT_CELL_ESTIMATE_MARGIN,
    );
    expect(cellsForViewport(globalViewport, 4)).toEqual([]);
  });

  it('does not collapse an exact 360-degree longitude span to zero', () => {
    const estimate = estimateViewportCellCount(
      {
        sw: { lat: -10, lng: -180 },
        ne: { lat: 10, lng: 180 },
      },
      4,
    );

    expect(estimate).toBeGreaterThan(0);
  });

  it('treats a small antimeridian viewport as a small span', () => {
    const estimate = estimateViewportCellCount(
      {
        sw: { lat: 10, lng: 179 },
        ne: { lat: 11, lng: -179 },
      },
      5,
    );

    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThan(500);
  });

  it('fails closed for invalid coordinates or unsupported H3 resolutions', () => {
    expect(
      estimateViewportCellCount(
        {
          sw: { lat: -91, lng: 0 },
          ne: { lat: 0, lng: 1 },
        },
        7,
      ),
    ).toBe(Number.POSITIVE_INFINITY);
    expect(cellsForViewport(cityViewport, 16)).toEqual([]);
  });
});

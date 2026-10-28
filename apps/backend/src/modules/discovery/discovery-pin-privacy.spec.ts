import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('discovery user pin privacy SQL', () => {
  const read = (file: string): string => readFileSync(join(__dirname, file), 'utf8');

  it.each([
    'discovery.service.ts',
    'discovery-entity-resolver.service.ts',
  ])('%s snaps only user coordinates while preserving other entity locations', (file) => {
    const source = read(file);
    expect(source).toContain("CASE WHEN kind = 'user' THEN ST_SnapToGrid(location::geometry, 0.02) ELSE location::geometry END");
    expect(source).toMatch(/ST_Y\(CASE WHEN kind = 'user' THEN ST_SnapToGrid/);
    expect(source).toMatch(/ST_X\(CASE WHEN kind = 'user' THEN ST_SnapToGrid/);
    expect(source).not.toMatch(/ST_Y\(location::geometry\) AS lat/);
    expect(source).not.toMatch(/ST_X\(location::geometry\) AS lng/);
  });
});

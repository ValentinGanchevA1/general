import { WORLD_MODE_IDS, WORLD_MODES, isWorldModeId } from './worldModes';
import { worldModePalettes } from '@/theme/worldModePalettes';

describe('World Modes manifest', () => {
  it('has exactly ten unique validated modes with accent tokens', () => {
    expect(WORLD_MODE_IDS).toHaveLength(10);
    expect(new Set(WORLD_MODE_IDS).size).toBe(10);
    for (const id of WORLD_MODE_IDS) {
      expect(WORLD_MODES[id].id).toBe(id);
      expect(WORLD_MODES[id].highlights).toHaveLength(3);
      expect(worldModePalettes[id].accent).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('rejects invalid and user-provided IDs', () => {
    expect(isWorldModeId('nexus')).toBe(true);
    expect(isWorldModeId('protos-nexus')).toBe(false);
    expect(isWorldModeId('__proto__')).toBe(false);
    expect(isWorldModeId(null)).toBe(false);
  });
});
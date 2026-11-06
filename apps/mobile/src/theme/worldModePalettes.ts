/**
 * World Modes affect only decorative UI accents. They must never override
 * semantic trust, verification, danger, success, privacy or premium tokens.
 */
export type WorldModePaletteId =
  | 'nexus' | 'noir' | 'profiler' | 'pathfinder' | 'nocturne'
  | 'diplomat' | 'architect' | 'bazaar' | 'vanguard' | 'sanctuary';

export type WorldModePalette = Readonly<{
  accent: string;
  secondary: string;
  glow: string;
}>;

export const worldModePalettes: Readonly<Record<WorldModePaletteId, WorldModePalette>> = {
  nexus: { accent: '#A18AFF', secondary: '#3BD9F3', glow: 'rgba(161,138,255,0.18)' },
  noir: { accent: '#B3D7EA', secondary: '#8499AD', glow: 'rgba(179,215,234,0.12)' },
  profiler: { accent: '#C49AFF', secondary: '#72E6CE', glow: 'rgba(196,154,255,0.18)' },
  pathfinder: { accent: '#42E3CC', secondary: '#FFC66C', glow: 'rgba(66,227,204,0.14)' },
  nocturne: { accent: '#C49BFF', secondary: '#E68AD9', glow: 'rgba(196,155,255,0.18)' },
  diplomat: { accent: '#EEC479', secondary: '#9BCBDC', glow: 'rgba(238,196,121,0.14)' },
  architect: { accent: '#48DCFA', secondary: '#779AFF', glow: 'rgba(72,220,250,0.14)' },
  bazaar: { accent: '#FF9289', secondary: '#FFBF72', glow: 'rgba(255,146,137,0.16)' },
  vanguard: { accent: '#FF6B80', secondary: '#51C9FE', glow: 'rgba(255,107,128,0.16)' },
  sanctuary: { accent: '#8CE8C4', secondary: '#BDE5D3', glow: 'rgba(140,232,196,0.14)' },
};
import type { Region } from 'react-native-maps';
import type { EntityPoint } from '@g88/shared';

import { NEXA_MOTION_MS, resolveNexaMotionDuration } from '@/motion/nexaMotion';

export const NEXA_ENTITY_SHEET_SNAP_POINTS = ['36%', '62%'] as const;
export type NexaEntitySheetSnapIndex = 0 | 1;

export interface NexaMapSheetChoreography {
  snapIndex: NexaEntitySheetSnapIndex;
  sheetCoverage: number;
  markerScreenY: number;
  durationMs: number;
}

const CHOREOGRAPHY_BY_SNAP: Record<NexaEntitySheetSnapIndex, NexaMapSheetChoreography> = {
  0: {
    snapIndex: 0,
    sheetCoverage: 0.36,
    markerScreenY: 0.32,
    durationMs: NEXA_MOTION_MS.sheet,
  },
  1: {
    snapIndex: 1,
    sheetCoverage: 0.62,
    markerScreenY: 0.19,
    durationMs: NEXA_MOTION_MS.map,
  },
};

export function resolveNexaSheetChoreography(index: number): NexaMapSheetChoreography {
  return CHOREOGRAPHY_BY_SNAP[index >= 1 ? 1 : 0];
}

export function nexaEntitySelectionKey(point: EntityPoint): string {
  return `${point.kind}:${point.id}`;
}

/**
 * Offsets the camera center so the selected map entity sits in the visible map
 * area above the sheet. No entity coordinates are changed or persisted.
 */
export function regionForSelectedEntity(
  current: Region,
  point: Pick<EntityPoint, 'lat' | 'lng'>,
  snapIndex: number,
): Region {
  const choreography = resolveNexaSheetChoreography(snapIndex);
  const verticalShift = 0.5 - choreography.markerScreenY;

  return {
    latitude: point.lat - current.latitudeDelta * verticalShift,
    longitude: point.lng,
    latitudeDelta: current.latitudeDelta,
    longitudeDelta: current.longitudeDelta,
  };
}

export function mapAnimationDuration(
  snapIndex: number,
  reduceMotion: boolean,
): number {
  return resolveNexaMotionDuration(
    snapIndex >= 1 ? 'map' : 'sheet',
    reduceMotion,
    'skip',
  );
}

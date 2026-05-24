// apps/mobile/src/components/ContextualFab/useFabContext.ts
//
// Pure context computation for the Contextual FAB.
// Inputs: viewport zoom, viewport entities, my visibility + primary goal.
// Output: a stable context key + primary action + ranked secondaries.

import { useEffect, useMemo, useRef } from 'react';
import type { DiscoveryPoint } from '@g88/shared';
import { ENTITY_ZOOM_THRESHOLD } from '@g88/shared';

import { useAppSelector } from '@/hooks/redux';
import { track } from '@/lib/analytics';

export type ZoomBand = 'far' | 'mid' | 'near';
export type Density = 0 | 1 | 2 | 3;
export type Visibility = 'on' | 'off';

export type FabActionId =
  | 'wave_nearest'
  | 'post_alert'
  | 'create_listing'
  | 'toggle_visibility'
  | 'open_pulse';

export interface FabContext {
  key: string;
  zoomBand: ZoomBand;
  density: Density;
  visibility: Visibility;
  goalsPrimary: string;
  primary: FabActionId;
  secondary: FabActionId[];
  nearestUserId: string | null;
}

const ALL_ACTIONS: FabActionId[] = [
  'wave_nearest', 'post_alert', 'create_listing', 'toggle_visibility', 'open_pulse',
];

// ─── C3 flag ──────────────────────────────────────────────────────────────
// When AlertComposerScreen ships real impl (P2.5 / X3), flip to `true` and
// the FAB's default-case primary becomes `post_alert` per the user's Q1 pick.
// Until then the FAB falls back to `open_pulse` so the primary tap never
// lands on a "Coming soon" stub.
export const POST_ALERT_READY = false;

function bandForZoom(z: number): ZoomBand {
  if (z >= ENTITY_ZOOM_THRESHOLD) return 'near';
  if (z >= 11) return 'mid';
  return 'far';
}

function densityFor(points: DiscoveryPoint[]): Density {
  const n = points.filter((p) => p.kind === 'user').length;
  if (n === 0) return 0;
  if (n < 5) return 1;
  if (n < 20) return 2;
  return 3;
}

function pickPrimary(
  zoomBand: ZoomBand,
  density: Density,
  visibility: Visibility,
  goal: string,
  nearestUserId: string | null,
): FabActionId {
  if (visibility === 'off') return 'toggle_visibility';
  if (zoomBand === 'near' && density >= 1 && nearestUserId !== null) return 'wave_nearest';
  if (zoomBand !== 'far' && goal === 'trading') return 'create_listing';
  return POST_ALERT_READY ? 'post_alert' : 'open_pulse';
}

function secondaryRanked(primary: FabActionId, zoomBand: ZoomBand): FabActionId[] {
  const rest = ALL_ACTIONS.filter((a) => a !== primary);
  const score = (a: FabActionId): number => {
    if (a === 'open_pulse' && zoomBand === 'far') return 10;
    if (a === 'wave_nearest' && zoomBand !== 'near') return 0;
    if (a === 'create_listing' && zoomBand === 'far') return 1;
    if (a === 'post_alert' && zoomBand === 'far') return 2;
    return 5;
  };
  return rest.sort((a, b) => score(b) - score(a)).slice(0, 3);
}

interface UseFabContextArgs {
  zoom: number;
  points: DiscoveryPoint[];
  nearestUserId: string | null;
}

export function useFabContext(args: UseFabContextArgs): FabContext {
  const isVisible = useAppSelector(
    (s) => (s.profile.profile?.visibility ?? 'public') === 'public',
  );
  const goalsPrimary = useAppSelector(
    (s) => s.profile.profile?.goals?.[0] ?? 'dating',
  );

  const ctx = useMemo<FabContext>(() => {
    const zoomBand = bandForZoom(args.zoom);
    const density = densityFor(args.points);
    const visibility: Visibility = isVisible ? 'on' : 'off';
    const primary = pickPrimary(zoomBand, density, visibility, goalsPrimary, args.nearestUserId);
    const secondary = secondaryRanked(primary, zoomBand);
    const key = `z:${zoomBand}|d:${density}|v:${visibility}|g:${goalsPrimary}`;
    return {
      key,
      zoomBand,
      density,
      visibility,
      goalsPrimary,
      primary,
      secondary,
      nearestUserId: args.nearestUserId,
    };
  }, [args.zoom, args.points, args.nearestUserId, isVisible, goalsPrimary]);

  // Emit only when the key flips. Cheap dedupe; no setInterval, no race.
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === ctx.key) return;
    lastKey.current = ctx.key;
    track('fab.context.computed', {
      contextKey: ctx.key,
      zoomBand: ctx.zoomBand,
      density: ctx.density,
      visibility: ctx.visibility,
      goalsPrimary: ctx.goalsPrimary,
      primaryActionId: ctx.primary,
    });
  }, [ctx]);

  return ctx;
}

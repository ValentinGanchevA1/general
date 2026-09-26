/** Dating map preferences (v1). Identity fields stay optional. */

import type { Gender } from './identity';
import { isGender } from './identity';

/** Owner-only prefs returned on UserProfile / editable via UpdateProfileRequest. */
export interface DatingPreferences {
  openToDating: boolean;
  /** Empty = anyone. */
  seekingGenders: Gender[];
}

export function parseSeekingGenders(raw: unknown): Gender[] {
  if (!Array.isArray(raw)) return [];
  const out: Gender[] = [];
  for (const v of raw) {
    if (isGender(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Hard gate: does candidate pass viewer prefs (and mutual seeking)?
 * Missing gender on either side does not fail the gate (identity optional).
 */
export function passesDatingGenderGate(opts: {
  viewerGender: Gender | null | undefined;
  viewerSeeking: readonly Gender[];
  candidateGender: Gender | null | undefined;
  candidateSeeking: readonly Gender[];
}): boolean {
  const { viewerGender, viewerSeeking, candidateGender, candidateSeeking } = opts;
  if (viewerSeeking.length > 0 && candidateGender != null) {
    if (!viewerSeeking.includes(candidateGender)) return false;
  }
  if (candidateSeeking.length > 0 && viewerGender != null) {
    if (!candidateSeeking.includes(viewerGender)) return false;
  }
  return true;
}

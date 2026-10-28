import type { ActivityItem } from '@g88/shared';

export interface ActivitySentenceParts {
  actor: string;
  verb: string;
  objectLabel: string | null;
  placeLabel: string | null;
}

/**
 * Converts backend narrative metadata into display-safe sentence parts.
 * Coordinates never participate in the sentence; placeLabel is server-approved
 * human-readable context only.
 */
export function getActivitySentence(item: ActivityItem): ActivitySentenceParts | null {
  const narrative = item.narrative;
  if (!narrative) return null;

  if (narrative.kind === 'place_trending') {
    return {
      actor: narrative.objectLabel,
      verb: 'is getting active',
      objectLabel: null,
      placeLabel: null,
    };
  }

  return {
    actor: item.actorName?.trim() || 'Someone',
    verb: narrative.verb,
    objectLabel: narrative.objectLabel,
    placeLabel: narrative.placeLabel,
  };
}

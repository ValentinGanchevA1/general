import type { ActivityItem } from '@g88/shared';

export interface ActivitySentenceParts {
  actor: string;
  verb: string;
  objectLabel: string;
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

  return {
    actor: item.actorName?.trim() || 'Someone',
    verb: narrative.verb,
    objectLabel: narrative.objectLabel,
    placeLabel: narrative.placeLabel,
  };
}

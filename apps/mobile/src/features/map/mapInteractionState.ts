export type MapInteractionState =
  | 'idle'
  | 'quick_peek'
  | 'detail'
  | 'full_profile';

export interface MapInteractionStateInput {
  showPreview: boolean;
  isDetail: boolean;
  isFull: boolean;
}

/**
 * Renderer-neutral presentation state for the user-pin interaction ladder.
 *
 * Precedence is intentional: full profile and detail are stronger stages than
 * preview. This keeps map chrome/renderers from re-deriving lifecycle state
 * from several booleans with subtly different rules.
 */
export function resolveMapInteractionState({
  showPreview,
  isDetail,
  isFull,
}: MapInteractionStateInput): MapInteractionState {
  if (isFull) return 'full_profile';
  if (isDetail) return 'detail';
  if (showPreview) return 'quick_peek';
  return 'idle';
}

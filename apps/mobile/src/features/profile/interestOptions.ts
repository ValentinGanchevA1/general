export type InterestCategory =
  | 'sports'
  | 'entertainment'
  | 'lifestyle'
  | 'creative'
  | 'technology';

export interface InterestOption {
  value: string;
  label: string;
  icon: string;
  category: InterestCategory;
}

/**
 * Stable, normalized profile interests used for discovery, suggestions and matching.
 * Values are intentionally lowercase machine keys; labels are user-facing copy.
 */
export const INTEREST_OPTIONS: readonly InterestOption[] = [
  { value: 'football', label: 'Football', icon: '⚽', category: 'sports' },
  { value: 'basketball', label: 'Basketball', icon: '🏀', category: 'sports' },
  { value: 'tennis', label: 'Tennis', icon: '🎾', category: 'sports' },
  { value: 'fitness', label: 'Fitness', icon: '🏋️', category: 'sports' },
  { value: 'running', label: 'Running', icon: '🏃', category: 'sports' },
  { value: 'music', label: 'Music', icon: '🎵', category: 'entertainment' },
  { value: 'cinema', label: 'Cinema', icon: '🎬', category: 'entertainment' },
  { value: 'gaming', label: 'Gaming', icon: '🎮', category: 'entertainment' },
  { value: 'series', label: 'Series', icon: '📺', category: 'entertainment' },
  { value: 'reading', label: 'Reading', icon: '📚', category: 'lifestyle' },
  { value: 'travel', label: 'Travel', icon: '✈️', category: 'lifestyle' },
  { value: 'cooking', label: 'Cooking', icon: '🍳', category: 'lifestyle' },
  { value: 'nature', label: 'Nature', icon: '🌿', category: 'lifestyle' },
  { value: 'pets', label: 'Pets', icon: '🐾', category: 'lifestyle' },
  { value: 'photography', label: 'Photography', icon: '📷', category: 'creative' },
  { value: 'art', label: 'Art', icon: '🎨', category: 'creative' },
  { value: 'design', label: 'Design', icon: '✏️', category: 'creative' },
  { value: 'technology', label: 'Technology', icon: '💻', category: 'technology' },
  { value: 'ai', label: 'AI', icon: '🤖', category: 'technology' },
  { value: 'cybersecurity', label: 'Cybersecurity', icon: '🔐', category: 'technology' },
];

export function interestLabel(value: string): string {
  return INTEREST_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

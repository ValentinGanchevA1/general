export interface PurposeOption {
  value: string;
  label: string;
  icon: string;
}

/**
 * Product language: Purpose = the user's core reason for using NEXA.
 * Persistence remains `goals` for backward compatibility with matching and messaging.
 */
export const PURPOSE_OPTIONS: readonly PurposeOption[] = [
  { value: 'meet', label: 'Meet people', icon: '👋' },
  { value: 'events', label: 'Local events', icon: '🎉' },
  { value: 'networking', label: 'Networking', icon: '💼' },
  { value: 'explore', label: 'Explore area', icon: '🗺️' },
  { value: 'activities', label: 'Activity partner', icon: '⚽' },
  { value: 'chat', label: 'Just chatting', icon: '💬' },
];

/** @deprecated Use PURPOSE_OPTIONS in UI code. Kept to avoid breaking older imports. */
export const GOAL_OPTIONS = PURPOSE_OPTIONS;
export type GoalOption = PurposeOption;

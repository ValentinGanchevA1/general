export interface GoalOption {
  value: string;
  label: string;
  icon: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  { value: 'meet', label: 'Meet people', icon: '👋' },
  { value: 'events', label: 'Local events', icon: '🎉' },
  { value: 'networking', label: 'Networking', icon: '💼' },
  { value: 'explore', label: 'Explore area', icon: '🗺️' },
  { value: 'activities', label: 'Activity partner', icon: '⚽' },
  { value: 'chat', label: 'Just chatting', icon: '💬' },
];

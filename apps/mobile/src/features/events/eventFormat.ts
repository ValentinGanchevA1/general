// apps/mobile/src/features/events/eventFormat.ts
//
// Small presentation helpers shared by the events screens. Kept dependency-free
// (Hermes Intl) — no moment/date-fns native deps on the RN 0.83 surface.

export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (!endsAt) return `${date} · ${time}`;
  const end = new Date(endsAt);
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}–${endTime}`;
}

/** "Today" / "Tomorrow" / weekday label for compact rail cards. */
export function formatEventDayShort(startsAt: string): string {
  const start = new Date(startsAt);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

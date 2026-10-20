import type { InboxItem } from '@g88/shared';

/**
 * Resolve the newest valid Activity timestamp that was present when the user
 * explicitly acknowledged the current Activity projection.
 *
 * Using an item timestamp instead of Date.now() ensures activity arriving
 * after this snapshot remains unseen even if socket/refetch work races with
 * the acknowledgement action.
 */
export function activityAcknowledgementAt(items: readonly InboxItem[]): number | null {
  let newestAtMs: number | null = null;

  for (const item of items) {
    const atMs = new Date(item.createdAt).getTime();
    if (!Number.isFinite(atMs)) continue;
    if (newestAtMs == null || atMs > newestAtMs) newestAtMs = atMs;
  }

  return newestAtMs;
}

export function hasUnseenActivity(items: readonly InboxItem[], seenAtMs: number): boolean {
  const newestAtMs = activityAcknowledgementAt(items);
  return newestAtMs != null && newestAtMs > seenAtMs;
}

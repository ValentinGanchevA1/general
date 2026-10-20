/**
 * Client-side aggregation for Interactions → Activity.
 * Repeated signals collapse only when both actor and signal type match.
 * This prevents a newer gift/wave from inheriting the label or CTA of an
 * older match/friend request from the same person.
 */

import type { InboxItem } from '@g88/shared';

export type AggregatedInboxRow = {
  /** Stable FlatList key */
  key: string;
  /** Newest item in this actor + type group; drives CTA + label. */
  primary: InboxItem;
  /** Raw items for this actor + type (newest first). */
  items: InboxItem[];
  count: number;
  latestAt: string;
};

/** Group by actor + signal type and sort groups by their real latest activity. */
export function aggregateInbox(items: InboxItem[]): AggregatedInboxRow[] {
  const groups = new Map<string, InboxItem[]>();

  for (const item of items) {
    const key = `${item.fromUser.id}:${item.type}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const rows: AggregatedInboxRow[] = [];

  for (const [groupKey, groupItems] of groups) {
    const sorted = [...groupItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const primary = sorted[0]!;

    rows.push({
      key: `agg-${groupKey}`,
      primary,
      items: sorted,
      count: sorted.length,
      latestAt: primary.createdAt,
    });
  }

  return rows.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );
}

/** Human label for an aggregated personal-activity row. */
export function aggregatedSignalLabel(primary: InboxItem, count: number): string {
  let base: string;
  if (primary.type === 'match') {
    base = 'matched with you';
  } else if (primary.type === 'wave') {
    base = 'waved at you';
  } else if (primary.type === 'friend_request') {
    base = 'sent you a friend request';
  } else if (primary.type === 'follow') {
    base = 'started following you';
  } else if (primary.type === 'gift') {
    const gift = primary.gift;
    base = gift ? `sent you ${gift.emoji} ${gift.label}` : 'sent you a gift';
  } else if (primary.reactionKind === 'heart') {
    base = '❤️ reacted to your story';
  } else if (primary.reactionKind === 'wave') {
    base = '👋 reacted to your story';
  } else if (primary.reactionKind != null) {
    base = 'reacted to your story';
  } else {
    base = 'interacted with you';
  }

  if (count <= 1) return base;
  return `${base} · ${count}×`;
}

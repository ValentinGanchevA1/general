/**
 * Client-side aggregation for Interactions → Activity.
 * Collapses repeated waves / follows / reactions from the same actor
 * into a single row with a count. Preserves CTA priority:
 * friend_request > wave > story_reaction > follow.
 *
 * Backend still returns discrete events; this is UI-only until a
 * grouped inbox endpoint exists.
 */

import type { InboxItem } from '@g88/shared';

export type AggregatedInboxRow = {
  /** Stable FlatList key */
  key: string;
  /** Highest-priority item that drives CTA + primary label */
  primary: InboxItem;
  /** All raw items for this actor (newest first) */
  items: InboxItem[];
  count: number;
  latestAt: string;
};

const TYPE_RANK: Record<InboxItem['type'], number> = {
  friend_request: 0,
  wave: 1,
  story_reaction: 2,
  follow: 3,
};

/**
 * Group by fromUser.id, pick highest-priority type as primary,
 * sort groups by latest activity.
 */
export function aggregateInbox(items: InboxItem[]): AggregatedInboxRow[] {
  const byActor = new Map<string, InboxItem[]>();

  for (const item of items) {
    const id = item.fromUser.id;
    const list = byActor.get(id) ?? [];
    list.push(item);
    byActor.set(id, list);
  }

  const rows: AggregatedInboxRow[] = [];

  for (const [actorId, actorItems] of byActor) {
    const sorted = [...actorItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const primary = sorted.reduce((best, cur) =>
      TYPE_RANK[cur.type] < TYPE_RANK[best.type] ? cur : best,
    );

    rows.push({
      key: `agg-${actorId}-${primary.type}`,
      primary,
      items: sorted,
      count: sorted.length,
      latestAt: sorted[0]!.createdAt,
    });
  }

  return rows.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );
}

/**
 * Human label for an aggregated row.
 * Shows count when the actor produced >1 signals of the primary type
 * (or mixed types under the same actor).
 */
export function aggregatedSignalLabel(primary: InboxItem, count: number): string {
  let base: string;
  if (primary.type === 'wave') {
    base = 'waved at you';
  } else if (primary.type === 'friend_request') {
    base = 'sent you a friend request';
  } else if (primary.type === 'follow') {
    base = 'started following you';
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

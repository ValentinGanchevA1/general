import type { InboxItem, PersonalNotificationDestination } from '@g88/shared';

export type InboxDestination =
  | { kind: 'chat'; conversationId: string; otherUserId: string; otherUserName: string }
  | { kind: 'profile'; userId: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'listing'; listingId: string };

function notificationDestination(
  destination: PersonalNotificationDestination,
  item: InboxItem,
): InboxDestination {
  if (destination.type === 'chat' && destination.conversationId.trim()) {
    return {
      kind: 'chat',
      conversationId: destination.conversationId.trim(),
      otherUserId: item.fromUser.id,
      otherUserName: item.fromUser.displayName,
    };
  }
  if (destination.type === 'event' && destination.eventId.trim()) {
    return { kind: 'event', eventId: destination.eventId.trim() };
  }
  if (destination.type === 'listing' && destination.listingId.trim()) {
    return { kind: 'listing', listingId: destination.listingId.trim() };
  }
  if (destination.type === 'profile' && destination.userId.trim()) {
    return { kind: 'profile', userId: destination.userId.trim() };
  }
  return { kind: 'profile', userId: item.fromUser.id };
}

export function inboxDestination(item: InboxItem): InboxDestination {
  if (item.type === 'notification' && item.notification) {
    return notificationDestination(item.notification.destination, item);
  }

  const conversationId = item.type === 'match' ? item.match?.conversationId?.trim() : undefined;
  if (conversationId) {
    return {
      kind: 'chat',
      conversationId,
      otherUserId: item.fromUser.id,
      otherUserName: item.fromUser.displayName,
    };
  }

  return { kind: 'profile', userId: item.fromUser.id };
}

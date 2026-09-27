import type { ListingModeFilterValue } from '@/components/map/MapFilterRow';

export type MapEmptyActionKind =
  | 'show_everyone'
  | 'create'
  | 'verify_email'
  | 'dating_prefs'
  | 'clear_dating';

export function mapEmptyCopy(opts: {
  friendsOnly: boolean;
  datingOnly: boolean;
  openToDating: boolean;
  listingMode: ListingModeFilterValue;
  emailVerified: boolean;
}): {
  icon: string;
  title: string;
  body: string;
  actionLabel: string;
  actionKind: MapEmptyActionKind;
} {
  if (opts.friendsOnly) {
    return {
      icon: 'account-group-outline',
      title: 'No friends nearby',
      body: 'None of your friends are in this area right now. Pan the map or turn Friends off.',
      actionLabel: 'Show everyone',
      actionKind: 'show_everyone',
    };
  }
  if (opts.datingOnly) {
    if (!opts.openToDating) {
      return {
        icon: 'heart-outline',
        title: 'Turn on Dating to see matches',
        body: 'Enable Open to dating in your profile and set who you are seeking. Only people who opted in appear on this layer.',
        actionLabel: 'Dating preferences',
        actionKind: 'dating_prefs',
      };
    }
    return {
      icon: 'heart-outline',
      title: 'No dating matches here',
      body: 'Nobody nearby matches your preferences right now. Pan the map, widen who you seek, or turn Dating off.',
      actionLabel: 'Clear Dating filter',
      actionKind: 'clear_dating',
    };
  }
  if (opts.listingMode === 'sell') {
    return {
      icon: 'tag-outline',
      title: 'No for-sale listings here',
      body: 'Nothing for sale in this area. Post one, or switch the filter to All.',
      actionLabel: 'Create here',
      actionKind: 'create',
    };
  }
  if (opts.listingMode === 'buy') {
    return {
      icon: 'cart-outline',
      title: 'No wanted posts here',
      body: 'Nobody is looking to buy in this area yet. Post a wanted, or switch the filter to All.',
      actionLabel: 'Create here',
      actionKind: 'create',
    };
  }
  if (!opts.emailVerified) {
    return {
      icon: 'email-check-outline',
      title: 'Verify email to get started',
      body: 'Confirm your email so people can trust you on the map — then be the first to post something nearby.',
      actionLabel: 'Verify email',
      actionKind: 'verify_email',
    };
  }
  return {
    icon: 'map-marker-radius-outline',
    title: 'Nothing nearby yet',
    body: 'Be the first — sell something, post a wanted, create an event, or drop a local alert. Tap + in the filter bar or long-press the map.',
    actionLabel: 'Create here',
    actionKind: 'create',
  };
}

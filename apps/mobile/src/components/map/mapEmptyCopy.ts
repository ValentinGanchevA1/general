import type { ListingModeFilterValue } from '@/components/map/MapFilterRow';

export type MapEmptyActionKind =
  | 'show_everyone'
  | 'create'
  | 'verify_email'
  | 'dating_prefs'
  | 'clear_dating';

export interface MapEmptyCopy {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  actionKind: MapEmptyActionKind;
}

export function mapEmptyCopy(opts: {
  friendsOnly: boolean;
  datingOnly: boolean;
  openToDating: boolean;
  listingMode: ListingModeFilterValue;
  emailVerified: boolean;
}): MapEmptyCopy {
  if (opts.friendsOnly) {
    return {
      icon: 'account-group-outline',
      eyebrow: 'People layer',
      title: 'No friends in this view',
      body: 'Move the map to another area or show everyone nearby.',
      actionLabel: 'Show everyone',
      actionKind: 'show_everyone',
    };
  }
  if (opts.datingOnly) {
    if (!opts.openToDating) {
      return {
        icon: 'heart-outline',
        eyebrow: 'Dating layer',
        title: 'Dating discovery is off',
        body: 'Turn on Open to dating and choose who you want to discover. Only opted-in people can appear here.',
        actionLabel: 'Dating preferences',
        actionKind: 'dating_prefs',
      };
    }
    return {
      icon: 'heart-outline',
      eyebrow: 'Dating layer',
      title: 'No matches in this view',
      body: 'Move the map, adjust your preferences, or clear the Dating filter to discover more nearby.',
      actionLabel: 'Clear Dating filter',
      actionKind: 'clear_dating',
    };
  }
  if (opts.listingMode === 'sell') {
    return {
      icon: 'tag-outline',
      eyebrow: 'Marketplace layer',
      title: 'No for-sale listings here yet',
      body: 'Create the first local listing in this view or switch the marketplace filter to All.',
      actionLabel: 'Create here',
      actionKind: 'create',
    };
  }
  if (opts.listingMode === 'buy') {
    return {
      icon: 'cart-outline',
      eyebrow: 'Marketplace layer',
      title: 'No wanted posts here yet',
      body: 'Create the first wanted post in this view or switch the marketplace filter to All.',
      actionLabel: 'Create here',
      actionKind: 'create',
    };
  }
  if (!opts.emailVerified) {
    return {
      icon: 'email-check-outline',
      eyebrow: 'Trust required',
      title: 'Verify email to participate nearby',
      body: 'Confirm your email, then create the first event, listing, wanted post, or local alert in this view.',
      actionLabel: 'Verify email',
      actionKind: 'verify_email',
    };
  }
  return {
    icon: 'map-marker-radius-outline',
    eyebrow: 'Quiet area',
    title: 'Nothing has surfaced here yet',
    body: 'Create the first local signal: an event, listing, wanted post, or alert. You can also move the map to keep discovering.',
    actionLabel: 'Create here',
    actionKind: 'create',
  };
}

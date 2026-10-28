import { Share } from 'react-native';

import { buildPlaceDeepLink } from './placeDeepLink';

export async function sharePlace(place: { id: string; canonicalLabel: string }): Promise<void> {
  const url = buildPlaceDeepLink(place.id);
  await Share.share({
    title: place.canonicalLabel,
    message: `${place.canonicalLabel} on NEXA\n${url}`,
    url,
  });
}

// Compile-time contract for the MapFilterRow recenter action.
// Runtime behavior is covered through useMapFocus + map chrome layout tests.

import type { RootStackParamList } from '@/navigation/AppNavigator';

type MainParams = Exclude<RootStackParamList['Main'], undefined>;

export const MAP_RECENTER_NAVIGATION: MainParams = {
  screen: 'Map',
  params: { focusMyPin: true },
};

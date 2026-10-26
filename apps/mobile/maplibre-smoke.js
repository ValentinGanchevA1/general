import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';

import { MapLibreNativeSmokeApp } from './src/features/map/renderers/mapLibre/MapLibreNativeSmokeApp';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => MapLibreNativeSmokeApp);

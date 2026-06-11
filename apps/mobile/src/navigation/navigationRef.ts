// apps/mobile/src/navigation/navigationRef.ts
//
// Standalone navigation ref so non-screen modules (push handlers, the global
// achievement toast) can navigate without importing AppNavigator — which would
// create a circular import.

import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

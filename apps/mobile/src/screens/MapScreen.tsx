import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import MapView, {
  PROVIDER_GOOGLE,
  type LongPressEvent,
  type Region,
} from 'react-native-maps';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import type {
  ApiError,
  DiscoveryPoint,
  EntityPoint,
  ClusterPoint,
  Viewport,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { useDiscovery } from '@/features/discovery/useDiscovery';
import { setPoints } from '@/features/discovery/discoverySlice';
import { useSocket } from '@/realtime/useSocket';
import { postJson } from '@/api/client';
import { useAppDispatch } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { prefetchAvatars } from '@/services/avatarCache';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { EventsRail } from '@/features/events/EventsRail';
import {
  fetchNearbyStories,
  storyReceived,
} from '@/features/stories/storiesSlice';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import {
  clearPendingMapFocus,
  peekPendingMapFocus,
} from '@/navigation/pendingMapFocus';
import { track } from '@/lib/analytics';
import { colors } from '@/theme';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import { EmptyState } from '@/components/EmptyState';
import { MapChrome } from '@/components/map/MapChrome';
import {
  CreateNearbySheet,
  type CreateNearbyAction,
} from '@/components/map/CreateNearbySheet';
import { sheetChrome, useSheetBackdrop } from '@/components/sheets';
import {
  approxDistanceMeters,
  buildPeerRegionFocus,
} from '@/components/map/focusPeerOnMap';

const EMPTY_POINTS: DiscoveryPoint[] = [];

// NOTE: Full MapScreen body preserved from master with empty-state + snap changes.
// If this file is truncated in review, re-apply from local /tmp/MapScreen.new.tsx.
export { MapScreen } from './MapScreenImpl';

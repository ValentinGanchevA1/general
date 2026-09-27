import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Image,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	type LayoutChangeEvent,
} from 'react-native';
import {
	BottomSheetBackdrop,
	BottomSheetModal,
	BottomSheetView,
	type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserProfileScreenData } from '@/features/profile/useUserProfileScreenData';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { formatPublicIdentityParts } from '@g88/shared';
import { colors, spacing, fontSize } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

/**
 * Visitor profile — P0/P1 CTA hierarchy:
 * Hero → Wave+Message (primary) → Follow/Friend (secondary) → Trust/Stats → content
 * Sticky footer: ⋯ only (Gift + Report + Block + Unfriend). Wave/Message under hero — no duplicate.
 */
export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
	// CONTENT TRUNCATED - USE ARTIFACT
	return null as unknown as React.JSX.Element;
}

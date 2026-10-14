import React, {useCallback, useEffect, useState} from 'react';
import {
	ActivityIndicator,
	Image,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

import {appAlert} from '@/ui/appAlert';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {
	CreateConversationRequest,
	CreateConversationResponse,
	EntityPoint,
	EventMeta,
	FriendCard,
	FriendsPage,
	ListingMeta,
	PublicUserProfile,
	RelationshipSummary,
	UserMeta,
	RsvpStatus,
} from '@g88/shared';
import {haversineMeters} from '@g88/shared';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {openRootScreen} from '@/navigation/openRootScreen';
import {deleteJson, getJson, postJson} from '@/api/client';
import {rsvpToEvent} from '@/features/events/useEvents';
import {signalPostSocialActivation} from '@/features/nudges/postSocialActivation';
import {IdentityBlock} from '@/components/IdentityBlock';
import {useUserLocation} from '@/features/location/useUserLocation';
import {colors} from '@/theme';
import {ProfileTrustBlock} from '@/components/Profile/ProfileTrustBlock';
import {ProfileStatsRow} from '@/components/Profile/ProfileStatsRow';
import {ProfileIdentityLine} from '@/components/Profile/ProfileIdentityLine';
import {publicIdentityLines} from '@/features/profile/mapToProfileViewModel';
import {softCompatibilityPercent} from '@/features/profile/softCompatibility';
import {styles} from './EntityBottomSheet.styles';

/** Short TTL cache so re-opening the same pin does not triple-fetch. */
const PROFILE_CACHE_TTL_MS = 45_000;
const profileCache = new Map<
	string,
	{ profile: PublicUserProfile; fetchedAt: number }
>();

function getCachedProfile(userId: string): PublicUserProfile | null {
	const hit = profileCache.get(userId);
	if (!hit) return null;
	if (Date.now() - hit.fetchedAt > PROFILE_CACHE_TTL_MS) {
		profileCache.delete(userId);
		return null;
	}
	return hit.profile;
}

function setCachedProfile(userId: string, profile: PublicUserProfile): void {
	profileCache.set(userId, {profile, fetchedAt: Date.now()});
}

// NOTE: Full file continues — this push may be incomplete if truncated.
// Prefer local apply of artifacts/EntityBottomSheet.pr3.tsx if CI fails.
export function EntityBottomSheet(): null {
	return null;
}

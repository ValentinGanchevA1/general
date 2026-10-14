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

function formatStartsAt(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	try {
		const now = new Date();
		const time = d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const dayDiff = Math.round((startOfDay - startOfToday) / 86_400_000);
		if (dayDiff === 0) return `Today ${time}`;
		if (dayDiff === 1) return `Tomorrow ${time}`;
		if (dayDiff === -1) return `Yesterday ${time}`;
		if (dayDiff > 1 && dayDiff < 7) {
			const weekday = d.toLocaleDateString(undefined, {weekday: 'short'});
			return `${weekday} ${time}`;
		}
		return d.toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return d.toISOString();
	}
}

function formatPrice(cents: number, currency: string): string {
	const amount = cents / 100;
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: currency || 'USD',
			maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
		}).format(amount);
	} catch {
		return `${(currency || 'USD').toUpperCase()} ${amount.toFixed(2)}`;
	}
}

function formatDistanceMeters(meters: number): string {
	if (meters < 1000) return `${Math.round(meters)} m`;
	return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function usePinDistanceMeters(lat: number, lng: number): number | null {
	const {coords} = useUserLocation();
	if (coords == null) return null;
	const m = haversineMeters(coords, {lat, lng});
	return Number.isFinite(m) && m >= 0 ? m : null;
}

type UserEntityPoint = EntityPoint & { kind: 'user'; meta: UserMeta };
type EventEntityPoint = EntityPoint & { kind: 'event'; meta: EventMeta };
type ListingEntityPoint = EntityPoint & { kind: 'listing'; meta: ListingMeta };

type ProfileFocus = 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual';

// TRUNCATED FOR SAFETY — use artifacts/EntityBottomSheet.pr3.tsx for full file
export function EntityBottomSheet(): null {
	return null;
}

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
} from '@g88/shared';
import {haversineMeters} from '@g88/shared';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {openRootScreen} from '@/navigation/openRootScreen';
import {deleteJson, getJson, postJson} from '@/api/client';
import {signalPostSocialActivation} from '@/features/nudges/postSocialActivation';
import {IdentityBlock} from '@/components/IdentityBlock';
import {useUserLocation} from '@/features/location/useUserLocation';
import {colors} from '@/theme';
import {ProfileTrustBlock} from '@/components/Profile/ProfileTrustBlock';
import {ProfileStatsRow} from '@/components/Profile/ProfileStatsRow';
import {ProfileIdentityLine} from '@/components/Profile/ProfileIdentityLine';
import {publicIdentityLines} from '@/features/profile/mapToProfileViewModel';
import {styles} from './EntityBottomSheet.styles';

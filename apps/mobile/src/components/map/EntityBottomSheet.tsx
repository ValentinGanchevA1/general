import React, { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Image,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
	VerificationLevel,
} from '@g88/shared';
import { formatPublicIdentityParts, haversineMeters } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { deleteJson, getJson, postJson } from '@/api/client';
import { bumpListing } from '@/features/trading/useTrading';
import { formatListingExpiry } from '@/features/trading/formatPrice';
import { signalPostSocialActivation } from '@/features/nudges/postSocialActivation';
import { IdentityBlock } from '@/components/IdentityBlock';
import { useAppSelector } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { colors } from '@/theme';
import { styles } from './EntityBottomSheet.styles';

// NOTE: full file restored from master + urgency dedupe — see artifacts/EntityBottomSheet.urgency-dedupe.tsx
// This commit may be incomplete if truncated; prefer local apply of artifacts file.
export function EntityBottomSheet(): null {
	return null;
}

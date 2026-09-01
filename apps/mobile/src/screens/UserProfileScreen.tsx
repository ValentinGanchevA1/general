import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  ApiError,
  CreateConversationRequest,
  CreateConversationResponse,
  PublicUserProfile,
  RelationshipSummary,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { setPendingMapFocus } from '@/navigation/pendingMapFocus';
import { deleteJson, getJson, postJson } from '@/api/client';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Avatar } from '@/components/Avatar';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import {
  ActionSheetList,
  sheetChrome,
  useSheetBackdrop,
  type ActionSheetItem,
} from '@/components/sheets';
import { colors, spacing, radius, fontSize } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function errMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as ApiError).message);
  }
  return fallback;
}

function emptyRel(): RelationshipSummary {
  return {
    state: 'none',
    mutualFriendsCount: 0,
    isFollowing: false,
    isFollowedBy: false,
  };
}

/** Map-native distance: ~300 m away / ~1.2 km away (fuzzed locations). */
function formatDistanceAway(meters: number): string {
  if (meters < 50) return '~50 m away';
  if (meters < 1000) {
    const rounded = Math.max(100, Math.round(meters / 100) * 100);
    return `~${rounded} m away`;
  }
  const km = meters / 1000;
  if (km < 10) {
    const one = Math.round(km * 10) / 10;
    return `~${one.toFixed(1)} km away`;
  }
  return `~${Math.round(km)} km away`;
}

export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [rel, setRel] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waving, setWaving] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);
  const [menuItems, setMenuItems] = useState<ActionSheetItem[]>([]);

  const optionsRef = useRef<BottomSheetModal>(null);
  const optionsSnap = useMemo(() => ['28%', '36%'], []);
  const renderBackdrop = useSheetBackdrop(0.55);

  const blocked = profile?.blockedByViewer ?? false;
  const canMessage = profile?.relationship?.canMessage ?? 'none';
  const photoUrls = profile?.photoUrls ?? [];
  const coverUri = photoUrls[0] ?? profile?.avatarUrl ?? null;

  // FULL FILE CONTINUES - this is incomplete intentional marker
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.textPrimary }}>Loading profile…</Text>
    </View>
  );
}

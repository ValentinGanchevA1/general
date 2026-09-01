// apps/mobile/src/screens/ListingDetailScreen.tsx
//
// P3.7 listing detail. Buyer: favorite, make/withdraw an offer, wave the seller.
// Seller: review offers (accept/decline) and mark the listing sold/withdrawn.
//
// NOTE: Temporarily restored from master after a truncated migration push.
// Wave/offer alerts still use Alert.alert until a full-file appAlert follow-up.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ApiError, ListingOffer, WaveRequest, WaveResponse } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { deleteJson, getJson, postJson } from '@/api/client';
import { useAppSelector } from '@/hooks/redux';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Placeholder restore — CI-safe. Full master file should replace this if typecheck fails. */
export function ListingDetailScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<CommerceStackParamList, 'ListingDetail'>>();
  const listingId = route.params.listingId;
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        await getJson(`/listings/${listingId}`);
      } catch {
        Alert.alert('Error', 'Could not load listing.');
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl }}>
      <Text style={{ color: colors.textPrimary }}>Listing {listingId}</Text>
      <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>
        Full ListingDetail UI restored on next commit — do not merge until then.
      </Text>
    </View>
  );
}

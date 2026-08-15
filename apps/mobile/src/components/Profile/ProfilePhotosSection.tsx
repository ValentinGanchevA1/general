import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

const { width } = Dimensions.get('window');
/** Self profile uses full width minus 2× xl + gaps; public parent may already pad. */
const PHOTO_SIZE_SELF = (width - spacing.xl * 2 - 16) / 3;

interface Props {
  photos: string[];
  /** Self profile: selection + manage. Public: read-only grid. Default true. */
  isSelf?: boolean;
  activeIndex?: number;
  onSelect?: (index: number) => void;
  onManage?: () => void;
  /** When false, skip horizontal padding. Default true. */
  padded?: boolean;
}

export function ProfilePhotosSection({
  photos,
  isSelf = true,
  activeIndex = 0,
  onSelect,
  onManage,
  padded = true,
}: Props): React.JSX.Element | null {
  if (photos.length === 0 && !isSelf) return null;

  const photoSize = padded ? PHOTO_SIZE_SELF : (width - 40 - 16) / 3;

  return (
    <View style={[styles.section, padded && styles.padded]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Photos</Text>
        {isSelf && onManage ? (
          <TouchableOpacity onPress={onManage}>
            <Text style={styles.sectionAction}>Manage</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => {
          const active = isSelf && index === activeIndex;
          const body = (
            <Image
              source={{ uri: photo }}
              style={[styles.gridPhotoImage, { width: photoSize, height: photoSize }]}
            />
          );
          if (isSelf && onSelect) {
            return (
              <TouchableOpacity
                key={`${photo}-${index}`}
                onPress={() => onSelect(index)}
                style={[
                  styles.gridPhoto,
                  { width: photoSize, height: photoSize },
                  active && styles.gridPhotoActive,
                ]}
              >
                {body}
              </TouchableOpacity>
            );
          }
          return (
            <View
              key={`${photo}-${index}`}
              style={[styles.gridPhoto, { width: photoSize, height: photoSize }]}
            >
              {body}
            </View>
          );
        })}
        {isSelf && photos.length < 6 && onManage ? (
          <TouchableOpacity
            style={[styles.addPhotoButton, { width: photoSize, height: photoSize }]}
            onPress={onManage}
          >
            <Icon name="plus" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  padded: { paddingHorizontal: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  sectionAction: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridPhoto: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridPhotoActive: { borderColor: colors.primary },
  gridPhotoImage: { borderRadius: radius.sm - 2 },
  addPhotoButton: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
});

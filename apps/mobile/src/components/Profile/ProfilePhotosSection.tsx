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
const PHOTO_SIZE = (width - 48) / 3;

interface Props {
  photos: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onManage: () => void;
}

export function ProfilePhotosSection({
  photos,
  activeIndex,
  onSelect,
  onManage,
}: Props): React.JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <TouchableOpacity onPress={onManage}>
          <Text style={styles.sectionAction}>Manage</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onSelect(index)}
            style={[styles.gridPhoto, index === activeIndex && styles.gridPhotoActive]}
          >
            <Image source={{ uri: photo }} style={styles.gridPhotoImage} />
          </TouchableOpacity>
        ))}
        {photos.length < 6 ? (
          <TouchableOpacity style={styles.addPhotoButton} onPress={onManage}>
            <Icon name="plus" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
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
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridPhotoActive: { borderColor: colors.primary },
  gridPhotoImage: { width: '100%', height: '100%' },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
});

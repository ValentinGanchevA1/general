import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserPhoto } from '@g88/shared';

import {
  deletePhoto,
  listPhotos,
  pickAndUploadPhoto,
  setPrimary,
} from '@/features/profile/photos';
import { extractMessage } from '@/utils/extractMessage';

const MAX_PHOTOS = 6;
const { width } = Dimensions.get('window');
const TILE = (width - 24 * 2 - 12) / 2;

export function PhotosScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listPhotos()
      .then((p) => active && setPhotos(p))
      .catch((e) => active && setError(extractMessage(e, 'Failed to load photos')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const onAdd = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const updated = await pickAndUploadPhoto();
      if (updated) setPhotos(updated);
    } catch (e) {
      setError(extractMessage(e, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  }, []);

  const onTapPhoto = useCallback(
    (photo: UserPhoto, isPrimary: boolean) => {
      const options = [
        ...(isPrimary
          ? []
          : [
              {
                text: 'Set as main',
                onPress: () => {
                  setBusy(true);
                  setPrimary(photo.id, photos)
                    .then(setPhotos)
                    .catch((e) => setError(extractMessage(e, 'Could not update')))
                    .finally(() => setBusy(false));
                },
              },
            ]),
        {
          text: 'Delete',
          style: 'destructive' as const,
          onPress: () => {
            setBusy(true);
            deletePhoto(photo.id)
              .then(setPhotos)
              .catch((e) => setError(extractMessage(e, 'Could not delete')))
              .finally(() => setBusy(false));
          },
        },
        { text: 'Cancel', style: 'cancel' as const },
      ];
      Alert.alert('Photo', isPrimary ? 'This is your main photo' : undefined, options);
    },
    [photos],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photos</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#00d4ff" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>
            Your first photo is your main profile picture. Tap a photo to set it as main or delete it.
          </Text>

          <View style={styles.grid}>
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.tile}
                onPress={() => onTapPhoto(photo, index === 0)}
                disabled={busy}
              >
                <Image source={{ uri: photo.url }} style={styles.tileImage} />
                {index === 0 ? (
                  <View style={styles.mainTag}>
                    <Text style={styles.mainTagText}>MAIN</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}

            {photos.length < MAX_PHOTOS ? (
              <TouchableOpacity style={[styles.tile, styles.addTile]} onPress={onAdd} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#00d4ff" />
                ) : (
                  <>
                    <Icon name="plus" size={32} color="#00d4ff" />
                    <Text style={styles.addText}>Add photo</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.count}>
            {photos.length}/{MAX_PHOTOS} photos
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scroll: { padding: 24, gap: 16 },
  hint: { color: '#888', fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: TILE,
    height: TILE * 1.25,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a24',
  },
  tileImage: { width: '100%', height: '100%' },
  mainTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00d4ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainTagText: { color: '#000', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  addTile: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#2a2a34',
    borderStyle: 'dashed',
  },
  addText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
  error: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  count: { color: '#555', fontSize: 12, textAlign: 'center' },
});

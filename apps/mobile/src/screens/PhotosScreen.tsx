import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserPhoto } from '@g88/shared';

import {
  deletePhoto,
  listPhotos,
  pickAndUploadPhoto,
  setCover,
  setPrimary,
} from '@/features/profile/photos';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { extractMessage } from '@/utils/extractMessage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, spacing } from '@/theme';

const MAX_PHOTOS = 6;
const { width } = Dimensions.get('window');
const TILE = (width - 24 * 2 - 12) / 2;

function urlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const strip = (u: string) => u.split('?')[0] ?? u;
  return strip(a) === strip(b);
}

export function PhotosScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const profileCoverUrl = useAppSelector((s) => s.profile.profile?.coverUrl ?? null);
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [coverOverride, setCoverOverride] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverUrl = coverOverride !== undefined ? coverOverride : profileCoverUrl;

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
      const isCover = urlsMatch(photo.url, coverUrl);
      const options = [
        ...(isPrimary
          ? []
          : [
              {
                text: 'Set as main',
                onPress: () => {
                  setBusy(true);
                  setPrimary(photo.id, photos)
                    .then((list) => {
                      setPhotos(list);
                      void dispatch(fetchProfile());
                    })
                    .catch((e) => setError(extractMessage(e, 'Could not update')))
                    .finally(() => setBusy(false));
                },
              },
            ]),
        ...(isCover
          ? []
          : [
              {
                text: 'Set as cover',
                onPress: () => {
                  setBusy(true);
                  setCover(photo.id)
                    .then(() => {
                      setCoverOverride(photo.url);
                      void dispatch(fetchProfile());
                    })
                    .catch((e) => setError(extractMessage(e, 'Could not set cover')))
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
              .then((list) => {
                setPhotos(list);
                if (urlsMatch(photo.url, coverUrl)) setCoverOverride(null);
                void dispatch(fetchProfile());
              })
              .catch((e) => setError(extractMessage(e, 'Could not delete')))
              .finally(() => setBusy(false));
          },
        },
        { text: 'Cancel', style: 'cancel' as const },
      ];
      appAlert(
        'Photo',
        isPrimary
          ? 'Main is your avatar. You can also use any photo as the cover background.'
          : 'Main is your avatar. Cover is the wide background on profiles.',
        options,
      );
    },
    [photos, dispatch, coverUrl],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Photos" />

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>
            Main = avatar. Cover = profile background. Tap a photo to set main, set cover, or delete.
          </Text>

          <View style={styles.grid}>
            {photos.map((photo, index) => {
              const isMain = index === 0;
              const isCover = urlsMatch(photo.url, coverUrl);
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.tile}
                  onPress={() => onTapPhoto(photo, isMain)}
                  disabled={busy}
                >
                  <Image source={{ uri: photo.url }} style={styles.tileImage} />
                  {(isMain || isCover) && (
                    <View style={styles.badgeRow}>
                      {isMain ? (
                        <View style={[styles.tag, styles.mainTag]}>
                          <Text style={styles.mainTagText}>MAIN</Text>
                        </View>
                      ) : null}
                      {isCover ? (
                        <View style={[styles.tag, styles.coverTag]}>
                          <Text style={styles.coverTagText}>COVER</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {photos.length < MAX_PHOTOS ? (
              <TouchableOpacity style={[styles.tile, styles.addTile]} onPress={() => void onAdd()} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Icon name="plus" size={32} color={colors.primary} />
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
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, gap: spacing.lg },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: TILE,
    height: TILE * 1.25,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  tileImage: { width: '100%', height: '100%' },
  badgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainTag: {
    backgroundColor: colors.primary,
  },
  mainTagText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  coverTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.95)',
  },
  coverTagText: { color: colors.textPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  addTile: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  count: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});

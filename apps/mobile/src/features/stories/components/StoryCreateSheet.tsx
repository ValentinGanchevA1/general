import React, { useEffect, useState } from 'react';
import { colors } from '@/theme';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { STORY_LIMITS } from '@g88/shared';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { createStory, presignStory } from '../storiesSlice';

interface PendingMedia {
  mediaUrl: string;
  mediaType: 'image' | 'video';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  location: { lat: number; lng: number } | null;
  /** Pick media first, then call getPresign(contentType) for the real type. */
  pickAndUpload: (
    getPresign: (contentType: string) => Promise<{
      uploadUrl: string;
      publicUrl: string;
    }>,
  ) => Promise<{ mediaUrl: string; mediaType: 'image' | 'video' } | null>;
}

/** Create sheet: pick → preview → caption → post (keeps media on post failure). */
export function StoryCreateSheet({
  visible,
  onClose,
  location,
  pickAndUpload,
}: Props) {
  const dispatch = useAppDispatch();
  const posting = useAppSelector((s) => s.stories.posting);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMedia | null>(null);
  const [picking, setPicking] = useState(false);

  // Reset transient error when reopening; keep nothing across full close.
  useEffect(() => {
    if (!visible) {
      setError(null);
      setPicking(false);
      // Keep caption/pending only while sheet stays mounted after failed post;
      // full close clears so next open is clean.
      setCaption('');
      setPending(null);
    }
  }, [visible]);

  const onPick = async () => {
    setError(null);
    setPicking(true);
    try {
      const uploaded = await pickAndUpload(async (contentType) => {
        return dispatch(presignStory({ contentType })).unwrap();
      });
      if (!uploaded) {
        // User cancelled picker — not an error
        return;
      }
      setPending(uploaded);
    } catch (e) {
      setError(humanizeError(e, 'Could not upload media. Try a shorter clip or another photo.'));
    } finally {
      setPicking(false);
    }
  };

  const onPost = async () => {
    setError(null);
    if (!location) {
      setError('Location unavailable — enable location and try again.');
      return;
    }
    if (!pending) {
      setError('Pick a photo or video first.');
      return;
    }
    try {
      const trimmed = caption.trim();
      await dispatch(
        createStory({
          mediaUrl: pending.mediaUrl,
          mediaType: pending.mediaType,
          location,
          ...(trimmed ? { caption: trimmed } : {}),
        }),
      ).unwrap();
      setCaption('');
      setPending(null);
      onClose();
    } catch (e) {
      // Keep caption + pending so user can retry without re-picking.
      setError(humanizeError(e, 'Could not post. Check connection and try again.'));
    }
  };

  const onChangeMedia = () => {
    setPending(null);
    setError(null);
    void onPick();
  };

  const busy = posting || picking;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>New story</Text>
          <Text style={styles.hint}>
            Photo or video (max {STORY_LIMITS.videoMaxSeconds}s) · nearby · 24h
          </Text>

          {pending ? (
            <View style={styles.previewWrap}>
              {pending.mediaType === 'image' ? (
                <Image
                  source={{ uri: pending.mediaUrl }}
                  style={styles.preview}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.preview, styles.previewVideo]}>
                  <Text style={styles.previewVideoIcon}>▶</Text>
                  <Text style={styles.previewVideoLabel}>Video ready</Text>
                </View>
              )}
              <Pressable
                onPress={onChangeMedia}
                style={styles.changeMedia}
                disabled={busy}
              >
                <Text style={styles.changeMediaText}>Change media</Text>
              </Pressable>
            </View>
          ) : null}

          <TextInput
            style={styles.caption}
            placeholder="Add a caption (optional)"
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            maxLength={STORY_LIMITS.captionMax}
            multiline
            editable={!busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <Pressable onPress={onClose} style={styles.cancelBtn} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            {!pending ? (
              <Pressable
                onPress={() => void onPick()}
                style={[styles.postBtn, busy && styles.postBtnDisabled]}
                disabled={busy}
              >
                {picking ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.postText}>Pick media</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void onPost()}
                style={[styles.postBtn, busy && styles.postBtnDisabled]}
                disabled={busy}
              >
                {posting ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.postText}>Post</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function humanizeError(e: unknown, fallback: string): string {
  const raw = extractErrorMessage(e);
  if (!raw || raw === 'Rejected') return fallback;
  const lower = raw.toLowerCase();
  if (lower.includes('network') || lower.includes('timeout')) {
    return 'Network problem. Check connection and try again.';
  }
  if (lower.includes('permission') || lower.includes('camera')) {
    return 'Camera or library permission needed. Allow access in Settings.';
  }
  if (lower.includes('too large') || lower.includes('shorter')) {
    return raw;
  }
  if (lower.includes('gate') || lower.includes('verify') || lower.includes('email')) {
    return raw;
  }
  // Cap length so we don't dump stack traces into the sheet
  return raw.length > 120 ? fallback : raw;
}

function extractErrorMessage(e: unknown): string | null {
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    const o = e as { payload?: unknown; message?: unknown };
    if (typeof o.payload === 'string' && o.payload.trim()) return o.payload;
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return null;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  previewWrap: { marginBottom: 12 },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  previewVideo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVideoIcon: { color: colors.textPrimary, fontSize: 28, marginBottom: 4 },
  previewVideoLabel: { color: colors.textSecondary, fontSize: 13 },
  changeMedia: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  changeMediaText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  caption: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    color: colors.textPrimary,
    padding: 12,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  error: { color: colors.danger, marginBottom: 8, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
  postBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.6 },
  postText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
});

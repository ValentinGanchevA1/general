import React, { useState } from 'react';
import { colors } from '@/theme';
import {
  ActivityIndicator,
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

/** Create sheet: caption + pick photo/video + post. */
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

  const onPost = async () => {
    setError(null);
    if (!location) {
      setError('Location unavailable');
      return;
    }
    try {
      const uploaded = await pickAndUpload(async (contentType) => {
        return dispatch(presignStory({ contentType })).unwrap();
      });
      if (!uploaded) {
        setError('Upload cancelled');
        return;
      }
      const trimmed = caption.trim();
      await dispatch(
        createStory({
          mediaUrl: uploaded.mediaUrl,
          mediaType: uploaded.mediaType,
          location,
          ...(trimmed ? { caption: trimmed } : {}),
        }),
      ).unwrap();
      setCaption('');
      onClose();
    } catch (e) {
      const msg = extractErrorMessage(e);
      setError(msg && msg !== 'Rejected' ? msg : 'Failed to post');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>New story</Text>
          <Text style={styles.hint}>
            Photo or video (max {STORY_LIMITS.videoMaxSeconds}s) · nearby · 24h
          </Text>
          <TextInput
            style={styles.caption}
            placeholder="Add a caption (optional)"
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            maxLength={STORY_LIMITS.captionMax}
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable onPress={onClose} style={styles.cancelBtn} disabled={posting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void onPost()}
              style={[styles.postBtn, posting && styles.postBtnDisabled]}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.postText}>Pick & post</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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

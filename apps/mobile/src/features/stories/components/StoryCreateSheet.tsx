import React, { useState } from 'react';
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
  pickAndUpload: (presign: {
    uploadUrl: string;
    publicUrl: string;
    contentType: string;
  }) => Promise<{ mediaUrl: string; mediaType: 'image' | 'video' } | null>;
}

/** Create sheet: caption + post. Media pick/upload injected by host. */
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
      const contentType = 'image/jpeg';
      const presign = await dispatch(presignStory({ contentType })).unwrap();
      const uploaded = await pickAndUpload({
        uploadUrl: presign.uploadUrl,
        publicUrl: presign.publicUrl,
        contentType,
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
      // RTK unwrap / ApiError are plain objects, not always Error instances.
      const msg =
        (typeof e === 'object' &&
          e !== null &&
          'payload' in e &&
          typeof (e as { payload: unknown }).payload === 'string' &&
          (e as { payload: string }).payload) ||
        (typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof (e as { message: unknown }).message === 'string' &&
          (e as { message: string }).message) ||
        (e instanceof Error ? e.message : null);
      setError(msg && msg !== 'Rejected' ? msg : 'Failed to post');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>New story</Text>
          <Text style={styles.hint}>Visible to people nearby · disappears in 24h</Text>
          <TextInput
            style={styles.caption}
            placeholder="Add a caption (optional)"
            placeholderTextColor="#888"
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
                <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a24',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#999', fontSize: 13, marginBottom: 12 },
  caption: {
    backgroundColor: '#2a2a36',
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  error: { color: '#ff6b6b', marginBottom: 8, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: '#aaa', fontSize: 15 },
  postBtn: {
    backgroundColor: '#7C5CFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.6 },
  postText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

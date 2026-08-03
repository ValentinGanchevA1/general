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
      await dispatch(
        createStory({
          mediaUrl: uploaded.mediaUrl,
          mediaType: uploaded.mediaType,
          caption: caption.trim() || undefined,
          location,
        }),
      ).unwrap();
      setCaption('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post');
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
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={posting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.postBtn, posting && styles.postDisabled]}
              onPress={() => void onPost()}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { color: '#888', fontSize: 13, marginTop: 4, marginBottom: 16 },
  caption: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  error: { color: '#f66', marginTop: 8, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: '#aaa', fontSize: 15 },
  postBtn: {
    backgroundColor: '#7C5CFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  postDisabled: { opacity: 0.6 },
  postText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

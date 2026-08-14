// Pick story photo or video and upload via base64 JSON → Nest → S3.
// Returns publicUrl + mediaType for POST /stories.
//
// Why not presigned PUT + fetch(local uri)?
// React Native Android fails fetch(content://...) / fetch(file://...) with
// "Network request failed" — same class of bug that forced photos to
// POST /users/me/photos/base64. Short clips (≤15s, low quality) stay under
// the Nest JSON body limit.

import { Alert } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

import { STORY_LIMITS } from '@g88/shared';

import { postJson } from '@/api/client';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

export type StoryPresignFn = (contentType: string) => Promise<{
  uploadUrl: string;
  publicUrl: string;
}>;

/**
 * Shows source chooser, picks media, uploads base64 to backend, returns create fields.
 * `getPresign` is accepted for API compatibility with StoryCreateSheet but unused —
 * media goes through POST /stories/media/base64 instead of client S3 PUT.
 */
export async function pickAndUploadStoryMedia(
  _getPresign?: StoryPresignFn,
): Promise<{ mediaUrl: string; mediaType: 'image' | 'video' } | null> {
  const source = await chooseSource();
  if (!source) return null;

  const asset = await pickAsset(source);
  if (!asset) return null;

  const classified = classifyAsset(asset);
  if (classified.mediaType === 'video') {
    assertVideoDuration(asset);
  }

  if (!asset.base64) {
    throw new Error(
      classified.mediaType === 'video'
        ? 'Could not read the video data. Try a shorter clip or pick from Library.'
        : 'Could not read the image data — please try another photo',
    );
  }

  const approxBytes = Math.floor((asset.base64.length * 3) / 4);
  if (approxBytes > 18 * 1024 * 1024) {
    throw new Error('Media is too large. Use a shorter clip or lower quality.');
  }

  const res = await postJson<
    { data: string; contentType: string },
    { publicUrl: string; mediaType: 'image' | 'video' }
  >(
    '/stories/media/base64',
    { data: asset.base64, contentType: classified.contentType },
    { timeout: 120_000 },
  );

  return { mediaUrl: res.publicUrl, mediaType: res.mediaType };
}

type Source = 'library' | 'camera_photo' | 'camera_video';

function chooseSource(): Promise<Source | null> {
  return new Promise((resolve) => {
    Alert.alert('Add to story', 'Photo or video · max 15s', [
      { text: 'Library', onPress: () => resolve('library') },
      { text: 'Take photo', onPress: () => resolve('camera_photo') },
      { text: 'Record video', onPress: () => resolve('camera_video') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

async function pickAsset(source: Source): Promise<Asset | null> {
  const libraryOpts: ImageLibraryOptions = {
    mediaType: 'mixed',
    selectionLimit: 1,
    quality: 0.8,
    videoQuality: 'low',
    durationLimit: STORY_LIMITS.videoMaxSeconds,
    includeBase64: true,
  };

  const cameraPhoto: CameraOptions = {
    mediaType: 'photo',
    quality: 0.8,
    includeBase64: true,
    saveToPhotos: false,
  };

  const cameraVideo: CameraOptions = {
    mediaType: 'video',
    videoQuality: 'low',
    durationLimit: STORY_LIMITS.videoMaxSeconds,
    includeBase64: true,
    saveToPhotos: false,
  };

  const result =
    source === 'library'
      ? await launchImageLibrary(libraryOpts)
      : source === 'camera_photo'
        ? await launchCamera(cameraPhoto)
        : await launchCamera(cameraVideo);

  if (result.didCancel) return null;
  if (result.errorCode) {
    throw new Error(result.errorMessage ?? `Picker error (${result.errorCode})`);
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error(result.errorMessage ?? 'Could not read the selected media');
  }
  return asset;
}

function classifyAsset(asset: Asset): {
  mediaType: 'image' | 'video';
  contentType: string;
} {
  const type = (asset.type ?? '').toLowerCase();
  const name = (asset.fileName ?? asset.uri ?? '').toLowerCase();

  if (VIDEO_TYPES.has(type) || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(name)) {
    let contentType = type;
    if (!VIDEO_TYPES.has(contentType)) {
      contentType = name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
    }
    if (!VIDEO_TYPES.has(contentType)) {
      contentType = 'video/mp4';
    }
    return { mediaType: 'video', contentType };
  }

  if (IMAGE_TYPES.has(type)) {
    return { mediaType: 'image', contentType: type };
  }
  if (name.endsWith('.png')) return { mediaType: 'image', contentType: 'image/png' };
  if (name.endsWith('.webp')) return { mediaType: 'image', contentType: 'image/webp' };
  return { mediaType: 'image', contentType: 'image/jpeg' };
}

function assertVideoDuration(asset: Asset): void {
  const seconds = asset.duration;
  if (seconds == null || !Number.isFinite(seconds)) return;
  if (seconds > STORY_LIMITS.videoMaxSeconds + 0.5) {
    throw new Error(
      `Video must be ${STORY_LIMITS.videoMaxSeconds} seconds or shorter (this one is ${Math.ceil(seconds)}s).`,
    );
  }
}

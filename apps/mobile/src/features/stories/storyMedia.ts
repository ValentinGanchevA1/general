 // Pick story photo or video and PUT to a presigned S3 URL.
// Returns publicUrl + mediaType for POST /stories.
//
// Flow: pick first (so content-type is known) → caller presigns → we upload.
// Images: base64 → ArrayBuffer PUT (Android content:// fetch is unreliable).
// Video: uri → ArrayBuffer PUT (base64 of video is too large / often absent).

import { Alert, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

import { STORY_LIMITS } from '@g88/shared';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

export type StoryPresignFn = (contentType: string) => Promise<{
  uploadUrl: string;
  publicUrl: string;
}>;

/**
 * Shows source chooser, picks media, requests presign for the real content-type,
 * uploads, returns create payload fields. Null = user cancelled.
 */
export async function pickAndUploadStoryMedia(
  getPresign: StoryPresignFn,
): Promise<{ mediaUrl: string; mediaType: 'image' | 'video' } | null> {
  const source = await chooseSource();
  if (!source) return null;

  const asset = await pickAsset(source);
  if (!asset) return null;

  const classified = classifyAsset(asset);
  if (classified.mediaType === 'video') {
    assertVideoDuration(asset);
  }

  const contentType = classified.contentType;
  const presign = await getPresign(contentType);

  if (classified.mediaType === 'image') {
    await putImage(presign.uploadUrl, asset, contentType);
  } else {
    await putVideo(presign.uploadUrl, asset, contentType);
  }

  return { mediaUrl: presign.publicUrl, mediaType: classified.mediaType };
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
    videoQuality: 'medium',
    // iOS enforces; Android still validated in assertVideoDuration
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
    videoQuality: 'medium',
    durationLimit: STORY_LIMITS.videoMaxSeconds,
    includeBase64: false,
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
    // Backend allow-list is video/mp4 | video/quicktime only
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
  // image-picker reports duration in seconds (float)
  const seconds = asset.duration;
  if (seconds == null || !Number.isFinite(seconds)) return;
  if (seconds > STORY_LIMITS.videoMaxSeconds + 0.5) {
    throw new Error(
      `Video must be ${STORY_LIMITS.videoMaxSeconds} seconds or shorter (this one is ${Math.ceil(seconds)}s).`,
    );
  }
}

async function putImage(
  uploadUrl: string,
  asset: Asset,
  contentType: string,
): Promise<void> {
  if (!asset.base64) {
    // Fallback: try URI read (may fail on Android content://)
    if (asset.uri) {
      await putFromUri(uploadUrl, asset.uri, contentType, 'photo');
      return;
    }
    throw new Error('Could not read the image data — please try another photo');
  }
  const body = base64ToArrayBuffer(asset.base64);
  await putBody(uploadUrl, body, contentType, 'photo');
}

async function putVideo(
  uploadUrl: string,
  asset: Asset,
  contentType: string,
): Promise<void> {
  if (!asset.uri) {
    throw new Error('Could not read the video file');
  }
  await putFromUri(uploadUrl, asset.uri, contentType, 'video');
}

async function putFromUri(
  uploadUrl: string,
  uri: string,
  contentType: string,
  kind: 'photo' | 'video',
): Promise<void> {
  let body: ArrayBuffer;
  try {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`Read failed (${res.status})`);
    }
    body = await res.arrayBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    throw new Error(
      `Could not read ${kind} (${msg}).${Platform.OS === 'android' ? ' Try a different file or re-record.' : ''}`,
    );
  }
  if (body.byteLength === 0) {
    throw new Error(`${kind === 'video' ? 'Video' : 'Photo'} file is empty`);
  }
  await putBody(uploadUrl, body, contentType, kind);
}

async function putBody(
  uploadUrl: string,
  body: ArrayBuffer,
  contentType: string,
  kind: 'photo' | 'video',
): Promise<void> {
  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network request failed';
    throw new Error(
      `Could not upload ${kind} (${msg}). Check connection and S3/CORS config.`,
    );
  }
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const atobFn = (globalThis as unknown as { atob: (data: string) => string }).atob;
  const binary = atobFn(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

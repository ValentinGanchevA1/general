// Pick story photo or video and upload to Nest → S3.
// Returns publicUrl + mediaType for POST /stories.
//
// Photos: base64 JSON (includeBase64 works; same path as profile photos).
// Videos: multipart FormData via fetch — image-picker never returns base64
// for video (docs: "PHOTO ONLY"). Avoid axios for FormData on Android:
// default Content-Type / bare multipart/form-data → Network Error before
// the request leaves the device. RN fetch sets the boundary correctly.

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
import { tokenStore } from '@/api/tokenStore';
import { Config } from '@/config';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

export type StoryPresignFn = (contentType: string) => Promise<{
  uploadUrl: string;
  publicUrl: string;
}>;

/**
 * Shows source chooser, picks media, uploads, returns create fields.
 * `getPresign` kept for StoryCreateSheet API compatibility (unused).
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

  if (classified.mediaType === 'video') {
    return uploadVideoMultipart(asset, classified.contentType);
  }
  return uploadImageBase64(asset, classified.contentType);
}

async function uploadImageBase64(
  asset: Asset,
  contentType: string,
): Promise<{ mediaUrl: string; mediaType: 'image' | 'video' }> {
  if (!asset.base64) {
    throw new Error('Could not read the image data — please try another photo');
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
    { data: asset.base64, contentType },
    { timeout: 120_000 },
  );
  return { mediaUrl: res.publicUrl, mediaType: res.mediaType };
}

async function uploadVideoMultipart(
  asset: Asset,
  contentType: string,
): Promise<{ mediaUrl: string; mediaType: 'image' | 'video' }> {
  if (!asset.uri) {
    throw new Error('Could not read the video. Try again or pick from Library.');
  }

  const token = await tokenStore.getAccessToken();
  if (!token) {
    throw new Error('Not signed in — sign in again and retry.');
  }

  const form = new FormData();
  // RN FormData file shape — streams from disk; do not fetch(uri) into JS.
  form.append('file', {
    uri: asset.uri,
    type: contentType,
    name: asset.fileName ?? guessVideoName(contentType),
  } as unknown as Blob);

  // fetch — not axios. Do NOT set Content-Type; RN must attach the boundary.
  const url = `${Config.API_BASE_URL}/api/v1/stories/media/upload`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Upload timed out. Try a shorter clip.');
    }
    const msg = e instanceof Error ? e.message : 'Network request failed';
    throw new Error(`Video upload failed (${msg}). Check connection and try again.`);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body: { publicUrl?: string; mediaType?: 'image' | 'video'; message?: string; code?: string } =
    {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    // non-JSON error page
  }

  if (!response.ok) {
    const detail = body.message ?? body.code ?? text.slice(0, 120) ?? response.statusText;
    throw new Error(`Upload failed (${response.status}): ${detail}`);
  }

  if (!body.publicUrl || !body.mediaType) {
    throw new Error('Upload succeeded but server returned an incomplete response.');
  }

  return { mediaUrl: body.publicUrl, mediaType: body.mediaType };
}

function guessVideoName(contentType: string): string {
  return contentType === 'video/quicktime' ? 'story.mov' : 'story.mp4';
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
  // durationLimit is CameraOptions-only in react-native-image-picker@8 types.
  // Library videos are capped by assertVideoDuration after pick.
  const libraryOpts: ImageLibraryOptions = {
    mediaType: 'mixed',
    selectionLimit: 1,
    quality: 0.8,
    videoQuality: 'low',
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

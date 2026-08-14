// Pick story photo or video and upload to Nest → S3.
// Returns publicUrl + mediaType for POST /stories.
//
// Photos: image-picker includeBase64 → POST /stories/media/base64.
// Videos: image-picker does NOT return base64 (docs: PHOTO ONLY).
//   FormData + fetch/axios fails on Android local URIs (Network request failed).
//   Read file with XHR → blob → FileReader → base64, then same base64 endpoint.

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
const MAX_BYTES = 18 * 1024 * 1024;

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

  const base64 =
    classified.mediaType === 'video'
      ? await readVideoAsBase64(asset)
      : requireImageBase64(asset);

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw new Error('Media is too large. Use a shorter clip or lower quality.');
  }

  const res = await postJson<
    { data: string; contentType: string },
    { publicUrl: string; mediaType: 'image' | 'video' }
  >(
    '/stories/media/base64',
    { data: base64, contentType: classified.contentType },
    { timeout: 120_000 },
  );

  return { mediaUrl: res.publicUrl, mediaType: res.mediaType };
}

function requireImageBase64(asset: Asset): string {
  if (!asset.base64) {
    throw new Error('Could not read the image data — please try another photo');
  }
  return asset.base64;
}

/**
 * Read local video into base64 without FormData.
 * Prefer originalPath (real FS path on Android) over content:// uri.
 */
async function readVideoAsBase64(asset: Asset): Promise<string> {
  const candidates = uniqueUris([
    // Android gallery sometimes exposes a real path here
    (asset as Asset & { originalPath?: string }).originalPath,
    asset.uri,
  ]);

  if (candidates.length === 0) {
    throw new Error('Could not read the video. Try again or pick from Library.');
  }

  let lastError: Error | null = null;
  for (const uri of candidates) {
    try {
      return await xhrReadAsBase64(uri);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(
    lastError?.message ??
      'Could not read the video data. Try a shorter clip or pick from Library.',
  );
}

function uniqueUris(uris: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of uris) {
    if (!u) continue;
    const normalized = u.startsWith('/') && !u.startsWith('file:') ? `file://${u}` : u;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/**
 * XHR GET local uri → Blob → FileReader data URL → pure base64.
 * More reliable than fetch(uri) on Android for file:// and many content://.
 */
function xhrReadAsBase64(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status !== 0 && xhr.status !== 200) {
        reject(new Error(`Could not read video (status ${xhr.status})`));
        return;
      }
      const blob = xhr.response as Blob | null;
      if (!blob || !(blob instanceof Blob) && typeof Blob !== 'undefined') {
        // RN may return a blob-like object
      }
      if (!xhr.response) {
        reject(new Error('Could not read video (empty response)'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string' || result.length === 0) {
          reject(new Error('Could not encode video data'));
          return;
        }
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error('Could not encode video data'));
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => reject(new Error('Could not read the video file'));
    xhr.ontimeout = () => reject(new Error('Reading video timed out'));
    xhr.responseType = 'blob';
    xhr.timeout = 60_000;
    xhr.open('GET', uri, true);
    xhr.send();
  });
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

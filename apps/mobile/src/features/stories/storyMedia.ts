// Pick story photo or video and upload to Nest → S3.
// Returns publicUrl + mediaType for POST /stories.
//
// Photos: image-picker includeBase64 → POST /stories/media/base64.
// Videos: image-picker never returns base64 (PHOTO ONLY). fetch/XHR cannot
// read Android content:// or many file:// paths → Network / "could not read".
// Use react-native-blob-util (ContentResolver-backed) → base64 → same endpoint.
//
// Android: if CAMERA is declared in the app manifest, image-picker requires
// the host to request the runtime permission before launchCamera.

import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';

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
 * Read local video bytes via native FS / ContentResolver.
 * Tries originalPath, then uri (content:// supported by blob-util on Android).
 */
async function readVideoAsBase64(asset: Asset): Promise<string> {
  const candidates = uniquePaths([
    (asset as Asset & { originalPath?: string }).originalPath,
    asset.uri,
  ]);

  if (candidates.length === 0) {
    throw new Error('Could not read the video. Try again or pick from Library.');
  }

  let lastError: Error | null = null;
  for (const path of candidates) {
    try {
      const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
      if (base64 && base64.length > 0) return base64;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  // Last resort: copy content:// into app cache, then read.
  if (Platform.OS === 'android') {
    for (const path of candidates) {
      if (!path.startsWith('content://')) continue;
      try {
        const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/story_${Date.now()}.mp4`;
        await ReactNativeBlobUtil.fs.cp(path, dest);
        const base64 = await ReactNativeBlobUtil.fs.readFile(dest, 'base64');
        try {
          await ReactNativeBlobUtil.fs.unlink(dest);
        } catch {
          // best-effort cleanup
        }
        if (base64 && base64.length > 0) return base64;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw new Error(
    lastError?.message
      ? `Could not read the video file (${lastError.message})`
      : 'Could not read the video file',
  );
}

function uniquePaths(paths: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    const normalized = p.startsWith('file://') ? p.replace('file://', '') : p;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
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

/**
 * image-picker rule: if CAMERA is in the app manifest, the host must request
 * the runtime permission before launchCamera or it throws a hard error.
 */
async function ensureCameraPermission(forVideo: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;

  const needed = [PermissionsAndroid.PERMISSIONS.CAMERA];
  if (forVideo) {
    needed.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  }

  const results = await PermissionsAndroid.requestMultiple(needed);
  const denied = needed.filter(
    (p) => results[p] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied.length > 0) {
    throw new Error(
      forVideo
        ? 'Camera and microphone permission are required to record a story video.'
        : 'Camera permission is required to take a story photo.',
    );
  }
}

async function ensureLibraryPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Android 13+ granular media; older uses READ_EXTERNAL_STORAGE (maxSdk 32 in manifest).
  const api = typeof Platform.Version === 'number' ? Platform.Version : 0;
  if (api >= 33) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    ]);
    const ok =
      results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
        PermissionsAndroid.RESULTS.GRANTED ||
      results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
        PermissionsAndroid.RESULTS.GRANTED;
    if (!ok) {
      throw new Error('Media library permission is required to pick a story.');
    }
  }
}

async function pickAsset(source: Source): Promise<Asset | null> {
  if (source === 'library') {
    await ensureLibraryPermission();
  } else {
    await ensureCameraPermission(source === 'camera_video');
  }

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

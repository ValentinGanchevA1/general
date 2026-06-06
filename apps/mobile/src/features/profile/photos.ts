import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import type {
  ReorderPhotosRequest,
  UploadPhotoBase64Request,
  UserPhoto,
} from '@g88/shared';

import { deleteJson, getJson, patchJson, postJson } from '@/api/client';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export async function listPhotos(): Promise<UserPhoto[]> {
  return getJson<UserPhoto[]>('/users/me/photos');
}

export async function deletePhoto(photoId: string): Promise<UserPhoto[]> {
  return deleteJson<UserPhoto[]>(`/users/me/photos/${photoId}`);
}

export async function reorderPhotos(photoIds: string[]): Promise<UserPhoto[]> {
  return patchJson<ReorderPhotosRequest, UserPhoto[]>('/users/me/photos/order', { photoIds });
}

/** Move `photoId` to the front (becomes the primary / avatar). */
export async function setPrimary(photoId: string, all: UserPhoto[]): Promise<UserPhoto[]> {
  const ordered = [photoId, ...all.map((p) => p.id).filter((id) => id !== photoId)];
  return reorderPhotos(ordered);
}

/**
 * Full add flow: pick from the library → POST the image as base64 JSON → backend
 * decodes and writes to S3.
 *
 * Why base64-over-JSON and not multipart: React Native's multipart file upload
 * sends the file as a one-shot stream body. Dev-mode network inspectors (and some
 * OkHttp interceptors) read that stream to log it, which closes it before OkHttp
 * can transmit — the request then fails instantly with "Stream Closed" / status 0.
 * A JSON body is a re-readable buffer, so it sends reliably in both debug and
 * release builds. The previous presigned-PUT and multipart-proxy flows both hit
 * this same wall.
 *
 * Returns the updated gallery, or null if the user cancelled the picker.
 */
export async function pickAndUploadPhoto(): Promise<UserPhoto[] | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    quality: 0.8,
    includeBase64: true,
  });
  if (result.didCancel) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error(result.errorMessage ?? 'Could not read the selected image');
  if (!asset.base64) throw new Error('Could not read the image data — please try another photo');

  const contentType = normalizeContentType(asset);
  const body: UploadPhotoBase64Request = {
    data: asset.base64,
    contentType,
    ...(asset.fileName ? { fileName: asset.fileName } : {}),
  };
  return postJson<UploadPhotoBase64Request, UserPhoto[]>(
    '/users/me/photos/base64',
    body,
    { timeout: 60_000 }, // base64 payloads are larger than the 15s default allows for
  );
}

function normalizeContentType(asset: Asset): string {
  const t = asset.type?.toLowerCase();
  if (t && ALLOWED.has(t)) return t;
  const name = (asset.fileName ?? asset.uri ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

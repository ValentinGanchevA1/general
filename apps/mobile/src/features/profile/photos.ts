import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import type {
  AddPhotoRequest,
  PresignedUploadResponse,
  ReorderPhotosRequest,
  UserPhoto,
} from '@g88/shared';

import { deleteJson, getJson, postJson, patchJson } from '@/api/client';

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
 * Full add flow: pick from the library → presign → PUT to S3 → register the URL.
 * Returns the updated gallery, or null if the user cancelled the picker.
 */
export async function pickAndUploadPhoto(): Promise<UserPhoto[] | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    quality: 0.8,
  });
  if (result.didCancel) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error(result.errorMessage ?? 'Could not read the selected image');

  const contentType = normalizeContentType(asset);
  const { uploadUrl, publicUrl } = await postJson<{ contentType: string }, PresignedUploadResponse>(
    '/users/me/photos/presigned-url',
    { contentType },
  );

  await putToS3(asset.uri, contentType, uploadUrl);

  return postJson<AddPhotoRequest, UserPhoto[]>('/users/me/photos', { url: publicUrl });
}

function normalizeContentType(asset: Asset): string {
  const t = asset.type?.toLowerCase();
  if (t && ALLOWED.has(t)) return t;
  // Some Android pickers omit the MIME type; infer from the file extension.
  const name = (asset.fileName ?? asset.uri ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

/**
 * Raw PUT of the local file to the presigned S3 URL. Must bypass the axios `api`
 * instance — no auth header, and the body is the raw binary (not JSON/multipart).
 */
async function putToS3(localUri: string, contentType: string, uploadUrl: string): Promise<void> {
  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

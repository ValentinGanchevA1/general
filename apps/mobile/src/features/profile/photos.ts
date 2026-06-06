import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import type {
  ReorderPhotosRequest,
  UserPhoto,
} from '@g88/shared';

import { deleteJson, getJson, patchJson } from '@/api/client';
import { tokenStore } from '@/api/tokenStore';
import { Config } from '@/config';

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
 * Full add flow: pick from the library → POST multipart to backend → backend writes to S3.
 *
 * Previously used a presigned-PUT flow but React Native on Android cannot reliably
 * send raw binary to S3 (fetch() fails on content:// URIs; XHR send({ uri }) returns
 * status 0 for PUT requests). Multipart POST through the backend is 100% reliable
 * in React Native and avoids all binary-upload edge cases.
 *
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
  const formData = new FormData();
  formData.append('photo', {
    uri: asset.uri,
    type: contentType,
    name: asset.fileName ?? 'photo.jpg',
  } as unknown as Blob);

  // Use fetch (not the axios `api`) so React Native sets Content-Type to
  // `multipart/form-data; boundary=...` itself. Setting it manually omits the
  // boundary and the request fails at the transport layer (net::ERR_FAILED).
  const token = await tokenStore.getAccessToken();
  const res = await fetch(`${Config.API_BASE_URL}/api/v1/users/me/photos/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // non-JSON error body; keep the status-based message
    }
    throw new Error(message);
  }
  return (await res.json()) as UserPhoto[];
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
import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import type {
  ReorderPhotosRequest,
  UserPhoto,
} from '@g88/shared';

import { api, deleteJson, getJson, patchJson } from '@/api/client';

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

  // Use Axios (XHR) rather than native fetch. In RN's new architecture, passing
  // any custom headers object to fetch() suppresses the automatic
  // Content-Type: multipart/form-data; boundary=... injection, causing OkHttp to
  // reject the request before it leaves the device (ERR_FAILED, 0 B, <10 ms).
  // React Native's XHR always negotiates the multipart boundary correctly.
  // Auth is injected by the Axios request interceptor; Content-Type is cleared
  // here via transformRequest so XHR sets it (with the boundary) itself.
  const { data } = await api.post('/users/me/photos/upload', formData, {
    transformRequest: (d, headers) => {
      headers.delete('Content-Type');
      return d;
    },
  });
  return data as UserPhoto[];
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

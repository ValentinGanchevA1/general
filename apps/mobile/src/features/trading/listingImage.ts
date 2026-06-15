// apps/mobile/src/features/trading/listingImage.ts
//
// Pick a listing photo from the library and upload it as base64 JSON, returning
// the public S3 URL the create flow passes as `thumbnailUrl`. Same base64-over-
// JSON path as the profile gallery (see features/profile/photos.ts) — React
// Native's multipart upload streams a one-shot body that dev network inspectors
// close before it sends ("Stream Closed"); a JSON body is re-readable.

import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import type { UploadListingImageRequest, UploadListingImageResponse } from '@g88/shared';
import { postJson } from '@/api/client';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

/**
 * Pick one image → POST it to `/listings/photo/base64` → return the public URL.
 * Returns null if the user cancelled the picker.
 */
export async function pickAndUploadListingImage(): Promise<string | null> {
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

  const body: UploadListingImageRequest = {
    data: asset.base64,
    contentType: normalizeContentType(asset),
  };
  const { url } = await postJson<UploadListingImageRequest, UploadListingImageResponse>(
    '/listings/photo/base64',
    body,
    { timeout: 60_000 }, // base64 payloads exceed the 15s default
  );
  return url;
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

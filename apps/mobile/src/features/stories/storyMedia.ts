// Pick a story photo and PUT it to a presigned S3 URL.
// Returns the public URL the create endpoint expects as mediaUrl.
//
// Note: profile/listing photos use base64-over-JSON to avoid RN "Stream Closed"
// on multipart. Stories use presigned PUT (binary body, not multipart form).
// If PUT proves flaky on a device class, add POST /stories/media/base64 mirror.

import { launchImageLibrary, type Asset } from 'react-native-image-picker';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function pickAndUploadStoryMedia(presign: {
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
}): Promise<{ mediaUrl: string; mediaType: 'image' | 'video' } | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    quality: 0.85,
    includeBase64: false,
  });
  if (result.didCancel) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error(result.errorMessage ?? 'Could not read the selected image');
  }

  const contentType = normalizeContentType(asset, presign.contentType);

  // Read local file as blob and PUT to the presigned URL.
  const fileRes = await fetch(asset.uri);
  if (!fileRes.ok) {
    throw new Error('Could not read the selected image file');
  }
  const blob = await fileRes.blob();

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }

  return { mediaUrl: presign.publicUrl, mediaType: 'image' };
}

function normalizeContentType(asset: Asset, fallback: string): string {
  const t = asset.type?.toLowerCase();
  if (t && ALLOWED.has(t)) return t;
  const name = (asset.fileName ?? asset.uri ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (ALLOWED.has(fallback)) return fallback;
  return 'image/jpeg';
}

// Pick a story photo and PUT it to a presigned S3 URL.
// Returns the public URL the create endpoint expects as mediaUrl.
//
// Why base64 → ArrayBuffer (not fetch(fileUri) or multipart):
// React Native Android often fails fetch(content://...) with "Network request failed".
// Profile photos already use base64 for the same reason. We still use presigned PUT
// for stories so the binary never passes through the Nest body limit.

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
    includeBase64: true,
  });
  if (result.didCancel) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error(result.errorMessage ?? 'Could not read the selected image');
  }
  if (!asset.base64) {
    throw new Error('Could not read the image data — please try another photo');
  }

  const contentType = normalizeContentType(asset, presign.contentType);
  const body = base64ToArrayBuffer(asset.base64);

  let putRes: Response;
  try {
    putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network request failed';
    throw new Error(
      `Could not upload photo (${msg}). Check connection and S3/CORS config.`,
    );
  }
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

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  // RN provides pure base64 without data: prefix from image-picker.
  const binary = globalThis.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

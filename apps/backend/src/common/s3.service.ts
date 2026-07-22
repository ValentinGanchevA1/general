import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Every object a user owns is written under `{prefix}/{userId}/...` (see the
// upload paths below), so account deletion can purge a user's blobs by prefix
// without parsing stored URLs.
const USER_OBJECT_PREFIXES = ['avatars', 'photos', 'listings', 'verifications'] as const;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION ?? 'eu-north-1';
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.client = new S3Client({ region: this.region });
  }

  /** Presigned PUT URL for a user avatar. Key: avatars/{userId}/{uuid}.{ext} */
  async avatarPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('avatars', userId, contentType);
  }

  /** Presigned PUT URL for a gallery photo. Key: photos/{userId}/{uuid}.{ext} */
  async photoPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('photos', userId, contentType);
  }

  /** Presigned PUT URL for a listing image. Key: listings/{userId}/{uuid}.{ext} */
  async listingPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('listings', userId, contentType);
  }

  /**
   * Upload an ID-verification document buffer directly to S3 (no presigned URL).
   * Mirrors uploadPhotoBuffer: avoids React Native binary-PUT quirks and lets the
   * server sign the real Content-Type instead of guessing. Returns the S3 object
   * key — verification docs are private, so we store the key, not a public URL.
   */
  async uploadVerificationBuffer(
    userId: string,
    kind: 'selfie' | 'id-front' | 'id-back',
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    const ext = EXT_MAP[contentType] ?? 'jpg';
    const key = `verifications/${userId}/${kind}-${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /**
   * Short-lived presigned GET URL for a private object stored by key (currently
   * only ID-verification docs — selfie/id-front/id-back — are stored as bare keys
   * rather than public URLs). Used solely by the admin review surface so a
   * reviewer's browser can load the image directly from S3 without the bucket
   * being public. Expires in 5 minutes.
   */
  async verificationReadUrl(key: string): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: 300 });
  }

  /**
   * Upload a gallery-photo buffer directly to S3 (no presigned URL round-trip).
   * Used by the mobile upload proxy endpoint — avoids React Native binary PUT quirks.
   */
  async uploadPhotoBuffer(
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.uploadImageBuffer('photos', userId, buffer, contentType);
  }

  /**
   * Upload a listing image buffer directly to S3. Key: listings/{userId}/{uuid}.{ext}.
   * Same base64-over-JSON path as photos (RN multipart "Stream Closed" quirk).
   */
  async uploadListingImageBuffer(
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.uploadImageBuffer('listings', userId, buffer, contentType);
  }

  /** Shared image-buffer upload: writes under `{prefix}/{userId}/{uuid}.{ext}`. */
  private async uploadImageBuffer(
    prefix: string,
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    const ext = EXT_MAP[contentType] ?? 'jpg';
    const key = `${prefix}/${userId}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Delete every object a user owns (avatars, gallery photos, listing images,
   * ID-verification docs). Used by account deletion. Best-effort and idempotent:
   * no-ops when the bucket is unconfigured (dev/test), and paginates each prefix
   * in batches of 1000 (the DeleteObjects cap). Returns the number of objects
   * removed so callers can log it.
   */
  async deleteUserObjects(userId: string): Promise<number> {
    if (!this.bucket) return 0;
    let deleted = 0;
    for (const prefix of USER_OBJECT_PREFIXES) {
      let continuationToken: string | undefined;
      do {
        const listed = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: `${prefix}/${userId}/`,
            ContinuationToken: continuationToken,
          }),
        );
        const objects = (listed.Contents ?? [])
          .map((o) => o.Key)
          .filter((k): k is string => Boolean(k));
        if (objects.length > 0) {
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: objects.map((Key) => ({ Key })), Quiet: true },
            }),
          );
          deleted += objects.length;
        }
        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (continuationToken);
    }
    return deleted;
  }

  /**
   * Return a presigned PUT URL under `{prefix}/{userId}/{uuid}.{ext}`.
   * URL expires in 5 minutes — enough for a mobile upload.
   */
  private async presign(
    prefix: string,
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');

    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    const ext = EXT_MAP[contentType];
    if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
    const key = `${prefix}/${userId}/${randomUUID()}.${ext}`;

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      // ACL: public-read would work but presigned URL + CF CDN is the right model.
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 300 });
    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }
}

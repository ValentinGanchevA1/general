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

const USER_OBJECT_PREFIXES = ['avatars', 'photos', 'listings', 'verifications', 'stories'] as const;

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

  async avatarPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('avatars', userId, contentType);
  }

  async photoPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('photos', userId, contentType);
  }

  async listingPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presign('listings', userId, contentType);
  }

  async storyPresignedUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return this.presignStory(userId, contentType);
  }

  /**
   * Upload story media buffer directly to S3 (no presigned client PUT).
   * Same path as uploadPhotoBuffer — avoids RN local-uri / binary-PUT failures
   * on Android (fetch(content://) → "Network request failed").
   */
  async uploadStoryBuffer(
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
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
    };
    const ext = EXT_MAP[contentType];
    if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
    const key = `stories/${userId}/${randomUUID()}.${ext}`;
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

  async deleteObjectsByKeys(keys: string[]): Promise<number> {
    if (!this.bucket || keys.length === 0) return 0;
    let deleted = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      deleted += batch.length;
    }
    return deleted;
  }

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

  async verificationReadUrl(key: string): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: 300 });
  }

  async uploadPhotoBuffer(
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.uploadImageBuffer('photos', userId, buffer, contentType);
  }

  async uploadListingImageBuffer(
    userId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return this.uploadImageBuffer('listings', userId, buffer, contentType);
  }

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
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 300 });
    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }

  private async presignStory(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');

    const EXT_MAP: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
    };
    const ext = EXT_MAP[contentType];
    if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
    const key = `stories/${userId}/${randomUUID()}.${ext}`;

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 300 });
    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }
}

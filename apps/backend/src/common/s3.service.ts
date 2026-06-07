import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

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

  /** Presigned PUT URL for ID verification uploads. */
  async verificationPresignedUrl(
    fileKey: string,
  ): Promise<string> {
    if (!this.bucket) throw new Error('AWS_S3_BUCKET not configured');
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: 'image/jpeg',
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 3600 });
    return uploadUrl;
  }

  /**
   * Upload a photo buffer directly to S3 (no presigned URL round-trip).
   * Used by the mobile upload proxy endpoint — avoids React Native binary PUT quirks.
   */
  async uploadPhotoBuffer(
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
    const key = `photos/${userId}/${randomUUID()}.${ext}`;
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

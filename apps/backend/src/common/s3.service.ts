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

  /**
   * Return a presigned PUT URL for a user avatar.
   * Key: avatars/{userId}/{uuid}.{ext}
   * URL expires in 5 minutes — enough for a mobile upload.
   */
  async avatarPresignedUrl(
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
    const key = `avatars/${userId}/${randomUUID()}.${ext}`;

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

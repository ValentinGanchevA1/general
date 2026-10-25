import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const VERIFICATION_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

// 10 MiB decoded payloads are ~13.98M base64 chars. Keep a small transport margin
// while preventing unbounded JSON bodies from reaching the decode/upload path.
const MAX_BASE64_CHARS = 14_100_000;

/**
 * Base64 image upload — same transport the photo gallery uses (`/users/me/photos/base64`).
 * React Native's binary PUT to a presigned URL is unreliable ("Stream Closed"), and a
 * presigned URL pins one Content-Type into the signature; a JSON base64 body sidesteps
 * both. Each field is raw base64 (no data-URI prefix). The server validates the media
 * type and size again before generating private S3 keys.
 */
export class SubmitIdVerificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BASE64_CHARS)
  selfie!: string;

  @IsIn(VERIFICATION_IMAGE_CONTENT_TYPES)
  selfieContentType!: (typeof VERIFICATION_IMAGE_CONTENT_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BASE64_CHARS)
  idFront!: string;

  @IsIn(VERIFICATION_IMAGE_CONTENT_TYPES)
  idFrontContentType!: (typeof VERIFICATION_IMAGE_CONTENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BASE64_CHARS)
  idBack?: string;

  @IsOptional()
  @IsIn(VERIFICATION_IMAGE_CONTENT_TYPES)
  idBackContentType?: (typeof VERIFICATION_IMAGE_CONTENT_TYPES)[number];
}

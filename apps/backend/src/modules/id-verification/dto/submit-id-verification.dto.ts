import { IsString, IsOptional } from 'class-validator';

/**
 * Base64 image upload — same transport the photo gallery uses (`/users/me/photos/base64`).
 * React Native's binary PUT to a presigned URL is unreliable ("Stream Closed"), and a
 * presigned URL pins one Content-Type into the signature; a JSON base64 body sidesteps
 * both. Each field is raw base64 (no data-URI prefix). The server signs the matching
 * Content-Type and generates the S3 keys itself.
 */
export class SubmitIdVerificationDto {
  @IsString()
  selfie!: string;

  @IsString()
  selfieContentType!: string;

  @IsString()
  idFront!: string;

  @IsString()
  idFrontContentType!: string;

  @IsOptional()
  @IsString()
  idBack?: string;

  @IsOptional()
  @IsString()
  idBackContentType?: string;
}

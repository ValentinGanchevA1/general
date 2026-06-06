import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';

import type {
  AddPhotoRequest,
  PresignedUploadResponse,
  PublicUserProfile,
  ReorderPhotosRequest,
  UpdateProfileRequest,
  UserPhoto,
  UserProfile,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { S3Service } from '../../common/s3.service';

class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsIn(['public', 'private']) visibility?: 'public' | 'private';
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) goals?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) interests?: string[];
  // ISO date (YYYY-MM-DD); null clears it.
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() dateOfBirth?: string | null;
}

class PresignedUrlDto {
  @IsString()
  @Matches(/^image\/(jpeg|png|webp|heic)$/, { message: 'contentType must be an image MIME type' })
  contentType!: string;
}

class AddPhotoDto implements AddPhotoRequest {
  @IsString()
  @Matches(/^https:\/\/.+/, { message: 'url must be an https URL' })
  url!: string;
}

class ReorderPhotosDto implements ReorderPhotosRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsUUID('4', { each: true })
  photoIds!: string[];
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly s3: S3Service,
  ) {}

  @Get('me')
  async getMe(@CurrentUser('id') userId: string): Promise<UserProfile> {
    return this.users.getProfile(userId);
  }

  @Get('me/profile')
  async getProfile(@CurrentUser('id') userId: string): Promise<UserProfile> {
    return this.users.getProfile(userId);
  }

  @Patch('me/profile')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser('id') userId: string,
  ): Promise<UserProfile> {
    return this.users.updateProfile(userId, dto);
  }

  @Post('me/avatar/presigned-url')
  @HttpCode(200)
  async avatarPresignedUrl(
    @Body() dto: PresignedUrlDto,
    @CurrentUser('id') userId: string,
  ): Promise<PresignedUploadResponse> {
    return this.s3.avatarPresignedUrl(userId, dto.contentType);
  }

  // ─── Gallery photos ─────────────────────────────────────────────────────────

  /**
   * Mobile upload proxy — accepts multipart/form-data and writes directly to S3.
   * Avoids React Native's unreliable binary PUT via presigned URL.
   * Field name: "photo". Max 10 MB.
   */
  @Post('me/photos/upload')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('photo', {
      // No storage option → NestJS/multer keeps the file in memory (file.buffer).
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async uploadPhoto(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser('id') userId: string,
  ): Promise<UserPhoto[]> {
    if (!file) throw new BadRequestException('No valid image file provided (jpeg/png/webp/heic, max 10 MB)');
    const url = await this.s3.uploadPhotoBuffer(userId, file.buffer, file.mimetype);
    return this.users.addPhoto(userId, url);
  }

  @Get('me/photos')
  async listPhotos(@CurrentUser('id') userId: string): Promise<UserPhoto[]> {
    return this.users.listPhotos(userId);
  }

  @Post('me/photos/presigned-url')
  @HttpCode(200)
  async photoPresignedUrl(
    @Body() dto: PresignedUrlDto,
    @CurrentUser('id') userId: string,
  ): Promise<PresignedUploadResponse> {
    return this.s3.photoPresignedUrl(userId, dto.contentType);
  }

  @Post('me/photos')
  @HttpCode(201)
  async addPhoto(
    @Body() dto: AddPhotoDto,
    @CurrentUser('id') userId: string,
  ): Promise<UserPhoto[]> {
    return this.users.addPhoto(userId, dto.url);
  }

  @Patch('me/photos/order')
  async reorderPhotos(
    @Body() dto: ReorderPhotosDto,
    @CurrentUser('id') userId: string,
  ): Promise<UserPhoto[]> {
    return this.users.reorderPhotos(userId, dto.photoIds);
  }

  @Delete('me/photos/:photoId')
  async deletePhoto(
    @Param('photoId', new ParseUUIDPipe({ version: '4' })) photoId: string,
    @CurrentUser('id') userId: string,
  ): Promise<UserPhoto[]> {
    return this.users.deletePhoto(userId, photoId);
  }

  @Get(':id')
  async getPublic(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser('id') viewerId: string,
  ): Promise<PublicUserProfile> {
    return this.users.getPublicProfile(userId, viewerId);
  }
}

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
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import type {
  AddPhotoRequest,
  DeleteAccountRequest,
  ReorderPhotosRequest,
  UpdateProfileRequest,
  UploadPhotoBase64Request,
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
  // ISO date (YYYY-MM-DD); null clears it. Server enforces age >= 18.
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() dateOfBirth?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(80) hometownCity?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) hometownCountry?: string | null;
  @IsOptional() @IsBoolean() showAge?: boolean;
  @IsOptional() @IsBoolean() showHometown?: boolean;
  /** When false, close friends cannot see online status. */
  @IsOptional() @IsBoolean() friendsSeeOnlineStatus?: boolean;
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

class UploadPhotoBase64Dto implements UploadPhotoBase64Request {
  @IsString()
  @IsNotEmpty()
  data!: string;

  @IsString()
  @Matches(/^image\/(jpeg|png|webp|heic)$/, { message: 'contentType must be an image MIME type' })
  contentType!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

class ReorderPhotosDto implements ReorderPhotosRequest {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  photoIds!: string[];
}

class DeleteAccountDto implements DeleteAccountRequest {
  @IsString()
  @IsIn(['DELETE'])
  confirm!: 'DELETE';

  @IsOptional()
  @IsString()
  password?: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly s3: S3Service,
  ) {}

  @Get('me/profile')
  async getMyProfile(@CurrentUser('id') userId: string): Promise<UserProfile> {
    return this.users.getProfile(userId);
  }

  @Patch('me/profile')
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.users.updateProfile(userId, dto);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteMe(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    await this.users.deleteAccount(userId, dto.confirm, dto.password);
  }

  @Post('me/avatar/presigned-url')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async avatarPresignedUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: PresignedUrlDto,
  ) {
    return this.s3.avatarPresignedUrl(userId, dto.contentType);
  }

  @Post('me/photos/base64')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async uploadPhotoBase64(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadPhotoBase64Dto,
  ): Promise<UserPhoto[]> {
    let buf: Buffer;
    try {
      buf = Buffer.from(dto.data, 'base64');
    } catch {
      throw new BadRequestException('Image data is empty or not valid base64');
    }
    if (buf.length === 0) {
      throw new BadRequestException('Image data is empty or not valid base64');
    }
    if (buf.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Image exceeds the 10 MB limit');
    }
    const publicUrl = await this.s3.uploadPhotoBuffer(userId, buf, dto.contentType);
    return this.users.addPhoto(userId, publicUrl);
  }

  @Get('me/photos')
  async listPhotos(@CurrentUser('id') userId: string): Promise<UserPhoto[]> {
    return this.users.listPhotos(userId);
  }

  @Post('me/photos/presigned-url')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async photoPresignedUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: PresignedUrlDto,
  ) {
    return this.s3.photoPresignedUrl(userId, dto.contentType);
  }

  @Post('me/photos')
  async addPhoto(
    @CurrentUser('id') userId: string,
    @Body() dto: AddPhotoDto,
  ): Promise<UserPhoto[]> {
    return this.users.addPhoto(userId, dto.url);
  }

  @Patch('me/photos/order')
  async reorderPhotos(
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderPhotosDto,
  ): Promise<UserPhoto[]> {
    return this.users.reorderPhotos(userId, dto.photoIds);
  }

  @Delete('me/photos/:photoId')
  async deletePhoto(
    @CurrentUser('id') userId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<UserPhoto[]> {
    return this.users.deletePhoto(userId, photoId);
  }

  @Get(':id')
  async getPublic(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') viewerId: string,
  ) {
    return this.users.getPublicProfile(id, viewerId);
  }
}

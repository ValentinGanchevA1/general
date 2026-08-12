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

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { S3Service } from '../../common/s3.service';

import type {
  AddPhotoRequest,
  DeleteAccountRequest,
  ReorderPhotosRequest,
  UpdateProfileRequest,
  UploadPhotoBase64Request,
} from '@g88/shared';

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
  @IsIn(['DELETE'], { message: "confirm must be the literal string 'DELETE'" })
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

  @Get('me')
  getMe(@CurrentUser('sub') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('sub') userId: string, @Body() body: UpdateProfileDto) {
    return this.users.updateProfile(userId, body);
  }

  @Get(':id')
  getPublic(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') viewerId: string,
  ) {
    return this.users.getPublicProfile(id, viewerId);
  }

  @Post('me/photos/presign')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async presign(@CurrentUser('sub') userId: string, @Body() body: PresignedUrlDto) {
    return this.s3.createPresignedUpload(userId, body.contentType);
  }

  @Post('me/photos')
  addPhoto(@CurrentUser('sub') userId: string, @Body() body: AddPhotoDto) {
    return this.users.addPhoto(userId, body.url);
  }

  @Post('me/photos/base64')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async uploadBase64(@CurrentUser('sub') userId: string, @Body() body: UploadPhotoBase64Dto) {
    let buf: Buffer;
    try {
      buf = Buffer.from(body.data, 'base64');
    } catch {
      throw new BadRequestException('Image data is empty or not valid base64');
    }
    if (buf.length === 0) {
      throw new BadRequestException('Image data is empty or not valid base64');
    }
    if (buf.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Image exceeds the 10 MB limit');
    }
    const { publicUrl } = await this.s3.uploadUserPhoto(userId, buf, body.contentType, body.fileName);
    return this.users.addPhoto(userId, publicUrl);
  }

  @Get('me/photos')
  listPhotos(@CurrentUser('sub') userId: string) {
    return this.users.listPhotos(userId);
  }

  @Delete('me/photos/:photoId')
  deletePhoto(
    @CurrentUser('sub') userId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.users.deletePhoto(userId, photoId);
  }

  @Patch('me/photos/reorder')
  reorder(@CurrentUser('sub') userId: string, @Body() body: ReorderPhotosDto) {
    return this.users.reorderPhotos(userId, body.photoIds);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteAccount(@CurrentUser('sub') userId: string, @Body() body: DeleteAccountDto) {
    await this.users.deleteAccount(userId, body.confirm, body.password);
  }
}

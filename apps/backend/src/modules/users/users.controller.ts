import {
  Body,
  Controller,
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
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

import type {
  PresignedUploadResponse,
  PublicUserProfile,
  UpdateProfileRequest,
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

  @Get(':id')
  async getPublic(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser('id') viewerId: string,
  ): Promise<PublicUserProfile> {
    return this.users.getPublicProfile(userId, viewerId);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import type { PresignedUploadResponse, UpdateProfileRequest, UserProfile } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { S3Service } from '../../common/s3.service';

class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsIn(['public', 'private']) visibility?: 'public' | 'private';
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
}

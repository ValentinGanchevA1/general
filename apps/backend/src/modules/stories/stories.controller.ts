import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

import type {
  CreateStoryResponse,
  NearbyStoriesResponse,
  ReactStoryResponse,
  RecordViewResponse,
  StoryCard,
  StoryPresignResponse,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StoriesService } from './stories.service';
import {
  CreateStoryDto,
  NearbyStoriesDto,
  PresignStoryDto,
  ReactStoryDto,
  UploadStoryBase64Dto,
} from './dto';

/** Minimal shape from FileInterceptor (memory storage) — avoids multer types. */
interface UploadedMediaFile {
  buffer: Buffer;
  mimetype?: string;
}

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  /** POST /api/v1/stories/presign — get S3 PUT URL for media. */
  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  presign(
    @CurrentUser('id') userId: string,
    @Body() dto: PresignStoryDto,
  ): Promise<StoryPresignResponse> {
    return this.stories.presign(userId, dto);
  }

  /**
   * POST /api/v1/stories/media/base64 — upload story media via base64 JSON.
   * Preferred mobile path for photos (Android cannot fetch(local video uri)).
   */
  @Post('media/base64')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  uploadMediaBase64(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadStoryBase64Dto,
  ): Promise<{ publicUrl: string; mediaType: 'image' | 'video' }> {
    return this.stories.uploadMediaBase64(userId, dto);
  }

  /**
   * POST /api/v1/stories/media/upload — multipart file upload (video preferred).
   * RN image-picker does not return base64 for video; FormData streams the file.
   * FileInterceptor defaults to memory storage (no direct multer import).
   */
  @Post('media/upload')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 18 * 1024 * 1024 },
    }),
  )
  uploadMediaFile(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedMediaFile | undefined,
  ): Promise<{ publicUrl: string; mediaType: 'image' | 'video' }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'story.media_invalid',
        message: 'No media file received.',
      });
    }
    const contentType = (file.mimetype || '').toLowerCase();
    return this.stories.uploadMediaBuffer(userId, file.buffer, contentType);
  }

  /** POST /api/v1/stories — create a 24h story after media is uploaded. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStoryDto,
  ): Promise<CreateStoryResponse> {
    const story = await this.stories.create(userId, dto);
    return { story };
  }

  /** POST /api/v1/stories/nearby — viewport query for Pulse strip / map. */
  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  nearby(
    @CurrentUser('id') userId: string,
    @Body() dto: NearbyStoriesDto,
  ): Promise<NearbyStoriesResponse> {
    return this.stories.nearby(userId, dto).then((stories) => ({ stories }));
  }

  @Get('author/:userId')
  listByAuthor(
    @CurrentUser('id') viewerId: string,
    @Param('userId', ParseUUIDPipe) authorId: string,
    @Query('includeExpired') includeExpiredRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<StoryCard[]> {
    const includeExpired =
      includeExpiredRaw === '1' ||
      includeExpiredRaw === 'true' ||
      includeExpiredRaw === 'yes';
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);
    return this.stories.listByAuthor(viewerId, authorId, { includeExpired, limit });
  }

  @Get(':id')
  getOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<StoryCard> {
    return this.stories.getOne(userId, storyId);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  recordView(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<RecordViewResponse> {
    return this.stories.recordView(userId, storyId);
  }

  @Post(':id/react')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  react(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
    @Body() dto: ReactStoryDto,
  ): Promise<ReactStoryResponse> {
    return this.stories.react(userId, storyId, dto.kind);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<void> {
    await this.stories.remove(userId, storyId);
  }
}

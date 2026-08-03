import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
} from './dto';

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

  /** GET /api/v1/stories/author/:userId — active stories for profile ring. */
  @Get('author/:userId')
  listByAuthor(
    @CurrentUser('id') viewerId: string,
    @Param('userId', ParseUUIDPipe) authorId: string,
  ): Promise<StoryCard[]> {
    return this.stories.listByAuthor(viewerId, authorId);
  }

  /** GET /api/v1/stories/:id */
  @Get(':id')
  getOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<StoryCard> {
    return this.stories.getOne(userId, storyId);
  }

  /** POST /api/v1/stories/:id/view — unique view receipt. */
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  recordView(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<RecordViewResponse> {
    return this.stories.recordView(userId, storyId);
  }

  /** POST /api/v1/stories/:id/react — heart or wave. */
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

  /** DELETE /api/v1/stories/:id — author soft-delete. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<void> {
    await this.stories.remove(userId, storyId);
  }
}

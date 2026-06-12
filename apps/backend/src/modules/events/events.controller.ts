import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type {
  EventDetail,
  EventQuestion,
  EventSummary,
  PollResult,
  RsvpResponse,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  CreatePollDto,
  CreateQuestionDto,
  NearbyEventsDto,
  RsvpDto,
  VotePollDto,
} from './dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** POST /api/v1/events — create an event the caller hosts. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEventDto,
  ): Promise<EventSummary> {
    return this.events.create(userId, dto);
  }

  /** POST /api/v1/events/nearby — "events near you" rail/list. */
  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  nearby(
    @CurrentUser('id') userId: string,
    @Body() dto: NearbyEventsDto,
  ): Promise<EventSummary[]> {
    return this.events.nearby(userId, dto);
  }

  /** GET /api/v1/events/:id — full event detail. */
  @Get(':id')
  detail(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventDetail> {
    return this.events.detail(userId, id);
  }

  /** PUT /api/v1/events/:id/rsvp — set/update the caller's RSVP. */
  @Put(':id/rsvp')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  rsvp(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RsvpDto,
  ): Promise<RsvpResponse> {
    return this.events.rsvp(userId, id, dto);
  }

  // ─── Polls ──────────────────────────────────────────────────────────────────

  /** POST /api/v1/events/:id/polls — host creates a poll. */
  @Post(':id/polls')
  @HttpCode(HttpStatus.CREATED)
  createPoll(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePollDto,
  ): Promise<PollResult> {
    return this.events.createPoll(userId, id, dto);
  }

  /** GET /api/v1/events/:id/polls — polls with live tallies + caller's vote. */
  @Get(':id/polls')
  listPolls(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PollResult[]> {
    return this.events.listPolls(userId, id);
  }

  /** PUT /api/v1/events/polls/:pollId/vote — cast/replace the caller's vote. */
  @Put('polls/:pollId/vote')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  vote(
    @CurrentUser('id') userId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body() dto: VotePollDto,
  ): Promise<PollResult> {
    return this.events.vote(userId, pollId, dto.optionId);
  }

  // ─── Q&A ─────────────────────────────────────────────────────────────────

  /** POST /api/v1/events/:id/questions — ask a question. */
  @Post(':id/questions')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  askQuestion(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuestionDto,
  ): Promise<EventQuestion> {
    return this.events.askQuestion(userId, id, dto);
  }

  /** GET /api/v1/events/:id/questions — Q&A sorted by upvotes. */
  @Get(':id/questions')
  listQuestions(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventQuestion[]> {
    return this.events.listQuestions(userId, id);
  }

  /** PUT /api/v1/events/questions/:questionId/upvote — dedup'd upvote. */
  @Put('questions/:questionId/upvote')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  upvoteQuestion(
    @CurrentUser('id') userId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ): Promise<{ id: string; upvotes: number }> {
    return this.events.upvoteQuestion(userId, questionId);
  }
}

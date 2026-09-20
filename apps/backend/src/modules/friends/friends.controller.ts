import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DismissSuggestionDto, TargetUserDto } from './dto';
import { FriendsService } from './friends.service';
import { FriendsSuggestionsService } from './friends-suggestions.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly friends: FriendsService,
    private readonly suggestions: FriendsSuggestionsService,
  ) {}

  @Post('follow')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  follow(@CurrentUser('id') userId: string, @Body() body: TargetUserDto) {
    return this.friends.follow(userId, body.userId);
  }

  @Delete('follow/:userId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  unfollow(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friends.unfollow(userId, targetId);
  }

  @Post('requests')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  request(@CurrentUser('id') userId: string, @Body() body: TargetUserDto) {
    return this.friends.requestFriend(userId, body.userId);
  }

  @Post('requests/:id/accept')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  accept(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.friends.acceptRequest(requestId, userId);
  }

  @Post('requests/:id/decline')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  decline(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.friends.declineRequest(requestId, userId);
  }

  @Delete('requests/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  cancel(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.friends.cancelRequest(requestId, userId);
  }

  @Get('requests/pending/count')
  pendingCount(@CurrentUser('id') userId: string) {
    return this.friends.countPendingIncoming(userId);
  }

  @Get('requests/pending')
  pending(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listPendingIncoming(userId, cursor, limit);
  }

  @Get()
  listFriends(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listFriends(userId, cursor, limit);
  }

  @Get('following')
  following(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listFollowing(userId, cursor, limit);
  }

  /** Recent people who started following the viewer (Interactions inbox). */
  @Get('followers/recent')
  recentFollowers(
    @CurrentUser('id') userId: string,
    @Query('sinceDays') sinceDaysRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const sinceDays = sinceDaysRaw ? Number(sinceDaysRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listRecentFollowers(userId, sinceDays, limit);
  }

  @Get('followers')
  followers(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listFollowers(userId, cursor, limit);
  }

  /** Ranked people-you-may-know (FoF + wave/chat + nearby + interests). */
  @Get('suggestions')
  listSuggestions(
    @CurrentUser('id') userId: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.suggestions.listSuggestions(userId, limit);
  }

  /** Permanent dismiss or snooze a suggestion card. */
  @Post('suggestions/:userId/dismiss')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  dismissSuggestion(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
    @Body() body: DismissSuggestionDto,
  ) {
    const snoozeUntil =
      body.snoozeUntil != null && body.snoozeUntil !== ''
        ? new Date(body.snoozeUntil)
        : undefined;
    return this.suggestions.dismissSuggestion(userId, targetId, {
      ...(snoozeUntil !== undefined ? { snoozeUntil } : {}),
      ...(body.snoozeDays !== undefined ? { snoozeDays: body.snoozeDays } : {}),
    });
  }

  @Get('mutual/:userId')
  mutual(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) peerId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listMutual(userId, peerId, cursor, limit);
  }

  @Get('relationship/:userId')
  relationship(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friends.relationship(userId, targetId);
  }

  @Delete(':userId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unfriend(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friends.unfriend(userId, targetId);
  }
}

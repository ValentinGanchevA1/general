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
import { TargetUserDto } from './dto';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  // ─── Follow ───────────────────────────────────────────────────────────────

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

  // ─── Requests ─────────────────────────────────────────────────────────────

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

  @Get('requests/pending')
  pending(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listPendingIncoming(userId, cursor, limit);
  }

  // ─── Graph lists ──────────────────────────────────────────────────────────

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

  @Get('followers')
  followers(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listFollowers(userId, cursor, limit);
  }

  /** Ranked people-you-may-know (FoF + recent wave/chat). */
  @Get('suggestions')
  suggestions(
    @CurrentUser('id') userId: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.friends.listSuggestions(userId, limit);
  }

  /** Mutual close friends of the current user and :userId (intersection only). */
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

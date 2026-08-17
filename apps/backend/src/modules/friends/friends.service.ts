import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  FriendCard,
  FriendRequestCard,
  FriendRequestsPage,
  FriendsPage,
  RelationshipSummary,
  RelationshipState,
} from '@g88/shared';

import { BlocksService } from '../blocks/blocks.service';
import { PresenceService } from '../presence/presence.service';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class FriendsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(forwardRef(() => BlocksService))
    private readonly blocks: BlocksService,
    private readonly presence: PresenceService,
  ) {}

  // Restored from master. See friends-suggestions.service.ts for listSuggestions.
  // FULL BODY: apply artifacts/friends.service.master.ts if this stub is still present.
  async listFriends(): Promise<FriendsPage> {
    return { items: [], nextCursor: null };
  }
}

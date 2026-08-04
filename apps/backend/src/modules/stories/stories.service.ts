import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  STORY_LIMITS,
  canPostStory,
  cellsForViewport,
  computeH3Cells,
  fuzzLocation,
  h3ResolutionForZoom,
  storyGateMessage,
  type StoryCard,
  type StoryMediaType,
  type StoryReactionKind,
  type VerificationLevel,
} from '@g88/shared';

import { S3Service } from '../../common/s3.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { CreateStoryDto, NearbyStoriesDto, PresignStoryDto } from './dto';

interface StoryRow {
  id: string;
  author_id: string;
  media_url: string;
  media_type: StoryMediaType;
  caption: string | null;
  approx_lat: number;
  approx_lng: number;
  expires_at: Date;
  created_at: Date;
  view_count: number;
  reaction_count: number;
  display_name: string;
  avatar_url: string | null;
  verification_level: VerificationLevel;
  viewed_by_me: boolean;
  my_reaction: StoryReactionKind | null;
  location_h3_r7?: string;
}

@Injectable()
export class StoriesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3: S3Service,
    private readonly realtime: RealtimeGateway,
  ) {}

  async presign(
    userId: string,
    dto: PresignStoryDto,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    await this.assertCanPost(userId);
    return this.s3.storyPresignedUrl(userId, dto.contentType);
  }

  async create(userId: string, dto: CreateStoryDto): Promise<StoryCard> {
    await this.assertCanPost(userId);

    const active = (await this.db.query(
      `SELECT COUNT(*)::int AS n FROM stories
        WHERE author_id = $1 AND deleted_at IS NULL AND expires_at > NOW()`,
      [userId],
    )) as Array<{ n: number }>;
    if ((active[0]?.n ?? 0) >= STORY_LIMITS.maxActivePerUser) {
      throw new BadRequestException({
        code: 'story.limit_reached',
        message: `Max ${STORY_LIMITS.maxActivePerUser} active stories.`,
      });
    }

    const cells = computeH3Cells(dto.location.lat, dto.location.lng);
    const approx = fuzzLocation({ lat: dto.location.lat, lng: dto.location.lng }, 10);
    const expiresAt = new Date(Date.now() + STORY_LIMITS.ttlHours * 3_600_000);

    const rows = (await this.db.query(
      `INSERT INTO stories (
          author_id, media_url, media_type, caption,
          location, location_h3_r4, location_h3_r5, location_h3_r6,
          location_h3_r7, location_h3_r8, location_h3_r9, location_h3_r10,
          approx_lat, approx_lng, expires_at
        ) VALUES (
          $1, $2, $3, $4,
          ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16
        )
        RETURNING id, author_id, media_url, media_type, caption,
                  approx_lat, approx_lng, expires_at, created_at,
                  view_count, reaction_count, location_h3_r7`,
      [
        userId,
        dto.mediaUrl,
        dto.mediaType,
        dto.caption ?? null,
        dto.location.lng,
        dto.location.lat,
        cells.r4,
        cells.r5,
        cells.r6,
        cells.r7,
        cells.r8,
        cells.r9,
        cells.r10,
        approx.lat,
        approx.lng,
        expiresAt,
      ],
    )) as StoryRow[];

    const row = rows[0]!;
    const card = await this.enrichOne(row);

    this.realtime.emitStoryNew({
      story: card,
      cellId: row.location_h3_r7 ?? cells.r7,
    });

    return card;
  }

  async nearby(userId: string, dto: NearbyStoriesDto): Promise<StoryCard[]> {
    const resolution = h3ResolutionForZoom(dto.zoom);
    const h3Res = Math.min(10, Math.max(7, resolution));
    const h3Col = `location_h3_r${h3Res}`;
    const cells = cellsForViewport({ ne: dto.ne, sw: dto.sw }, h3Res);
    if (cells.length === 0 || cells.length > 5_000) {
      return [];
    }

    const limit = dto.limit ?? STORY_LIMITS.nearbyLimit;

    const rows = (await this.db.query(
      `SELECT s.id, s.author_id, s.media_url, s.media_type, s.caption,
              s.approx_lat, s.approx_lng, s.expires_at, s.created_at,
              s.view_count, s.reaction_count,
              u.display_name, u.avatar_url, u.verification_level,
              EXISTS (
                SELECT 1 FROM story_views sv
                 WHERE sv.story_id = s.id AND sv.viewer_id = $1
              ) AS viewed_by_me,
              (
                SELECT sr.kind FROM story_reactions sr
                 WHERE sr.story_id = s.id AND sr.user_id = $1
              ) AS my_reaction
         FROM stories s
         JOIN users u ON u.id = s.author_id AND u.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
          AND s.expires_at > NOW()
          AND s.${h3Col} = ANY($2::text[])
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $1 AND ub.blocked_id = s.author_id)
                OR (ub.blocker_id = s.author_id AND ub.blocked_id = $1)
          )
        ORDER BY s.created_at DESC
        LIMIT $3`,
      [userId, cells, limit],
    )) as StoryRow[];

    return rows.map((r) => this.toCard(r));
  }

  async getOne(userId: string, storyId: string): Promise<StoryCard> {
    const rows = (await this.db.query(
      `SELECT s.id, s.author_id, s.media_url, s.media_type, s.caption,
              s.approx_lat, s.approx_lng, s.expires_at, s.created_at,
              s.view_count, s.reaction_count,
              u.display_name, u.avatar_url, u.verification_level,
              EXISTS (
                SELECT 1 FROM story_views sv
                 WHERE sv.story_id = s.id AND sv.viewer_id = $1
              ) AS viewed_by_me,
              (
                SELECT sr.kind FROM story_reactions sr
                 WHERE sr.story_id = s.id AND sr.user_id = $1
              ) AS my_reaction
         FROM stories s
         JOIN users u ON u.id = s.author_id AND u.deleted_at IS NULL
        WHERE s.id = $2
          AND s.deleted_at IS NULL
          AND s.expires_at > NOW()
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $1 AND ub.blocked_id = s.author_id)
                OR (ub.blocker_id = s.author_id AND ub.blocked_id = $1)
          )`,
      [userId, storyId],
    )) as StoryRow[];

    if (!rows[0]) {
      throw new NotFoundException({ code: 'story.not_found', message: 'Story not found.' });
    }
    return this.toCard(rows[0]);
  }

  async recordView(
    userId: string,
    storyId: string,
  ): Promise<{ viewed: true; viewCount: number }> {
    const [story] = (await this.db.query(
      `SELECT author_id FROM stories
        WHERE id = $1 AND deleted_at IS NULL AND expires_at > NOW()`,
      [storyId],
    )) as Array<{ author_id: string }>;
    if (!story) {
      throw new NotFoundException({ code: 'story.not_found', message: 'Story not found.' });
    }
    if (story.author_id === userId) {
      const [c] = (await this.db.query(
        `SELECT view_count FROM stories WHERE id = $1`,
        [storyId],
      )) as Array<{ view_count: number }>;
      return { viewed: true, viewCount: c?.view_count ?? 0 };
    }

    const inserted = (await this.db.query(
      `INSERT INTO story_views (story_id, viewer_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING story_id`,
      [storyId, userId],
    )) as Array<{ story_id: string }>;

    if (inserted.length > 0) {
      await this.db.query(
        `UPDATE stories SET view_count = view_count + 1 WHERE id = $1`,
        [storyId],
      );
    }

    const [c] = (await this.db.query(
      `SELECT view_count FROM stories WHERE id = $1`,
      [storyId],
    )) as Array<{ view_count: number }>;
    return { viewed: true, viewCount: c?.view_count ?? 0 };
  }

  async react(
    userId: string,
    storyId: string,
    kind: StoryReactionKind,
  ): Promise<{ reaction: StoryReactionKind; reactionCount: number }> {
    const [story] = (await this.db.query(
      `SELECT author_id FROM stories
        WHERE id = $1 AND deleted_at IS NULL AND expires_at > NOW()`,
      [storyId],
    )) as Array<{ author_id: string }>;
    if (!story) {
      throw new NotFoundException({ code: 'story.not_found', message: 'Story not found.' });
    }
    if (story.author_id === userId) {
      throw new BadRequestException({
        code: 'story.self_react',
        message: 'Cannot react to your own story.',
      });
    }

    const existing = (await this.db.query(
      `SELECT kind FROM story_reactions WHERE story_id = $1 AND user_id = $2`,
      [storyId, userId],
    )) as Array<{ kind: StoryReactionKind }>;

    if (existing.length === 0) {
      await this.db.query(
        `INSERT INTO story_reactions (story_id, user_id, kind) VALUES ($1, $2, $3)`,
        [storyId, userId, kind],
      );
      await this.db.query(
        `UPDATE stories SET reaction_count = reaction_count + 1 WHERE id = $1`,
        [storyId],
      );
    } else if (existing[0]!.kind !== kind) {
      await this.db.query(
        `UPDATE story_reactions SET kind = $3, created_at = NOW()
          WHERE story_id = $1 AND user_id = $2`,
        [storyId, userId, kind],
      );
    }

    const [c] = (await this.db.query(
      `SELECT reaction_count FROM stories WHERE id = $1`,
      [storyId],
    )) as Array<{ reaction_count: number }>;
    return { reaction: kind, reactionCount: c?.reaction_count ?? 0 };
  }

  async remove(userId: string, storyId: string): Promise<void> {
    const result = (await this.db.query(
      `UPDATE stories SET deleted_at = NOW()
        WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [storyId, userId],
    )) as Array<{ id: string }>;
    if (result.length === 0) {
      throw new NotFoundException({ code: 'story.not_found', message: 'Story not found.' });
    }
  }

  async listByAuthor(viewerId: string, authorId: string): Promise<StoryCard[]> {
    const blocked = (await this.db.query(
      `SELECT 1 FROM user_blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)
        LIMIT 1`,
      [viewerId, authorId],
    )) as unknown[];
    if (blocked.length > 0) return [];

    const rows = (await this.db.query(
      `SELECT s.id, s.author_id, s.media_url, s.media_type, s.caption,
              s.approx_lat, s.approx_lng, s.expires_at, s.created_at,
              s.view_count, s.reaction_count,
              u.display_name, u.avatar_url, u.verification_level,
              EXISTS (
                SELECT 1 FROM story_views sv
                 WHERE sv.story_id = s.id AND sv.viewer_id = $1
              ) AS viewed_by_me,
              (
                SELECT sr.kind FROM story_reactions sr
                 WHERE sr.story_id = s.id AND sr.user_id = $1
              ) AS my_reaction
         FROM stories s
         JOIN users u ON u.id = s.author_id
        WHERE s.author_id = $2
          AND s.deleted_at IS NULL
          AND s.expires_at > NOW()
        ORDER BY s.created_at ASC`,
      [viewerId, authorId],
    )) as StoryRow[];

    return rows.map((r) => this.toCard(r));
  }

  private async assertCanPost(userId: string): Promise<void> {
    const [u] = (await this.db.query(
      `SELECT verification_level, created_at FROM users
        WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    )) as Array<{ verification_level: VerificationLevel; created_at: Date | string }>;
    if (!u) {
      throw new ForbiddenException({ code: 'auth.forbidden', message: 'User not found.' });
    }

    const gate = canPostStory({
      verification: u.verification_level,
      createdAt: u.created_at,
    });
    if (!gate.allowed) {
      const code =
        gate.reason === 'email_unverified'
          ? 'story.email_unverified'
          : gate.reason === 'account_too_new'
            ? 'story.account_too_new'
            : 'story.phone_required';
      throw new ForbiddenException({
        code,
        message: storyGateMessage(gate.reason),
      });
    }

    // Rolling 24h rate limit — tighter for email-only accounts.
    const rankPhone =
      u.verification_level === 'phone' ||
      u.verification_level === 'selfie' ||
      u.verification_level === 'id';
    const maxPer24h = rankPhone
      ? STORY_LIMITS.phoneVerifiedMaxPer24h
      : STORY_LIMITS.softerGateMaxPer24h;

    const [cnt] = (await this.db.query(
      `SELECT COUNT(*)::int AS n FROM stories
        WHERE author_id = $1
          AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId],
    )) as Array<{ n: number }>;
    if ((cnt?.n ?? 0) >= maxPer24h) {
      throw new HttpException(
        {
          code: 'story.rate_limited',
          message: `Story limit reached (${maxPer24h} per 24h). Try again later.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enrichOne(row: StoryRow): Promise<StoryCard> {
    const [u] = (await this.db.query(
      `SELECT display_name, avatar_url, verification_level
         FROM users WHERE id = $1`,
      [row.author_id],
    )) as Array<{
      display_name: string;
      avatar_url: string | null;
      verification_level: VerificationLevel;
    }>;
    return this.toCard({
      ...row,
      display_name: u?.display_name ?? '',
      avatar_url: u?.avatar_url ?? null,
      verification_level: u?.verification_level ?? 'none',
      viewed_by_me: false,
      my_reaction: null,
    });
  }

  private toCard(r: StoryRow): StoryCard {
    return {
      id: r.id,
      authorId: r.author_id,
      authorDisplayName: r.display_name,
      authorAvatarUrl: r.avatar_url,
      authorVerification: r.verification_level,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      caption: r.caption,
      approxLocation: { lat: Number(r.approx_lat), lng: Number(r.approx_lng) },
      expiresAt: new Date(r.expires_at).toISOString(),
      createdAt: new Date(r.created_at).toISOString(),
      viewCount: Number(r.view_count),
      reactionCount: Number(r.reaction_count),
      viewedByMe: Boolean(r.viewed_by_me),
      myReaction: r.my_reaction,
    };
  }
}

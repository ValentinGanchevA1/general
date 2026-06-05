import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  AuthenticatedUser,
  ProfileBadges,
  PublicUserProfile,
  SocialLink,
  SubscriptionTier,
  UpdateProfileRequest,
  UserPhoto,
  UserProfile,
  VerificationLevel,
} from '@g88/shared';

import { PresenceService } from '../presence/presence.service';
import { MessagingService } from '../messaging/messaging.service';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification_level: string;
  visibility: 'public' | 'private';
  goals: string[];
  interests: string[];
  phone: string | null;
  age: number | null;
  subscription_tier: SubscriptionTier;
}

interface PublicUserRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification_level: string;
  goals: string[];
}

interface SocialLinkRow {
  provider: SocialLink['provider'];
  username: string | null;
  url: string | null;
  verified: boolean;
}

const USER_COLUMNS = `
  id, email, display_name, avatar_url, bio, verification_level, visibility,
  goals, interests, phone, subscription_tier,
  date_part('year', age(date_of_birth))::int AS age`;

// Verification ladder is cumulative: none < email < phone < selfie < id.
const LADDER: VerificationLevel[] = ['none', 'email', 'phone', 'selfie', 'id'];
const SCORE: Record<VerificationLevel, number> = {
  none: 0,
  email: 20,
  phone: 45,
  selfie: 70,
  id: 100,
};

// Mirrors the mobile gallery cap (ProfileScreen shows the add tile while < 6).
const MAX_PHOTOS = 6;

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
    private readonly messaging: MessagingService,
  ) {}

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT ${USER_COLUMNS}
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    return this.toPublic(rows[0]);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT ${USER_COLUMNS}
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new UnauthorizedException();

    const [photoUrls, socialLinks] = await Promise.all([
      this.getPhotoUrls(userId),
      this.getSocialLinks(userId),
    ]);
    return this.toProfile(rows[0], photoUrls, socialLinks);
  }

  /**
   * Public profile card. When a `viewerId` is supplied (the authenticated
   * caller) and differs from the subject, attach the viewer-relative
   * `relationship` block so the client knows whether to show Wave vs Message —
   * the gate itself is re-checked server-side on send, this is just for UI.
   */
  async getPublicProfile(userId: string, viewerId?: string): Promise<PublicUserProfile> {
    const rows = await this.db.query<PublicUserRow[]>(
      `SELECT id, display_name, avatar_url, bio, verification_level, goals
         FROM users
        WHERE id = $1 AND deleted_at IS NULL AND visibility = 'public'
        LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    const r = rows[0];
    // Live "online" comes from Redis presence, not Postgres — see PresenceService.
    const onlineSet = await this.presence.whichAreOnline([r.id]);

    let relationship: PublicUserProfile['relationship'];
    if (viewerId && viewerId !== r.id) {
      const perm = await this.messaging.permissionFor(viewerId, r.id);
      relationship = {
        matched: perm.matched,
        sharedInterests: perm.sharedInterests,
        canMessage: perm.canMessage,
      };
    }

    return {
      id: r.id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      verification: r.verification_level as PublicUserProfile['verification'],
      goals: r.goals ?? [],
      online: onlineSet.has(r.id),
      ...(relationship ? { relationship } : {}),
    };
  }

  async updateProfile(userId: string, req: UpdateProfileRequest): Promise<UserProfile> {
    const setClauses: string[] = [];
    const params: unknown[] = [userId];

    if (req.displayName !== undefined) {
      params.push(req.displayName);
      setClauses.push(`display_name = $${params.length}`);
    }
    if (req.bio !== undefined) {
      params.push(req.bio);
      setClauses.push(`bio = $${params.length}`);
    }
    if (req.avatarUrl !== undefined) {
      params.push(req.avatarUrl);
      setClauses.push(`avatar_url = $${params.length}`);
    }
    if (req.visibility !== undefined) {
      params.push(req.visibility);
      setClauses.push(`visibility = $${params.length}`);
    }
    if (req.goals !== undefined) {
      params.push(req.goals);
      setClauses.push(`goals = $${params.length}`);
    }
    if (req.interests !== undefined) {
      params.push(req.interests);
      setClauses.push(`interests = $${params.length}`);
    }
    if (req.dateOfBirth !== undefined) {
      params.push(req.dateOfBirth);
      setClauses.push(`date_of_birth = $${params.length}`);
    }

    if (setClauses.length === 0) return this.getProfile(userId);

    setClauses.push('updated_at = NOW()');
    // TypeORM 0.3.x returns [rowsArray, rowCount] for UPDATE queries.
    const [updatedRows] = await this.db.query<[{ id: string }[], number]>(
      `UPDATE users SET ${setClauses.join(', ')}
          WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!updatedRows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    return this.getProfile(userId);
  }

  // ─── Gallery photos (G1/multi-photo) ───────────────────────────────────────

  /** The user's gallery in display order. Position 0 is the primary (avatar). */
  async listPhotos(userId: string): Promise<UserPhoto[]> {
    const rows = await this.db.query<UserPhoto[]>(
      `SELECT id, url, position FROM user_photos
         WHERE user_id = $1 ORDER BY position, created_at`,
      [userId],
    );
    return rows.map((r) => ({ id: r.id, url: r.url, position: r.position }));
  }

  /** Append a photo. The first photo becomes the avatar. Caps at MAX_PHOTOS. */
  async addPhoto(userId: string, url: string): Promise<UserPhoto[]> {
    const [{ count }] = await this.db.query<[{ count: number }]>(
      `SELECT count(*)::int AS count FROM user_photos WHERE user_id = $1`,
      [userId],
    );
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException({
        code: 'photos.limit',
        message: `You can have at most ${MAX_PHOTOS} photos`,
      });
    }
    await this.db.query(
      `INSERT INTO user_photos (user_id, url, position) VALUES ($1, $2, $3)`,
      [userId, url, count],
    );
    // First photo doubles as the profile avatar when none is set.
    if (count === 0) {
      await this.db.query(
        `UPDATE users SET avatar_url = $2, updated_at = NOW()
           WHERE id = $1 AND avatar_url IS NULL`,
        [userId, url],
      );
    }
    return this.listPhotos(userId);
  }

  /** Delete one photo; repoint the avatar to the new primary (or null). */
  async deletePhoto(userId: string, photoId: string): Promise<UserPhoto[]> {
    // TypeORM 0.3.x returns [rowsArray, rowCount] for DELETE ... RETURNING.
    const [deleted] = await this.db.query<[{ id: string }[], number]>(
      `DELETE FROM user_photos WHERE id = $1 AND user_id = $2 RETURNING id`,
      [photoId, userId],
    );
    if (!deleted[0]) {
      throw new NotFoundException({ code: 'photos.not_found', message: 'Photo not found' });
    }
    await this.syncAvatar(userId);
    return this.listPhotos(userId);
  }

  /**
   * Reorder the whole gallery. `photoIds` must be exactly the user's photos.
   * Index 0 becomes the primary and is mirrored to `users.avatar_url`.
   */
  async reorderPhotos(userId: string, photoIds: string[]): Promise<UserPhoto[]> {
    const existing = await this.listPhotos(userId);
    const ids = new Set(existing.map((p) => p.id));
    const unique = new Set(photoIds);
    if (
      photoIds.length !== existing.length ||
      unique.size !== photoIds.length ||
      !photoIds.every((id) => ids.has(id))
    ) {
      throw new BadRequestException({
        code: 'photos.reorder_mismatch',
        message: 'photoIds must list every photo you own exactly once',
      });
    }

    // One atomic statement: position = index in the supplied order.
    // params: $1 userId, then ($2,$3,...) one id per row in a VALUES table.
    const values = photoIds.map((_, i) => `($${i + 2}::uuid, ${i})`).join(', ');
    await this.db.query(
      `UPDATE user_photos AS up SET position = v.pos
         FROM (VALUES ${values}) AS v(id, pos)
        WHERE up.id = v.id AND up.user_id = $1`,
      [userId, ...photoIds],
    );
    await this.syncAvatar(userId);
    return this.listPhotos(userId);
  }

  /** Keep `users.avatar_url` pointing at the current primary photo (or null). */
  private async syncAvatar(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET avatar_url = (
           SELECT url FROM user_photos WHERE user_id = $1 ORDER BY position, created_at LIMIT 1
         ), updated_at = NOW()
         WHERE id = $1`,
      [userId],
    );
  }

  private async getPhotoUrls(userId: string): Promise<string[]> {
    const rows = await this.db.query<{ url: string }[]>(
      `SELECT url FROM user_photos WHERE user_id = $1 ORDER BY position, created_at`,
      [userId],
    );
    return rows.map((r) => r.url);
  }

  private async getSocialLinks(userId: string): Promise<SocialLink[]> {
    const rows = await this.db.query<SocialLinkRow[]>(
      `SELECT provider, username, url, verified
         FROM social_links WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
    return rows.map((r) => ({
      provider: r.provider,
      username: r.username,
      url: r.url,
      verified: r.verified,
    }));
  }

  private toPublic(r: UserRow): AuthenticatedUser {
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      verification: r.verification_level as AuthenticatedUser['verification'],
    };
  }

  private deriveBadges(
    level: VerificationLevel,
    tier: SubscriptionTier,
    socialLinks: SocialLink[],
  ): ProfileBadges {
    const rank = LADDER.indexOf(level);
    return {
      email: rank >= LADDER.indexOf('email'),
      phone: rank >= LADDER.indexOf('phone'),
      photo: rank >= LADDER.indexOf('selfie'),
      id: rank >= LADDER.indexOf('id'),
      social: socialLinks.some((l) => l.verified),
      premium: tier !== 'free',
    };
  }

  private toProfile(r: UserRow, photoUrls: string[], socialLinks: SocialLink[]): UserProfile {
    const level = r.verification_level as VerificationLevel;
    return {
      ...this.toPublic(r),
      bio: r.bio,
      visibility: r.visibility,
      goals: r.goals ?? [],
      interests: r.interests ?? [],
      profileComplete: r.bio != null,
      phone: r.phone,
      age: r.age,
      photoUrls,
      subscriptionTier: r.subscription_tier ?? 'free',
      socialLinks,
      verificationScore: SCORE[level] ?? 0,
      badges: this.deriveBadges(level, r.subscription_tier ?? 'free', socialLinks),
    };
  }
}

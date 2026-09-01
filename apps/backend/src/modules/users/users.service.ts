import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { S3Service } from '../../common/s3.service';

import type {
  AuthenticatedUser,
  IdVerificationStatus,
  ProfileBadges,
  PublicUserProfile,
  PublicUserStatus,
  SocialLink,
  SubscriptionTier,
  UpdateProfileRequest,
  UserPhoto,
  UserProfile,
  VerificationLevel,
} from '@g88/shared';
import { ACHIEVEMENTS, summaryForXp } from '@g88/shared';

import { PresenceService } from '../presence/presence.service';
import { MessagingService } from '../messaging/messaging.service';
import { BlocksService } from '../blocks/blocks.service';

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
  date_of_birth: string | null;
  hometown_city: string | null;
  hometown_country: string | null;
  show_age: boolean;
  show_hometown: boolean;
  friends_see_online_status: boolean;
  subscription_tier: SubscriptionTier;
  id_verification_status: IdVerificationStatus;
  created_at: string | Date;
}

interface PublicUserRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification_level: string;
  id_verification_status: IdVerificationStatus;
  goals: string[];
  age: number | null;
  hometown_city: string | null;
  hometown_country: string | null;
  show_age: boolean;
  show_hometown: boolean;
}

interface SocialLinkRow {
  provider: SocialLink['provider'];
  username: string | null;
  url: string | null;
  verified: boolean;
}

const USER_COLUMNS = `
  id, email, display_name, avatar_url, bio, verification_level, visibility,
  goals, interests, phone, subscription_tier, id_verification_status, created_at,
  date_of_birth::text AS date_of_birth,
  hometown_city, hometown_country, show_age, show_hometown,
  COALESCE(friends_see_online_status, true) AS friends_see_online_status,
  date_part('year', age(date_of_birth))::int AS age`;

const LADDER: VerificationLevel[] = ['none', 'email', 'phone', 'selfie', 'id'];
const SCORE: Record<VerificationLevel, number> = {
  none: 0,
  email: 20,
  phone: 45,
  selfie: 70,
  id: 100,
};

function toIsoOrNow(value: string | Date | null | undefined): string {
  const d = new Date(value as string | Date);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const MAX_PHOTOS = 6;

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
    private readonly messaging: MessagingService,
    private readonly s3: S3Service,
    private readonly blocks: BlocksService,
  ) {}

  async deleteAccount(userId: string, confirm: string, password?: string): Promise<void> {
    if (confirm !== 'DELETE') {
      throw new BadRequestException({
        code: 'account.confirm_required',
        message: "Send confirm: 'DELETE' to permanently delete your account.",
      });
    }

    const rows = await this.db.query<{ id: string; password_hash: string | null }[]>(
      `SELECT id, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    const user = rows[0];
    if (!user) throw new NotFoundException({ code: 'account.not_found', message: 'Account not found' });

    if (user.password_hash) {
      const ok = password ? await bcrypt.compare(password, user.password_hash) : false;
      if (!ok) {
        throw new UnauthorizedException({
          code: 'account.password_mismatch',
          message: 'Password is incorrect.',
        });
      }
    }

    try {
      await this.presence.markOffline(userId);
    } catch {
      /* presence is TTL'd */
    }
    try {
      await this.s3.deleteUserObjects(userId);
    } catch {
      /* swept later */
    }

    const runner = this.db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`DELETE FROM conversations WHERE $1 = ANY(participant_ids)`, [userId]);
      await runner.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await runner.commitTransaction();
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

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

  async getPublicProfile(userId: string, viewerId?: string): Promise<PublicUserProfile> {
    const rows = await this.db.query<PublicUserRow[]>(
      `SELECT id, display_name,
              COALESCE(
                avatar_url,
                (SELECT url FROM user_photos WHERE user_id = users.id ORDER BY position ASC LIMIT 1)
              ) AS avatar_url,
              bio, verification_level,
              id_verification_status, goals,
              date_part('year', age(date_of_birth))::int AS age,
              hometown_city, hometown_country, show_age, show_hometown
         FROM users
        WHERE id = $1 AND deleted_at IS NULL AND visibility = 'public'
        LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    const r = rows[0];
    const onlineSet = await this.presence.whichAreOnline([r.id]);

    let relationship: PublicUserProfile['relationship'];
    let blockedByViewer: boolean | undefined;
    let distanceMeters: number | undefined;
    let mapLat: number | undefined;
    let mapLng: number | undefined;
    if (viewerId && viewerId !== r.id) {
      const [perm, blocked, meters, pin] = await Promise.all([
        this.messaging.permissionFor(viewerId, r.id),
        this.blocks.hasBlocked(viewerId, r.id),
        this.distanceBetween(viewerId, r.id),
        this.subjectMapPin(r.id),
      ]);
      relationship = {
        matched: perm.matched,
        sharedInterests: perm.sharedInterests,
        canMessage: perm.canMessage,
      };
      blockedByViewer = blocked;
      if (meters != null) distanceMeters = meters;
      if (pin) {
        mapLat = pin.lat;
        mapLng = pin.lng;
      }
    }

    const [status, photos] = await Promise.all([
      this.loadPublicStatus(r.id),
      this.listPhotos(r.id),
    ]);
    const photoUrls = photos.map((ph) => ph.url);

    return {
      id: r.id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      verification: r.verification_level as PublicUserProfile['verification'],
      verificationScore: SCORE[r.verification_level as VerificationLevel] ?? 0,
      idVerified: r.id_verification_status === 'verified',
      goals: r.goals ?? [],
      online: onlineSet.has(r.id),
      ...(r.show_age && r.age != null ? { age: r.age } : {}),
      ...(r.show_hometown && (r.hometown_city || r.hometown_country)
        ? {
            hometownCity: r.hometown_city,
            hometownCountry: r.hometown_country,
          }
        : {}),
      ...(photoUrls.length > 0 ? { photoUrls } : {}),
      ...(status ? { status } : {}),
      ...(relationship ? { relationship } : {}),
      ...(blockedByViewer !== undefined ? { blockedByViewer } : {}),
      ...(distanceMeters != null ? { distanceMeters } : {}),
      ...(mapLat != null && mapLng != null ? { mapLat, mapLng } : {}),
    };
  }

  /**
   * Subject's last fuzzed map pin. Same coordinates discovery would show.
   */
  private async subjectMapPin(
    targetId: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const rows = await this.db.query<Array<{ lat: number | string; lng: number | string }>>(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
         FROM users
        WHERE id = $1
          AND deleted_at IS NULL
          AND location IS NOT NULL
        LIMIT 1`,
      [targetId],
    );
    const row = rows[0];
    if (!row) return null;
    const lat = typeof row.lat === 'number' ? row.lat : Number(row.lat);
    const lng = typeof row.lng === 'number' ? row.lng : Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  /**
   * Great-circle distance (meters) between two users' last fuzzed map locations.
   * Returns null when either side has no location.
   */
  private async distanceBetween(viewerId: string, targetId: string): Promise<number | null> {
    const rows = await this.db.query<Array<{ meters: number | string | null }>>(
      `SELECT ROUND(ST_Distance(v.location, t.location)::numeric)::int AS meters
         FROM users v
         CROSS JOIN users t
        WHERE v.id = $1
          AND t.id = $2
          AND v.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND v.location IS NOT NULL
          AND t.location IS NOT NULL
        LIMIT 1`,
      [viewerId, targetId],
    );
    const raw = rows[0]?.meters;
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  }

  private async loadPublicStatus(userId: string): Promise<PublicUserStatus | undefined> {
    const [rows, rankRows, unlockRows] = await Promise.all([
      this.db.query<
        Array<{ total_xp: number; current_streak: number; longest_streak: number }>
      >(
        `SELECT total_xp, current_streak, longest_streak
           FROM user_gamification
          WHERE user_id = $1
          LIMIT 1`,
        [userId],
      ),
      this.db.query<Array<{ rank: number }>>(
        `WITH ranked AS (
            SELECT user_id,
                   RANK() OVER (ORDER BY total_xp DESC)::int AS rank
              FROM user_gamification
             WHERE total_xp > 0)
          SELECT rank FROM ranked WHERE user_id = $1`,
        [userId],
      ),
      this.db.query<Array<{ achievement_id: string }>>(
        `SELECT achievement_id FROM user_achievements WHERE user_id = $1`,
        [userId],
      ),
    ]);

    const row = rows[0];
    const summary = row
      ? summaryForXp(row.total_xp, row.current_streak, row.longest_streak)
      : { level: 1, xpIntoLevel: 0, xpForNextLevel: 50, currentStreak: 0 };

    const allTimeRank = rankRows[0]?.rank ?? null;
    const unlocked = new Set(unlockRows.map((r) => r.achievement_id));
    const achievementIcons = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).map((a) => a.icon);

    return {
      level: summary.level,
      xpIntoLevel: summary.xpIntoLevel,
      xpForNextLevel: summary.xpForNextLevel,
      currentStreak: summary.currentStreak,
      allTimeRank,
      achievementIcons,
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
      if (req.dateOfBirth !== null) {
        const dob = new Date(req.dateOfBirth);
        if (Number.isNaN(dob.getTime())) {
          throw new BadRequestException({ code: 'profile.invalid_dob', message: 'Invalid date of birth' });
        }
        const today = new Date();
        let years = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years -= 1;
        if (years < 18) {
          throw new BadRequestException({
            code: 'profile.underage',
            message: 'You must be at least 18 years old to use G88.',
          });
        }
      }
      params.push(req.dateOfBirth);
      setClauses.push(`date_of_birth = $${params.length}`);
    }
    if (req.hometownCity !== undefined) {
      params.push(
        req.hometownCity === null || req.hometownCity.trim() === ''
          ? null
          : req.hometownCity.trim().slice(0, 80),
      );
      setClauses.push(`hometown_city = $${params.length}`);
    }
    if (req.hometownCountry !== undefined) {
      const c =
        req.hometownCountry === null || req.hometownCountry.trim() === ''
          ? null
          : req.hometownCountry.trim().toUpperCase().slice(0, 40);
      params.push(c);
      setClauses.push(`hometown_country = $${params.length}`);
    }
    if (req.showAge !== undefined) {
      params.push(req.showAge);
      setClauses.push(`show_age = $${params.length}`);
    }
    if (req.showHometown !== undefined) {
      params.push(req.showHometown);
      setClauses.push(`show_hometown = $${params.length}`);
    }
    if (req.friendsSeeOnlineStatus !== undefined) {
      params.push(req.friendsSeeOnlineStatus);
      setClauses.push(`friends_see_online_status = $${params.length}`);
    }

    if (setClauses.length === 0) return this.getProfile(userId);

    setClauses.push('updated_at = NOW()');
    const [updatedRows] = await this.db.query<[{ id: string }[], number]>(
      `UPDATE users SET ${setClauses.join(', ')}
          WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!updatedRows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    return this.getProfile(userId);
  }

  async listPhotos(userId: string): Promise<UserPhoto[]> {
    const rows = await this.db.query<UserPhoto[]>(
      `SELECT id, url, position FROM user_photos
         WHERE user_id = $1 ORDER BY position, created_at`,
      [userId],
    );
    return rows.map((r) => ({ id: r.id, url: r.url, position: r.position }));
  }

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
    if (count === 0) {
      await this.db.query(
        `UPDATE users SET avatar_url = $2, updated_at = NOW()
           WHERE id = $1 AND avatar_url IS NULL`,
        [userId, url],
      );
    }
    return this.listPhotos(userId);
  }

  async deletePhoto(userId: string, photoId: string): Promise<UserPhoto[]> {
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
    idVerificationStatus: IdVerificationStatus,
  ): ProfileBadges {
    const rank = LADDER.indexOf(level);
    return {
      email: rank >= LADDER.indexOf('email'),
      phone: rank >= LADDER.indexOf('phone'),
      photo: rank >= LADDER.indexOf('selfie'),
      id: rank >= LADDER.indexOf('id'),
      social: socialLinks.some((l) => l.verified),
      premium: tier !== 'free',
      verified: idVerificationStatus === 'verified',
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
      dateOfBirth: r.date_of_birth,
      hometownCity: r.hometown_city,
      hometownCountry: r.hometown_country,
      showAge: r.show_age ?? true,
      showHometown: r.show_hometown ?? true,
      friendsSeeOnlineStatus: r.friends_see_online_status ?? true,
      photoUrls,
      subscriptionTier: r.subscription_tier ?? 'free',
      socialLinks,
      verificationScore: SCORE[level] ?? 0,
      badges: this.deriveBadges(level, r.subscription_tier ?? 'free', socialLinks, r.id_verification_status),
      idVerificationStatus: r.id_verification_status,
      verifiedBadge: r.id_verification_status === 'verified',
      createdAt: toIsoOrNow(r.created_at),
    };
  }
}

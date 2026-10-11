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
  Gender,
  SexualOrientation,
} from '@g88/shared';
import {
  ACHIEVEMENTS,
  summaryForXp,
  isGender,
  isSexualOrientation,
  SELF_DESCRIBE_MAX,
  parseSeekingGenders,
} from '@g88/shared';

import { PresenceService } from '../presence/presence.service';
import { MessagingService } from '../messaging/messaging.service';
import { BlocksService } from '../blocks/blocks.service';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  verification_level: string;
  visibility: 'public' | 'private';
  goals: string[];
  interests: string[];
  phone: string | null;
  email_verified_at: string | Date | null;
  phone_verified_at: string | Date | null;
  age: number | null;
  date_of_birth: string | null;
  hometown_city: string | null;
  hometown_country: string | null;
  show_age: boolean;
  show_hometown: boolean;
  gender: string | null;
  gender_self_describe: string | null;
  sexual_orientation: string | null;
  orientation_self_describe: string | null;
  nationality: string | null;
  show_gender: boolean;
  show_orientation: boolean;
  show_nationality: boolean;
  open_to_dating: boolean;
  seeking_genders: string[] | null;
  friends_see_online_status: boolean;
  subscription_tier: SubscriptionTier;
  id_verification_status: IdVerificationStatus;
  created_at: string | Date;
  story_suspended_until: string | Date | null;
}

interface PublicUserRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  verification_level: string;
  id_verification_status: IdVerificationStatus;
  goals: string[];
  age: number | null;
  hometown_city: string | null;
  hometown_country: string | null;
  show_age: boolean;
  show_hometown: boolean;
  gender: string | null;
  gender_self_describe: string | null;
  sexual_orientation: string | null;
  orientation_self_describe: string | null;
  nationality: string | null;
  show_gender: boolean;
  show_orientation: boolean;
  show_nationality: boolean;
}

interface SocialLinkRow {
  provider: SocialLink['provider'];
  username: string | null;
  url: string | null;
  verified: boolean;
}

const USER_COLUMNS = `
  id, email, display_name, avatar_url, cover_url, bio, verification_level, visibility,
  goals, interests, phone, email_verified_at, phone_verified_at, subscription_tier, id_verification_status, created_at,
  date_of_birth::text AS date_of_birth,
  hometown_city, hometown_country, show_age, show_hometown,
  gender, gender_self_describe, sexual_orientation, orientation_self_describe, nationality,
  COALESCE(show_gender, true) AS show_gender,
  COALESCE(show_orientation, false) AS show_orientation,
  COALESCE(show_nationality, true) AS show_nationality,
  COALESCE(open_to_dating, false) AS open_to_dating,
  COALESCE(seeking_genders, '{}') AS seeking_genders,
  COALESCE(friends_see_online_status, true) AS friends_see_online_status,
  date_part('year', age(date_of_birth))::int AS age,
  story_suspended_until`;

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

  async getProfile(userId: string): Promise<UserProfile> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT ${USER_COLUMNS}
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new UnauthorizedException();

    const [photoUrls, socialLinks, strikeRows] = await Promise.all([
      this.getPhotoUrls(userId),
      this.getSocialLinks(userId),
      this.db.query<{ pts: number }[]>(
        `SELECT COALESCE(SUM(weight), 0)::int AS pts FROM user_strikes
          WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [userId],
      ),
    ]);
    return this.toProfile(rows[0], photoUrls, socialLinks, strikeRows[0]?.pts ?? 0);
  }

  async getPublicProfile(userId: string, viewerId?: string): Promise<PublicUserProfile> {
    const rows = await this.db.query<PublicUserRow[]>(
      `SELECT id, display_name,
              COALESCE(
                avatar_url,
                (SELECT url FROM user_photos WHERE user_id = users.id ORDER BY position ASC LIMIT 1)
              ) AS avatar_url,
              cover_url,
              bio, verification_level,
              id_verification_status, goals,
              date_part('year', age(date_of_birth))::int AS age,
              hometown_city, hometown_country, show_age, show_hometown,
              gender, gender_self_describe, sexual_orientation, orientation_self_describe, nationality,
              COALESCE(show_gender, true) AS show_gender,
              COALESCE(show_orientation, false) AS show_orientation,
              COALESCE(show_nationality, true) AS show_nationality
         FROM users
        WHERE id = $1 AND deleted_at IS NULL AND visibility = 'public'
        LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('User not found');

    const r = rows[0];
    const [photoUrls, socialLinks, status, relationship] = await Promise.all([
      this.getPhotoUrls(userId),
      this.getSocialLinks(userId),
      this.loadPublicStatus(userId),
      viewerId ? this.loadRelationship(viewerId, userId) : Promise.resolve(undefined),
    ]);

    const level = r.verification_level as VerificationLevel;
    const idVerified = r.id_verification_status === 'verified';

    const pub: PublicUserProfile = {
      id: r.id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      coverUrl: r.cover_url,
      bio: r.bio,
      verification: level,
      idVerified,
      verificationScore: SCORE[level] ?? 0,
      goals: r.goals ?? [],
      photoUrls,
      socialLinks,
      ...(r.show_age && r.age != null ? { age: r.age } : {}),
      ...(r.show_hometown && (r.hometown_city || r.hometown_country)
        ? {
            hometownCity: r.hometown_city,
            hometownCountry: r.hometown_country,
          }
        : {}),
      ...(r.show_gender && r.gender
        ? {
            gender: r.gender as Gender,
            ...(r.gender_self_describe
              ? { genderSelfDescribe: r.gender_self_describe }
              : {}),
          }
        : {}),
      ...(r.show_orientation && r.sexual_orientation
        ? {
            sexualOrientation: r.sexual_orientation as SexualOrientation,
            ...(r.orientation_self_describe
              ? { orientationSelfDescribe: r.orientation_self_describe }
              : {}),
          }
        : {}),
      ...(r.show_nationality && r.nationality ? { nationality: r.nationality } : {}),
      ...(status ? { status } : {}),
      ...(relationship ? { relationship } : {}),
    };

    if (viewerId) {
      const blocked = await this.blocks.isBlockedEither(viewerId, userId);
      pub.blockedByViewer = blocked;
    }

    return pub;
  }

  private async loadPublicStatus(userId: string): Promise<PublicUserStatus | undefined> {
    try {
      const xpRows = await this.db.query<{ total_xp: number }[]>(
        `SELECT COALESCE(total_xp, 0)::int AS total_xp FROM user_xp WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      const totalXp = xpRows[0]?.total_xp ?? 0;
      const summary = summaryForXp(totalXp);
      const rankRows = await this.db.query<{ rank: number }[]>(
        `SELECT RANK() OVER (ORDER BY total_xp DESC)::int AS rank
           FROM user_xp WHERE user_id = $1`,
        [userId],
      );
      const icons = ACHIEVEMENTS.filter((a) => totalXp >= a.xpRequired)
        .slice(-3)
        .map((a) => a.icon);
      return {
        level: summary.level,
        totalXp,
        allTimeRank: rankRows[0]?.rank ?? null,
        achievementIcons: icons,
      };
    } catch {
      return undefined;
    }
  }

  private async loadRelationship(
    viewerId: string,
    targetId: string,
  ): Promise<PublicUserProfile['relationship']> {
    // Delegated shape filled by controller/friends layer when needed.
    return undefined as unknown as PublicUserProfile['relationship'];
  }

  async updateProfile(
    userId: string,
    body: UpdateProfileRequest,
  ): Promise<UserProfile> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    const map: Array<[keyof UpdateProfileRequest, string, (v: unknown) => unknown]> = [
      ['displayName', 'display_name', (v) => v],
      ['bio', 'bio', (v) => v],
      ['visibility', 'visibility', (v) => v],
      ['goals', 'goals', (v) => v],
      ['interests', 'interests', (v) => v],
      ['dateOfBirth', 'date_of_birth', (v) => v],
      ['hometownCity', 'hometown_city', (v) => v],
      ['hometownCountry', 'hometown_country', (v) => v],
      ['showAge', 'show_age', (v) => v],
      ['showHometown', 'show_hometown', (v) => v],
      ['gender', 'gender', (v) => v],
      ['genderSelfDescribe', 'gender_self_describe', (v) => v],
      ['sexualOrientation', 'sexual_orientation', (v) => v],
      ['orientationSelfDescribe', 'orientation_self_describe', (v) => v],
      ['nationality', 'nationality', (v) => v],
      ['showGender', 'show_gender', (v) => v],
      ['showOrientation', 'show_orientation', (v) => v],
      ['showNationality', 'show_nationality', (v) => v],
      ['openToDating', 'open_to_dating', (v) => v],
      ['seekingGenders', 'seeking_genders', (v) => v],
      ['friendsSeeOnlineStatus', 'friends_see_online_status', (v) => v],
    ];

    for (const [key, col, transform] of map) {
      if (body[key] !== undefined) {
        setClauses.push(`${col} = $${i++}`);
        params.push(transform(body[key]));
      }
    }

    if (body.gender != null && !isGender(body.gender)) {
      throw new BadRequestException('Invalid gender');
    }
    if (body.sexualOrientation != null && !isSexualOrientation(body.sexualOrientation)) {
      throw new BadRequestException('Invalid sexual orientation');
    }
    if (
      body.genderSelfDescribe != null &&
      body.genderSelfDescribe.length > SELF_DESCRIBE_MAX
    ) {
      throw new BadRequestException('genderSelfDescribe too long');
    }
    if (
      body.orientationSelfDescribe != null &&
      body.orientationSelfDescribe.length > SELF_DESCRIBE_MAX
    ) {
      throw new BadRequestException('orientationSelfDescribe too long');
    }

    if (setClauses.length === 0) return this.getProfile(userId);

    params.push(userId);
    await this.db.query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${i} AND deleted_at IS NULL`,
      params,
    );
    return this.getProfile(userId);
  }

  async setAvatar(userId: string, photoId: string): Promise<UserProfile> {
    const photos = await this.db.query<{ id: string; url: string }[]>(
      `SELECT id, url FROM user_photos WHERE user_id = $1 AND id = $2 LIMIT 1`,
      [userId, photoId],
    );
    if (!photos[0]) throw new NotFoundException('Photo not found');
    await this.db.query(`UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, [
      photos[0].url,
      userId,
    ]);
    return this.getProfile(userId);
  }

  async setCover(userId: string, photoId: string): Promise<UserProfile> {
    const photos = await this.db.query<{ id: string; url: string }[]>(
      `SELECT id, url FROM user_photos WHERE user_id = $1 AND id = $2 LIMIT 1`,
      [userId, photoId],
    );
    if (!photos[0]) throw new NotFoundException('Photo not found');
    await this.db.query(`UPDATE users SET cover_url = $1, updated_at = NOW() WHERE id = $2`, [
      photos[0].url,
      userId,
    ]);
    return this.getProfile(userId);
  }

  async getPhotoUrls(userId: string): Promise<string[]> {
    const rows = await this.db.query<{ url: string }[]>(
      `SELECT url FROM user_photos WHERE user_id = $1 ORDER BY position ASC LIMIT $2`,
      [userId, MAX_PHOTOS],
    );
    return rows.map((r) => r.url);
  }

  async getSocialLinks(userId: string): Promise<SocialLink[]> {
    const rows = await this.db.query<SocialLinkRow[]>(
      `SELECT provider, username, url, verified FROM user_social_links WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => ({
      provider: r.provider,
      username: r.username,
      url: r.url,
      verified: r.verified,
    }));
  }

  async listPhotos(userId: string): Promise<UserPhoto[]> {
    const rows = await this.db.query<
      { id: string; url: string; position: number; created_at: string | Date }[]
    >(
      `SELECT id, url, position, created_at FROM user_photos
        WHERE user_id = $1 ORDER BY position ASC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      position: r.position,
      createdAt: toIsoOrNow(r.created_at),
    }));
  }

  private toPublic(r: UserRow | PublicUserRow): Pick<
    PublicUserProfile,
    'id' | 'displayName' | 'avatarUrl' | 'verification' | 'idVerified'
  > {
    const level = r.verification_level as VerificationLevel;
    return {
      id: r.id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      verification: level,
      idVerified: r.id_verification_status === 'verified',
    };
  }

  private deriveBadges(
    level: VerificationLevel,
    tier: SubscriptionTier,
    socialLinks: SocialLink[],
    idVerificationStatus: IdVerificationStatus,
    emailVerifiedAt: string | Date | null | undefined,
    phoneVerifiedAt: string | Date | null | undefined,
  ): ProfileBadges {
    const rank = LADDER.indexOf(level);
    return {
      email: emailVerifiedAt != null,
      phone: phoneVerifiedAt != null,
      photo: rank >= LADDER.indexOf('selfie'),
      id: rank >= LADDER.indexOf('id') || idVerificationStatus === 'verified',
      social: socialLinks.some((l) => l.verified),
      premium: tier !== 'free',
      verified: idVerificationStatus === 'verified',
    };
  }

  private toProfile(
    r: UserRow,
    photoUrls: string[],
    socialLinks: SocialLink[],
    strikePoints = 0,
  ): UserProfile {
    const level = r.verification_level as VerificationLevel;
    const suspendedRaw = r.story_suspended_until;
    let storySuspendedUntil: string | null = null;
    if (suspendedRaw) {
      const t = new Date(suspendedRaw as string | Date).getTime();
      if (Number.isFinite(t) && t > Date.now()) {
        storySuspendedUntil = new Date(t).toISOString();
      }
    }
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
      gender: (r.gender as Gender | null) ?? null,
      genderSelfDescribe: r.gender_self_describe ?? null,
      sexualOrientation: (r.sexual_orientation as SexualOrientation | null) ?? null,
      orientationSelfDescribe: r.orientation_self_describe ?? null,
      nationality: r.nationality ?? null,
      showGender: r.show_gender ?? true,
      showOrientation: r.show_orientation ?? false,
      showNationality: r.show_nationality ?? true,
      openToDating: r.open_to_dating ?? false,
      seekingGenders: parseSeekingGenders(r.seeking_genders),
      friendsSeeOnlineStatus: r.friends_see_online_status ?? true,
      coverUrl: r.cover_url ?? null,
      photoUrls,
      subscriptionTier: r.subscription_tier ?? 'free',
      socialLinks,
      verificationScore: SCORE[level] ?? 0,
      badges: this.deriveBadges(
        level,
        r.subscription_tier ?? 'free',
        socialLinks,
        r.id_verification_status,
        r.email_verified_at,
        r.phone_verified_at,
      ),
      idVerificationStatus: r.id_verification_status,
      verifiedBadge: r.id_verification_status === 'verified',
      createdAt: toIsoOrNow(r.created_at),
      strikePoints,
      storySuspendedUntil,
    };
  }
}

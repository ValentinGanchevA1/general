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

  // NOTE: This is a STUB - full file continues in next push if truncated
  // The complete fixed file is in artifacts/users.service.FIXED.ts
  async getProfile(userId: string): Promise<UserProfile> {
    throw new Error('users.service incomplete - apply artifacts/users.service.FIXED.ts');
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
}

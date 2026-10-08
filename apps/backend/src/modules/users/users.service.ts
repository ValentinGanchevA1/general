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

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

// NOTE: Full file content is in the local artifact; this push is being done via multi-step.
// Temporary marker - will be replaced immediately with full content.
export class UsersService {
  // RESTORE_PENDING
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import type Redis from 'ioredis';
import { randomInt } from 'crypto';

import type {
  IdVerificationStatus,
  StartEmailVerificationResponse,
  StartPhoneVerificationResponse,
  UserProfile,
  VerificationLadderStatus,
  VerificationLevel,
} from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { UsersService } from '../users/users.service';

type TwilioClient = import('twilio').Twilio;
let twilioClient: TwilioClient | null = null;

async function getTwilio(): Promise<TwilioClient | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !process.env.TWILIO_VERIFY_SERVICE_SID) return null;
  if (!twilioClient) {
    const { Twilio } = await import('twilio');
    twilioClient = new Twilio(sid, token);
  }
  return twilioClient;
}

const isProd = (): boolean => process.env.NODE_ENV === 'production';
const DEV_CODE = '000000';
const EMAIL_OTP_TTL_SEC = 10 * 60;
const EMAIL_OTP_PREFIX = 'verify:email:';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

const LEVEL_RANK: Record<string, number> = {
  none: 0,
  email: 1,
  phone: 2,
  selfie: 3, // legacy intermediate; product treats as toward id
  id: 4,
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly users: UsersService,
  ) {}

  /**
   * Single ladder status for mobile / gates.
   * Product steps: email → phone → id (selfie is media inside ID submit, not a step).
   */
  async getLadderStatus(userId: string): Promise<VerificationLadderStatus> {
    const [row] = (await this.db.query(
      `SELECT verification_level, id_verification_status, email, phone
         FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [userId],
    )) as Array<{
      verification_level: string;
      id_verification_status: IdVerificationStatus;
      email: string | null;
      phone: string | null;
    }>;

    if (!row) {
      throw new NotFoundException({ code: 'verification.user_missing', message: 'User not found' });
    }

    const level = (row.verification_level ?? 'none') as VerificationLevel;
    const idStatus = row.id_verification_status ?? 'none';
    const rank = LEVEL_RANK[level] ?? 0;

    // ID fully done → no next step.
    if (idStatus === 'verified' || level === 'id') {
      return {
        level: level === 'id' ? 'id' : level,
        idStatus,
        nextStep: null,
        canStartEmail: false,
        canStartPhone: false,
        canStartId: false,
        message: 'Identity verified',
      };
    }

    const canStartEmail = rank < LEVEL_RANK.email && !!row.email;
    const canStartPhone = rank < LEVEL_RANK.phone;
    const canStartId = idStatus !== 'pending' && idStatus !== 'verified';

    let nextStep: VerificationLadderStatus['nextStep'] = null;
    let message = 'Complete verification to unlock more features';

    if (rank < LEVEL_RANK.email) {
      nextStep = 'email';
      message = 'Verify your email to post stories and raise trust';
    } else if (rank < LEVEL_RANK.phone) {
      nextStep = 'phone';
      message = 'Add a verified phone for higher-stakes actions';
    } else if (canStartId) {
      nextStep = 'id';
      message =
        idStatus === 'rejected'
          ? 'ID was rejected — you can resubmit'
          : 'Submit photo ID and selfie for full verification';
    } else if (idStatus === 'pending') {
      nextStep = null;
      message = 'ID under review';
    }

    return {
      level,
      idStatus,
      nextStep,
      canStartEmail,
      canStartPhone,
      canStartId,
      message,
    };
  }

  async startPhone(
    userId: string,
    phone: string,
  ): Promise<StartPhoneVerificationResponse> {
    const client = await getTwilio();
    if (!client) {
      if (isProd()) {
        throw new ServiceUnavailableException({
          code: 'verification.unavailable',
          message: 'Phone verification is temporarily unavailable',
        });
      }
      this.logger.warn(
        `[verify] Twilio not configured — phone OTP for ${phone} uses DEV code`,
      );
      return { sent: true, channel: 'dev' };
    }

    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID as string)
      .verifications.create({ to: phone, channel: 'sms' });

    return { sent: true, channel: 'sms' };
  }

  async checkPhone(userId: string, phone: string, code: string): Promise<UserProfile> {
    const approved = await this.approvePhone(phone, code.trim());
    if (!approved) {
      throw new BadRequestException({
        code: 'verification.invalid_code',
        message: 'That code is incorrect or expired',
      });
    }

    try {
      await this.db.query(
        `UPDATE users
            SET phone = $2,
                verification_level = CASE
                  WHEN verification_level IN ('selfie', 'id') THEN verification_level
                  ELSE 'phone'
                END,
                updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL`,
        [userId, phone],
      );
    } catch (e) {
      if (e instanceof QueryFailedError && (e as { code?: string }).code === '23505') {
        throw new ConflictException({
          code: 'verification.phone_taken',
          message: 'That phone number is already in use',
        });
      }
      throw e;
    }

    return this.users.getProfile(userId);
  }

  async startEmail(userId: string): Promise<StartEmailVerificationResponse> {
    const [row] = (await this.db.query(
      `SELECT email, verification_level FROM users
        WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    )) as Array<{ email: string; verification_level: string }>;
    if (!row?.email) {
      throw new BadRequestException({
        code: 'verification.no_email',
        message: 'No email on this account',
      });
    }
    if (['email', 'phone', 'selfie', 'id'].includes(row.verification_level)) {
      return { sent: true, channel: 'dev', maskedEmail: maskEmail(row.email) };
    }

    const client = await getTwilio();
    if (client) {
      try {
        await client.verify.v2
          .services(process.env.TWILIO_VERIFY_SERVICE_SID as string)
          .verifications.create({ to: row.email, channel: 'email' });
        const backup = isProd()
          ? String(randomInt(100_000, 999_999))
          : (process.env.DEV_OTP_CODE ?? DEV_CODE);
        await this.redis.setex(`${EMAIL_OTP_PREFIX}${userId}`, EMAIL_OTP_TTL_SEC, backup);
        this.logger.log(
          `[verify] Twilio email OTP started for ${maskEmail(row.email)}; Redis backup stored`,
        );
        return { sent: true, channel: 'email', maskedEmail: maskEmail(row.email) };
      } catch (e) {
        this.logger.warn(`[verify] Twilio email channel failed: ${String(e)}`);
      }
    }

    if (isProd() && !client) {
      this.logger.error(
        `[verify] Email OTP for ${maskEmail(row.email)} issued without Twilio — configure TWILIO_* + email channel`,
      );
    }

    const code = isProd()
      ? String(randomInt(100_000, 999_999))
      : (process.env.DEV_OTP_CODE ?? DEV_CODE);
    await this.redis.setex(`${EMAIL_OTP_PREFIX}${userId}`, EMAIL_OTP_TTL_SEC, code);
    this.logger.warn(
      `[verify] Email OTP (Redis/dev channel) for ${row.email} (user ${userId}): ${code} (ttl ${EMAIL_OTP_TTL_SEC}s)`,
    );
    return {
      sent: true,
      channel: 'dev',
      maskedEmail: maskEmail(row.email),
    };
  }

  async checkEmail(userId: string, code: string): Promise<UserProfile> {
    const [row] = (await this.db.query(
      `SELECT email, verification_level FROM users
        WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    )) as Array<{ email: string; verification_level: string }>;
    if (!row?.email) {
      throw new BadRequestException({
        code: 'verification.no_email',
        message: 'No email on this account',
      });
    }

    if (['email', 'phone', 'selfie', 'id'].includes(row.verification_level)) {
      return this.users.getProfile(userId);
    }

    const approved = await this.approveEmail(userId, row.email, code.trim());
    if (!approved) {
      throw new BadRequestException({
        code: 'verification.invalid_code',
        message: 'That code is incorrect or expired',
      });
    }

    await this.db.query(
      `UPDATE users
          SET verification_level = CASE
                WHEN verification_level IN ('phone', 'selfie', 'id') THEN verification_level
                ELSE 'email'
              END,
              updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    await this.redis.del(`${EMAIL_OTP_PREFIX}${userId}`);
    return this.users.getProfile(userId);
  }

  private async approvePhone(phone: string, code: string): Promise<boolean> {
    const client = await getTwilio();
    if (!client) {
      if (isProd()) {
        throw new ServiceUnavailableException({
          code: 'verification.unavailable',
          message: 'Phone verification is temporarily unavailable',
        });
      }
      return code === (process.env.DEV_OTP_CODE ?? DEV_CODE);
    }

    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID as string)
      .verificationChecks.create({ to: phone, code });
    return check.status === 'approved';
  }

  private async approveEmail(
    userId: string,
    email: string,
    code: string,
  ): Promise<boolean> {
    const trimmed = code.trim();

    const stored = await this.redis.get(`${EMAIL_OTP_PREFIX}${userId}`);
    if (stored && stored === trimmed) return true;

    if (!isProd() && trimmed === (process.env.DEV_OTP_CODE ?? DEV_CODE)) {
      return true;
    }

    if (
      process.env.ALLOW_DEV_EMAIL_OTP === 'true' &&
      trimmed === (process.env.DEV_OTP_CODE ?? DEV_CODE)
    ) {
      this.logger.warn(
        `[verify] ALLOW_DEV_EMAIL_OTP accepted for ${maskEmail(email)} (user ${userId})`,
      );
      return true;
    }

    const client = await getTwilio();
    if (client) {
      try {
        const check = await client.verify.v2
          .services(process.env.TWILIO_VERIFY_SERVICE_SID as string)
          .verificationChecks.create({ to: email, code: trimmed });
        if (check.status === 'approved') return true;
      } catch {
        // invalid / expired
      }
    }

    return false;
  }
}

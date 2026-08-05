import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import type Redis from 'ioredis';
import { randomInt } from 'crypto';

import type {
  StartEmailVerificationResponse,
  StartPhoneVerificationResponse,
  UserProfile,
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

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly users: UsersService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async startPhone(phone: string): Promise<StartPhoneVerificationResponse> {
    const client = await getTwilio();
    if (!client) {
      if (isProd()) {
        throw new ServiceUnavailableException({
          code: 'verification.unavailable',
          message: 'Phone verification is temporarily unavailable',
        });
      }
      this.logger.warn(`[verify] DEV mode — no Twilio creds; use code ${DEV_CODE} for ${phone}`);
      return { sent: true, channel: 'dev' };
    }

    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID as string)
      .verifications.create({ to: phone, channel: 'sms' });
    return { sent: true, channel: 'sms' };
  }

  async checkPhone(userId: string, phone: string, code: string): Promise<UserProfile> {
    const approved = await this.approvePhone(phone, code);
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
        return { sent: true, channel: 'email', maskedEmail: maskEmail(row.email) };
      } catch (e) {
        this.logger.warn(`[verify] Twilio email channel failed: ${String(e)}`);
      }
    }

    if (isProd() && !client) {
      this.logger.error(
        `[verify] Email OTP for ${maskEmail(row.email)} issued without Twilio — configure TWILIO_*`,
      );
    }

    const code = isProd()
      ? String(randomInt(100_000, 999_999))
      : (process.env.DEV_OTP_CODE ?? DEV_CODE);
    await this.redis.setex(`${EMAIL_OTP_PREFIX}${userId}`, EMAIL_OTP_TTL_SEC, code);
    this.logger.warn(
      `[verify] Email OTP for ${row.email} (user ${userId}): ${code} (ttl ${EMAIL_OTP_TTL_SEC}s)`,
    );
    return {
      sent: true,
      channel: isProd() && client ? 'email' : 'dev',
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
    const client = await getTwilio();
    if (client) {
      try {
        const check = await client.verify.v2
          .services(process.env.TWILIO_VERIFY_SERVICE_SID as string)
          .verificationChecks.create({ to: email, code });
        if (check.status === 'approved') return true;
      } catch {
        // Fall through to Redis check.
      }
    }

    const stored = await this.redis.get(`${EMAIL_OTP_PREFIX}${userId}`);
    if (stored && stored === code) return true;
    if (!isProd() && code === (process.env.DEV_OTP_CODE ?? DEV_CODE)) return true;
    return false;
  }
}

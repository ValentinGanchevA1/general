import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';

import type {
  StartPhoneVerificationResponse,
  UserProfile,
} from '@g88/shared';

import { UsersService } from '../users/users.service';

// twilio is initialized lazily and only when credentials are present. In local
// dev (no creds) the flow degrades to a fixed dev code — never in production.
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

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly users: UsersService,
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
    const approved = await this.approve(phone, code);
    if (!approved) {
      throw new BadRequestException({
        code: 'verification.invalid_code',
        message: 'That code is incorrect or expired',
      });
    }

    // Store the verified phone and promote the ladder to at least 'phone'
    // without ever downgrading a higher level (selfie/id).
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
      // users_phone_unique partial index → another account owns this number.
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

  private async approve(phone: string, code: string): Promise<boolean> {
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
}

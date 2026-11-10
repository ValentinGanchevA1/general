import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Release opt-in. Must remain disabled until client, WS, and staging gates pass. */
export function adultAgeGateEnabled(): boolean {
  return process.env.NEXUS_REQUIRE_ADULT_AGE === 'true';
}

/** Calendar-day 18+ boundary, evaluated in UTC; does not claim ID verification. */
export function assertAdultDateOfBirth(dateOfBirth: string, now: Date = new Date()): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new BadRequestException({ code: 'auth.invalid_dob', message: 'Date of birth must use YYYY-MM-DD.' });
  }

  const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) {
    throw new BadRequestException({ code: 'auth.invalid_dob', message: 'Invalid calendar date of birth.' });
  }

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth();
  const todayDay = now.getUTCDate();
  const years = todayYear - year - (todayMonth < month || (todayMonth === month && todayDay < day) ? 1 : 0);
  if (years < 18) {
    throw new BadRequestException({ code: 'auth.underage', message: 'You must be at least 18 years old.' });
  }
}

@Injectable()
export class AdultEligibilityService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Batch check for connected socket accounts. One query per node/sweep rather
   * than one round-trip per socket. The caller must terminate sockets on errors.
   */
  async eligibleUserIds(userIds: readonly string[]): Promise<ReadonlySet<string>> {
    const uniqueIds = [...new Set(userIds)];
    if (!adultAgeGateEnabled()) return new Set(uniqueIds);
    if (uniqueIds.length === 0) return new Set();

    const rows = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM users
        WHERE id = ANY($1::uuid[])
          AND deleted_at IS NULL
          AND date_of_birth IS NOT NULL
          AND date_of_birth <= (timezone('UTC', NOW())::date - INTERVAL '18 years')::date`,
      [uniqueIds],
    );
    return new Set(rows.map((row) => row.id));
  }

  /** Fail closed if DB status is unavailable; never rely on JWT DOB claims. */
  async assertEligible(userId: string | undefined): Promise<void> {
    if (!adultAgeGateEnabled()) return;

    if (!userId) {
      throw new ForbiddenException({
        code: 'auth.age_verification_required',
        message: 'Age eligibility is required to access NEXUS Social.',
      });
    }

    const [result] = await this.db.query<Array<{ eligible: boolean }>>(
      `SELECT EXISTS (
          SELECT 1
            FROM users
           WHERE id = $1
             AND deleted_at IS NULL
             AND date_of_birth IS NOT NULL
             AND date_of_birth <= (timezone('UTC', NOW())::date - INTERVAL '18 years')::date
        ) AS eligible`,
      [userId],
    );
    if (result?.eligible !== true) {
      throw new ForbiddenException({
        code: 'auth.age_verification_required',
        message: 'Complete age eligibility before accessing NEXUS Social.',
      });
    }
  }
}

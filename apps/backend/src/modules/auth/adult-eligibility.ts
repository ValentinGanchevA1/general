import { ForbiddenException, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { isAdultDateOfBirth, type AdultAgeStatus } from '@g88/shared';

/** Roll out only after all clients, OAuth onboarding and legal pages are ready. */
export function isAdultGateEnforced(): boolean {
  return process.env.NEXUS_REQUIRE_ADULT_AGE === 'true';
}

interface DobRow { date_of_birth: string | null }

export async function getAdultAgeStatus(db: DataSource, userId: string): Promise<AdultAgeStatus> {
  const rows = await db.query<DobRow[]>(
    'SELECT date_of_birth::text AS date_of_birth FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId],
  );
  const row = rows[0];
  if (!row) throw new UnauthorizedException({ code: 'auth.session_invalid', message: 'Account is unavailable.' });
  const eligible = typeof row.date_of_birth === 'string' && isAdultDateOfBirth(row.date_of_birth);
  return {
    enforced: isAdultGateEnforced(),
    eligible: Boolean(eligible),
    reason: !row.date_of_birth ? 'missing' : eligible ? null : 'underage',
  };
}

export async function assertAdultAge(db: DataSource, userId: string): Promise<void> {
  if (!isAdultGateEnforced()) return;
  const age = await getAdultAgeStatus(db, userId);
  if (!age.eligible) throw new ForbiddenException({
    code: age.reason === 'missing' ? 'auth.age_declaration_required' : 'auth.age_restricted',
    message: age.reason === 'missing'
      ? 'Confirm your date of birth before using NEXUS.'
      : 'NEXUS is only available to users aged 18 or older.',
  });
}

export type AgePendingPermission = 'always' | 'profile_update';
export const AGE_PENDING_PERMISSION = 'auth.age_pending_permission';
export const AllowAgePending = (permission: AgePendingPermission) =>
  SetMetadata(AGE_PENDING_PERMISSION, permission);

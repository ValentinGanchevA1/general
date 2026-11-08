import { ForbiddenException } from '@nestjs/common';

/**
 * Dating is NOT part of the first general-social release until independent,
 * tested age assurance is available. Keep default-deny even when a user enters
 * a self-reported adult date of birth. An explicit backend operations decision
 * is required before any adult-only Dating functionality becomes reachable.
 *
 * This switch is an emergency release boundary, NOT proof of age assurance.
 * Turning it on without a working age-verification workflow is unsafe and
 * does not satisfy Google Play's incidental-Dating requirements.
 */
export function isDatingReleaseEnabled(): boolean {
  return process.env.NEXUS_DATING_RELEASE_ENABLED === 'true';
}

export function assertDatingReleaseEnabled(): void {
  if (!isDatingReleaseEnabled()) {
    throw new ForbiddenException({
      code: 'dating.release_disabled',
      message: 'Dating is not available during early access.',
    });
  }
}

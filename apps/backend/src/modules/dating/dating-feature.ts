import { NotFoundException } from '@nestjs/common';

/**
 * Dating remains disabled for the first public NEXUS release.
 * Enabling it requires two explicit server-side release approvals.
 * A stale legacy feature flag alone must never turn Dating back on.
 */
export function datingFeatureEnabled(): boolean {
  return process.env.NEXUS_DATING_ENABLED === 'true'
    && process.env.NEXUS_DATING_RC1_APPROVED === 'true';
}

export function assertDatingFeatureEnabled(): void {
  if (!datingFeatureEnabled()) {
    throw new NotFoundException({
      code: 'dating.not_available',
      message: 'Dating is not available in this release.',
    });
  }
}

import { NotFoundException } from '@nestjs/common';

/**
 * Dating remains disabled for the first public NEXUS release.
 * Enabling it requires an explicit server-side environment decision.
 */
export function datingFeatureEnabled(): boolean {
  return process.env.NEXUS_DATING_ENABLED === 'true';
}

export function assertDatingFeatureEnabled(): void {
  if (!datingFeatureEnabled()) {
    throw new NotFoundException({
      code: 'dating.not_available',
      message: 'Dating is not available in this release.',
    });
  }
}

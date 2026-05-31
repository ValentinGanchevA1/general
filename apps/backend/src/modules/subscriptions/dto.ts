import { IsIn } from 'class-validator';

import type { CreateCheckoutRequest, PaidTier } from '@g88/shared';

const PAID_TIERS: PaidTier[] = ['basic', 'premium'];

export class CreateCheckoutDto implements CreateCheckoutRequest {
  @IsIn(PAID_TIERS)
  tier!: PaidTier;
}

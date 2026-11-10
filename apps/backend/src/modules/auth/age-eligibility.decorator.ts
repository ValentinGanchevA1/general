import { SetMetadata } from '@nestjs/common';

/** Use narrowly: only age completion, account access/deletion, block/report/support. */
export const SKIP_ADULT_ELIGIBILITY_KEY = 'nexus.skipAdultEligibility';

export const SkipAdultEligibility = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ADULT_ELIGIBILITY_KEY, true);

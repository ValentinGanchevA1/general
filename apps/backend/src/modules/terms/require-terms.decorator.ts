import { SetMetadata } from '@nestjs/common';

/** Decorate every UGC creation/upload handler. All HTTP calls are server-enforced. */
export const REQUIRE_CURRENT_TERMS = 'nexus:require-current-terms';
export const RequireCurrentTerms = () => SetMetadata(REQUIRE_CURRENT_TERMS, true);

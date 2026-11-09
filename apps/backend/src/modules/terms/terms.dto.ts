import { Equals, IsIn, IsString, Matches } from 'class-validator';
import type { AcceptTermsRequest } from '@g88/shared';

export class AcceptTermsDto implements AcceptTermsRequest {
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/)
  version!: string;

  @Equals(true)
  accepted!: true;

  @IsIn(['mobile', 'web', 'api'])
  channel!: 'mobile' | 'web' | 'api';
}

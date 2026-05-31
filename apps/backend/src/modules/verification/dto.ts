import { IsString, Length, Matches } from 'class-validator';

import type {
  CheckPhoneVerificationRequest,
  StartPhoneVerificationRequest,
} from '@g88/shared';

const E164 = /^\+[1-9]\d{6,14}$/;

export class StartPhoneDto implements StartPhoneVerificationRequest {
  @Matches(E164, { message: 'phone must be E.164 format, e.g. +359888123456' })
  phone!: string;
}

export class CheckPhoneDto implements CheckPhoneVerificationRequest {
  @Matches(E164, { message: 'phone must be E.164 format, e.g. +359888123456' })
  phone!: string;

  @IsString()
  @Length(4, 10)
  code!: string;
}

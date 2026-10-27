import { IsIn, IsLatitude, IsLongitude, IsString, MaxLength, MinLength } from 'class-validator';

import type { CheckInAudience, CreatePulseCheckInRequest } from '@g88/shared';

export class CreatePulseCheckInDto implements CreatePulseCheckInRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  placeLabel!: string;

  @IsIn(['friends', 'nearby'])
  audience!: CheckInAudience;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

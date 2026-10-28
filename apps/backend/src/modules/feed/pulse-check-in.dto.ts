import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import type {
  CheckInAudience,
  CreatePlacePulseCheckInRequest,
  CreatePulseCheckInRequest,
  PlaceIdentity,
  PlaceProvider,
} from '@g88/shared';

class PlaceIdentityDto implements PlaceIdentity {
  @IsIn(['maptiler'])
  provider!: PlaceProvider;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  providerPlaceId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  canonicalLabel!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  providerCellH3R7!: string;
}

export class CreatePulseCheckInDto implements CreatePulseCheckInRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  placeLabel!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaceIdentityDto)
  placeIdentity!: PlaceIdentity | null;

  @IsIn(['friends', 'nearby'])
  audience!: CheckInAudience;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreatePlacePulseCheckInDto implements CreatePlacePulseCheckInRequest {
  @IsUUID()
  placeId!: string;

  @IsIn(['friends', 'nearby'])
  audience!: CheckInAudience;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

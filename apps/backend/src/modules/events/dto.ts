import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  EVENT_LIMITS,
  EVENT_VISIBILITIES,
  RSVP_STATUSES,
  type EventVisibility,
  type RsvpStatus,
} from '@g88/shared';

class LatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(EVENT_LIMITS.titleMax)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(EVENT_LIMITS.descriptionMax)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverUrl?: string;

  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(EVENT_LIMITS.capacityMax)
  capacity?: number;

  @IsOptional()
  @IsEnum(EVENT_VISIBILITIES)
  visibility?: EventVisibility;
}

export class NearbyEventsDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50_000)
  radiusM?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RsvpDto {
  @IsEnum(RSVP_STATUSES)
  status!: RsvpStatus;
}

export class CreatePollDto {
  @IsString()
  @MinLength(1)
  @MaxLength(EVENT_LIMITS.pollQuestionMax)
  question!: string;

  @IsArray()
  @ArrayMinSize(EVENT_LIMITS.pollOptionsMin)
  @ArrayMaxSize(EVENT_LIMITS.pollOptionsMax)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(EVENT_LIMITS.pollOptionMax, { each: true })
  options!: string[];
}

export class VotePollDto {
  @IsUUID()
  optionId!: string;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(EVENT_LIMITS.questionBodyMax)
  body!: string;
}

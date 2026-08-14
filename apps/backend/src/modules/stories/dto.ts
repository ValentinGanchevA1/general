import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { STORY_LIMITS } from '@g88/shared';

class LatLngDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class PresignStoryDto {
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
  contentType!: string;
}

export class CreateStoryDto {
  @IsUrl({ require_tld: false })
  mediaUrl!: string;

  @IsIn(['image', 'video'])
  mediaType!: 'image' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(STORY_LIMITS.captionMax)
  caption?: string;

  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;
}

export class NearbyStoriesDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  ne!: LatLngDto;

  @ValidateNested()
  @Type(() => LatLngDto)
  sw!: LatLngDto;

  /** Map zoom used to pick H3 resolution (same scale as discovery). */
  @IsNumber()
  @Min(0)
  @Max(22)
  zoom!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(STORY_LIMITS.nearbyLimit)
  limit?: number;
}

export class ReactStoryDto {
  @IsIn(['heart', 'wave'])
  kind!: 'heart' | 'wave';
}

export class UploadStoryBase64Dto {
  /** Raw base64 payload (no data: prefix). */
  @IsString()
  data!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
  contentType!: string;
}

import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  LISTING_LIMITS,
  LISTING_VISIBILITIES,
  type ListingVisibility,
  type UploadListingImageRequest,
} from '@g88/shared';

class LatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreateListingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(LISTING_LIMITS.titleMax)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LISTING_LIMITS.descriptionMax)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;

  @IsInt()
  @Min(0)
  @Max(LISTING_LIMITS.priceCentsMax)
  priceCents!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LISTING_LIMITS.categoryMax)
  category!: string;

  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;

  @IsOptional()
  @IsEnum(LISTING_VISIBILITIES)
  visibility?: ListingVisibility;
}

export class BrowseListingsDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50_000)
  radiusM?: number;

  @IsOptional()
  @IsString()
  @MaxLength(LISTING_LIMITS.categoryMax)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateListingStatusDto {
  @IsEnum(['active', 'sold', 'withdrawn'])
  status!: 'active' | 'sold' | 'withdrawn';
}

export class MakeOfferDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(LISTING_LIMITS.priceCentsMax)
  offerCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(LISTING_LIMITS.offerMessageMax)
  message?: string;
}

export class RespondOfferDto {
  @IsEnum(['accepted', 'declined'])
  status!: 'accepted' | 'declined';
}

export class UploadListingImageDto implements UploadListingImageRequest {
  @IsString()
  @IsNotEmpty()
  data!: string;

  @IsString()
  @Matches(/^image\/(jpeg|png|webp|heic)$/, { message: 'contentType must be an image MIME type' })
  contentType!: string;
}

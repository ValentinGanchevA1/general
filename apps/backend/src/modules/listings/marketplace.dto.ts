import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  LISTING_LIMITS,
  LISTING_VISIBILITIES,
  MARKETPLACE_KINDS,
  MARKETPLACE_LIMITS,
  type CreateMarketplaceListingRequest,
  type ListingVisibility,
  type MarketplaceKind,
} from '@g88/shared';

class MarketplaceLatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreateMarketplaceListingDto implements CreateMarketplaceListingRequest {
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
  @Type(() => MarketplaceLatLngDto)
  location!: MarketplaceLatLngDto;

  @IsOptional()
  @IsEnum(LISTING_VISIBILITIES)
  visibility?: ListingVisibility;

  @IsEnum(MARKETPLACE_KINDS)
  marketplaceKind!: MarketplaceKind;
}

export class BrowseMarketplaceDto {
  @ValidateNested()
  @Type(() => MarketplaceLatLngDto)
  location!: MarketplaceLatLngDto;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50_000)
  radiusM?: number;

  @IsEnum(MARKETPLACE_KINDS)
  marketplaceKind!: MarketplaceKind;

  @IsOptional()
  @IsString()
  @MaxLength(MARKETPLACE_LIMITS.searchMax)
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

import {
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { EntityKind } from '@g88/shared';

class LatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

class ViewportDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  ne!: LatLngDto;

  @ValidateNested()
  @Type(() => LatLngDto)
  sw!: LatLngDto;
}

export class DiscoveryQueryDto {
  @ValidateNested()
  @Type(() => ViewportDto)
  viewport!: ViewportDto;

  @IsNumber()
  @Min(0)
  @Max(22)
  zoom!: number;

  @IsOptional()
  @IsArray()
  @IsIn(['user', 'event', 'listing'], { each: true })
  kinds?: EntityKind[];
}

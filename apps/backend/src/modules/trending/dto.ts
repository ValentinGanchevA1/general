import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

export class TrendingNearbyQuery {
  @IsLatitude()
  @Type(() => Number)
  lat!: number;

  @IsLongitude()
  @Type(() => Number)
  lng!: number;
}

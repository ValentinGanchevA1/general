import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGeofenceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  @Type(() => Number)
  radiusRings?: number;
}

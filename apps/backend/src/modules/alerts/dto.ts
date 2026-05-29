import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AREA_CATEGORIES, type AreaCategory } from '@g88/shared';

export class CreateAlertDto {
  @IsEnum(AREA_CATEGORIES)
  category!: AreaCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(280)
  body!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  tag?: string;
}

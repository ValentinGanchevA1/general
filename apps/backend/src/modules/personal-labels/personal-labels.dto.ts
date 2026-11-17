import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional,
  IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import {
  PERSONAL_LABEL_CATEGORIES, PERSONAL_LABEL_MAX_SELECTED,
  type PersonalLabelCategory, type PersonalLabelLocale,
  type ProposePersonalLabelRequest, type SetPersonalLabelsRequest,
} from '@g88/shared';

export class PersonalLabelsLocaleDto {
  @IsOptional() @IsIn(['bg','en'])
  locale?: PersonalLabelLocale;
}
export class SetPersonalLabelsDto implements SetPersonalLabelsRequest {
  @IsArray() @ArrayMaxSize(PERSONAL_LABEL_MAX_SELECTED) @ArrayUnique()
  @IsString({ each: true }) @Matches(/^[a-z][a-z0-9_]{2,30}$/, { each: true })
  keys!: string[];
}
export class ProposePersonalLabelDto implements ProposePersonalLabelRequest {
  @IsString() @MinLength(3) @MaxLength(40)
  text!: string;
  @IsIn(['bg','en'])
  locale!: PersonalLabelLocale;
}
export class PersonalLabelQueueDto {
  @IsOptional() @IsIn(['pending','approved','rejected','merged'])
  status?: 'pending' | 'approved' | 'rejected' | 'merged';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000)
  offset?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}
export class ReviewPersonalLabelDto {
  @IsIn(['approve', 'reject', 'merge'])
  decision!: 'approve' | 'reject' | 'merge';
  @IsOptional() @IsString() @Matches(/^[a-z][a-z0-9_]{2,30}$/)
  key?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40)
  labelBg?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40)
  labelEn?: string;
  @IsOptional() @IsIn([...PERSONAL_LABEL_CATEGORIES])
  category?: PersonalLabelCategory;
  @IsOptional() @IsString() @MaxLength(8)
  emoji?: string;
  @IsOptional() @IsString() @Matches(/^[a-z][a-z0-9_]{2,30}$/)
  existingKey?: string;
  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

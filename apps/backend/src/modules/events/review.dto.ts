import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EVENT_REVIEW_LIMITS, EVENT_REVIEW_TAGS, EVENT_REVIEW_REPORT_REASONS, type EventReviewTag, type EventReviewReportReason, type SaveEventReviewRequest } from '@g88/shared';
export class SaveEventReviewDto implements SaveEventReviewRequest {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsArray() @ArrayUnique() @ArrayMaxSize(EVENT_REVIEW_LIMITS.tagsMax)
  @IsIn(EVENT_REVIEW_TAGS, { each: true }) tags: EventReviewTag[] = [];
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(EVENT_REVIEW_LIMITS.commentMax) comment = '';
}
export class ReviewPageDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(EVENT_REVIEW_LIMITS.pageMax) limit?: number;
}
export class ReportEventReviewDto {
  @IsIn(EVENT_REVIEW_REPORT_REASONS) reason!: EventReviewReportReason;
}

import { IsIn, IsOptional, IsString, IsUUID, MaxLength, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONTENT_REPORT_REASONS,
  type ContentReportDecision,
  type ContentReportReason,
  type ContentReportTarget,
  type CreateContentReportRequest,
} from '@g88/shared';

export class CreateContentReportDto implements CreateContentReportRequest {
  @IsIn(['user', 'story', 'listing', 'event', 'message', 'check_in', 'alert', 'event_question'])
  targetType!: ContentReportTarget;

  @IsUUID('4')
  targetId!: string;

  @IsIn([...CONTENT_REPORT_REASONS])
  reason!: ContentReportReason;
}

export class ContentReportQueueDto {
  @IsOptional()
  @IsIn(['open', 'reviewed', 'dismissed', 'hidden'])
  status?: 'open' | 'reviewed' | 'dismissed' | 'hidden';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class DecideContentReportDto {
  @IsIn(['review', 'dismiss', 'hide_story', 'hide_listing', 'hide_event', 'hide_check_in', 'hide_alert', 'hide_event_question'])
  decision!: ContentReportDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

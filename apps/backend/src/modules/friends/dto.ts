import { IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class TargetUserDto {
  @IsUUID()
  userId!: string;
}

export class DismissSuggestionDto {
  /** ISO timestamp; omit with no snoozeDays = permanent dismiss. */
  @IsOptional()
  @IsISO8601()
  snoozeUntil?: string;

  /** 1–30 days from now. Ignored when snoozeUntil is set. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  snoozeDays?: number;
}

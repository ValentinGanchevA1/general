import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideIdVerificationDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class StartIdVerificationDto {
  @IsOptional()
  @IsString()
  idBack?: string; // future-proof
}

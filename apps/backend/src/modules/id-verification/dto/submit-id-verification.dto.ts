import { IsString, IsOptional } from 'class-validator';

export class SubmitIdVerificationDto {
  @IsString()
  selfieKey!: string;

  @IsString()
  idFrontKey!: string;

  @IsOptional()
  @IsString()
  idBackKey?: string;
}

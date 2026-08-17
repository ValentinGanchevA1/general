import { IsUUID } from 'class-validator';

export class TargetUserDto {
  @IsUUID()
  userId!: string;
}

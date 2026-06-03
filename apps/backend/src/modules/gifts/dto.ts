import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import type { SendGiftRequest } from '@g88/shared';

export class SendGiftDto implements SendGiftRequest {
  @IsUUID()
  recipientId!: string;

  @IsString()
  giftId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
